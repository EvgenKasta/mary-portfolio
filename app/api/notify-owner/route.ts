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
  const hmac = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  return !!hash && hmac === hash;
}

/* ---------- parse user from initData ---------- */
function parseUserFromInitData(initData: string) {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    return JSON.parse(userRaw);
  } catch {
    return null;
  }
}

/* ---------- format user block ---------- */
function formatUserBlock(user: any) {
  if (!user || typeof user !== "object") return "";

  const id = user.id ?? "unknown";
  const username = user.username ? `@${user.username}` : "без username";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "не указано";

  return `👤 Пользователь:
ID: ${id}
Логин: ${username}
Имя: ${fullName}

`;
}

/* ---------- Telegram sendMessage ---------- */
async function tgSendMessage(text: string) {
  const botToken = process.env.BOT_TOKEN || "";
  const ownerChatId = process.env.OWNER_CHAT_ID || "";

  if (!botToken || !ownerChatId) {
    console.error("Missing env", { hasBotToken: !!botToken, hasOwnerChatId: !!ownerChatId });
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

  const bodyText = await tgRes.text();
  if (!tgRes.ok) {
    console.error("Telegram sendMessage failed", { status: tgRes.status, body: bodyText });
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
      user?: any; // tg.initDataUnsafe.user
    };

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    // ✅ Авторизация: сначала пробуем initData, если он есть и валиден
    let authorized = false;

    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (ok) authorized = true;
      else console.error("Bad initData (will try secret fallback)");
    }

    // ✅ Фолбэк: если initData нет/битый — пускаем по секрету (как у тебя было)
    if (!authorized && serverSecret && secret && secret === serverSecret) {
      authorized = true;
    }

    if (!authorized) {
      console.error("Unauthorized notify", {
        hasInitData: !!initData,
        hasSecret: !!secret,
        hasServerSecret: !!serverSecret,
      });
      return new Response("Unauthorized", { status: 403 });
    }

    // ✅ Пользователь: приоритет body.user (initDataUnsafe.user), потом initData
    const parsedUser = user ?? (initData ? parseUserFromInitData(initData) : null);
    const userBlock = formatUserBlock(parsedUser);

    return await tgSendMessage(userBlock + messageText);
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}

export async function GET() {
  return Response.json({ ok: true, hint: "notify-owner endpoint. Use POST." });
}
