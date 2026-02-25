import crypto from "node:crypto";

export const runtime = "nodejs";

/* ---------- verify initData ---------- */

function verifyTelegramInitData(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return !!hash && hmac === hash;
}

/* ---------- parse user ---------- */

function parseUser(initData: string) {
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  if (!userRaw) return null;

  try {
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

/* ---------- route ---------- */

export async function POST(req: Request) {
  try {
    const { initData, text } = (await req.json()) as {
      initData?: string;
      text?: string;
    };

    const botToken = process.env.BOT_TOKEN || "";
    const ownerChatId = process.env.OWNER_CHAT_ID || "";

    if (!botToken || !ownerChatId) {
      console.error("Missing env");
      return new Response("Missing env", { status: 500 });
    }

    if (!initData) {
      return new Response("Missing initData", { status: 403 });
    }

    if (!verifyTelegramInitData(initData, botToken)) {
      return new Response("Bad initData", { status: 403 });
    }

    /* ---------- USER ---------- */

    const user = parseUser(initData);

    const username = user?.username
      ? `@${user.username}`
      : "без username";

    const fullName = [
      user?.first_name,
      user?.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    const userBlock = `
👤 Пользователь:
ID: ${user?.id || "unknown"}
Логин: ${username}
Имя: ${fullName || "не указано"}
`;

    /* ---------- FINAL TEXT ---------- */

    const finalText = `${userBlock}

${text || ""}`;

    /* ---------- SEND ---------- */

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: ownerChatId,
          text: finalText,
          disable_web_page_preview: true,
        }),
      }
    );

    const tgBody = await tgRes.text();

    if (!tgRes.ok) {
      console.error("Telegram error", tgBody);
      return new Response("Telegram API error", { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error("notify-owner error", e);
    return new Response("Server error", { status: 500 });
  }
}
