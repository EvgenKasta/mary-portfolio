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
type TgUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
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

function formatUserBlock(user: TgUser | null) {
  if (!user) {
    return `👤 Пользователь:
ID: unknown
Логин: без username
Имя: не указано`;
  }

  const username = user.username ? `@${user.username}` : "без username";
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "не указано";

  return `👤 Пользователь:
ID: ${user.id ?? "unknown"}
Логин: ${username}
Имя: ${fullName}
Язык: ${user.language_code || "—"}`;
}

/* ---------- tg send ---------- */
async function tgSendMessage(text: string) {
  const botToken = process.env.BOT_TOKEN || "";
  const ownerChatId = process.env.OWNER_CHAT_ID || "";

  if (!botToken || !ownerChatId) {
    console.error("Missing env", { hasBotToken: !!botToken, hasOwnerChatId: !!ownerChatId });
    return new Response("Missing env", { status: 500 });
  }

  const payload = {
    chat_id: ownerChatId,
    text,
    disable_web_page_preview: true,
  };

  const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const tgBodyText = await tgRes.text();

  if (!tgRes.ok) {
    console.error("Telegram sendMessage failed", { status: tgRes.status, body: tgBodyText });
    return new Response("Telegram API error", { status: 502 });
  }

  return Response.json({ ok: true });
}

/* ---------- route ---------- */
export async function POST(req: Request) {
  try {
    const { initData, text, secret } = (await req.json()) as {
      initData?: string;
      text?: string;
      secret?: string;
    };

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    // ✅ Вариант A: initData → валидируем и берём user оттуда
    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) {
        console.error("Bad initData");
        return new Response("Bad initData", { status: 403 });
      }

      const user = parseUserFromInitData(initData);
      const finalText = `${formatUserBlock(user)}\n\n${messageText}`;

      return await tgSendMessage(finalText);
    }

    // ✅ Вариант B: без initData → пропускаем по секрету, но юзера тогда НЕ будет (это нормально)
    if (serverSecret && secret && secret === serverSecret) {
      return await tgSendMessage(messageText);
    }

    console.error("Unauthorized notify", {
      hasInitData: !!initData,
      hasSecret: !!secret,
      hasServerSecret: !!serverSecret,
    });
    return new Response("Unauthorized", { status: 403 });
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}
