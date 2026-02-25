import crypto from "node:crypto";

export const runtime = "nodejs";

/* ---------- verify ---------- */

function verifyTelegramInitData(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return !!hash && hmac === hash;
}

/* ---------- parse user ---------- */

function parseUser(initData?: string, bodyUser?: any) {
  // 1️⃣ если пришёл user из фронта — берём его
  if (bodyUser) return bodyUser;

  // 2️⃣ иначе пробуем из initData
  if (!initData) return null;

  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

function formatUserBlock(user: any) {
  if (!user) return "";

  const username = user?.username ? `@${user.username}` : "без username";
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");

  return (
    `👤 Пользователь:\n` +
    `ID: ${user?.id ?? "unknown"}\n` +
    `Логин: ${username}\n` +
    `Имя: ${fullName || "не указано"}\n\n`
  );
}

/* ---------- tg send ---------- */

async function tgSendMessage(text: string) {
  const botToken = process.env.BOT_TOKEN || "";
  const ownerChatId = process.env.OWNER_CHAT_ID || "";

  if (!botToken || !ownerChatId) {
    console.error("Missing env");
    return new Response("Missing env", { status: 500 });
  }

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerChatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const tgBodyText = await tgRes.text();

  if (!tgRes.ok) {
    console.error("Telegram error", tgBodyText);
    return new Response("Telegram API error", { status: 502 });
  }

  return Response.json({ ok: true });
}

/* ---------- route ---------- */

export async function POST(req: Request) {
  try {
    const { initData, text, secret, user } = (await req.json()) as {
      initData?: string;
      text?: string;
      secret?: string;
      user?: any;
    };

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    // ✅ user block
    const parsedUser = parseUser(initData, user);
    const userBlock = formatUserBlock(parsedUser);

    /* ---------- вариант А (initData) ---------- */

    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) {
        console.error("Bad initData");
        return new Response("Bad initData", { status: 403 });
      }

      return await tgSendMessage(userBlock + messageText);
    }

    /* ---------- вариант Б (secret) ---------- */

    if (serverSecret && secret && secret === serverSecret) {
      return await tgSendMessage(userBlock + messageText);
    }

    console.error("Unauthorized notify");
    return new Response("Unauthorized", { status: 403 });

  } catch (e) {
    console.error("notify-owner error", e);
    return new Response("Server error", { status: 500 });
  }
}
