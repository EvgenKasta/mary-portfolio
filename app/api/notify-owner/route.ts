import crypto from "node:crypto";

export const runtime = "nodejs";

type NotifyBody = {
  initData?: string;
  text?: string;
};

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * Telegram initData validation:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
 */
function verifyTelegramInitData(initData: string, botToken: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  if (!hash) return false;

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

  return hmac === hash;
}

type TgUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function parseUserFromInitData(initData: string): TgUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    return JSON.parse(userRaw) as TgUser;
  } catch {
    return null;
  }
}

async function tgSendMessage(botToken: string, chatId: string, text: string) {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  const bodyText = await res.text();

  if (!res.ok) {
    console.error("Telegram sendMessage failed", {
      status: res.status,
      body: bodyText,
    });
    return { ok: false, status: res.status, bodyText };
  }

  // Telegram returns JSON; parsing is optional but nice for logs
  try {
    return { ok: true, status: res.status, json: JSON.parse(bodyText) };
  } catch {
    return { ok: true, status: res.status, raw: bodyText };
  }
}

export async function POST(req: Request) {
  try {
    const { initData, text } = (await req.json()) as NotifyBody;

    const botToken = getEnv("BOT_TOKEN");
    const ownerChatId = getEnv("OWNER_CHAT_ID");

    if (!initData) {
      console.error("notify-owner: missing initData");
      return new Response("Missing initData", { status: 403 });
    }

    if (!verifyTelegramInitData(initData, botToken)) {
      console.error("notify-owner: bad initData");
      return new Response("Bad initData", { status: 403 });
    }

    const user = parseUserFromInitData(initData);

    const username = user?.username ? `@${user.username}` : "—";
    const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "—";
    const userId = user?.id ?? "—";

    const userBlock =
      `👤 Пользователь:\n` +
      `• ID: ${userId}\n` +
      `• Логин: ${username}\n` +
      `• Имя: ${fullName}\n`;

    const finalText = `${userBlock}\n${String(text || "").trim()}`;

    const sent = await tgSendMessage(botToken, ownerChatId, finalText);

    if (!sent.ok) {
      return new Response("Telegram API error", { status: 502 });
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("notify-owner route error:", e);
    return new Response("Server error", { status: 500 });
  }
}

// необязательно, но удобно для проверки что роут живой
export async function GET() {
  return Response.json({ ok: true, route: "notify-owner" });
}
