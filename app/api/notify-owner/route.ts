import crypto from "node:crypto";

export const runtime = "nodejs";

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

type TgUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function normalizeUser(u: any): TgUser | null {
  if (!u || typeof u !== "object") return null;

  return {
    id: typeof u.id === "number" ? u.id : undefined,
    username: typeof u.username === "string" ? u.username : undefined,
    first_name: typeof u.first_name === "string" ? u.first_name : undefined,
    last_name: typeof u.last_name === "string" ? u.last_name : undefined,
  };
}

function parseUserFromInitData(initData: string): TgUser | null {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;

    // URLSearchParams обычно уже декодит, но iOS/клиенты иногда присылают по-разному — страхуемся
    const maybeJson = userRaw.startsWith("{") ? userRaw : decodeURIComponent(userRaw);
    const parsed = JSON.parse(maybeJson);
    return normalizeUser(parsed);
  } catch {
    return null;
  }
}

function formatUserBlock(user: TgUser | null) {
  const id = user?.id ?? "unknown";
  const username = user?.username ? `@${user.username}` : "без username";
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "не указано";

  return `👤 Пользователь:
ID: ${id}
Логин: ${username}
Имя: ${fullName}`;
}

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

  // оставляю как было — чтобы ты мог смотреть ответ телеги, если надо
  let tgBody: any = tgBodyText;
  try {
    tgBody = JSON.parse(tgBodyText);
  } catch {}

  return Response.json({ ok: true, telegram: tgBody });
}

export async function POST(req: Request) {
  try {
    const { initData, text, secret, user } = (await req.json()) as {
      initData?: string;
      text?: string;
      secret?: string;
      user?: any; // если ты решишь присылать tg.initDataUnsafe.user — не обязаловка
    };

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    // ✅ Вариант А: initData → проверяем как раньше (это твой рабочий путь)
    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) {
        console.error("Bad initData");
        return new Response("Bad initData", { status: 403 });
      }

      // ✅ ДОБАВЛЕНО: юзер — сначала из body.user (если пришёл), иначе из initData
      const u = normalizeUser(user) || parseUserFromInitData(initData);
      const finalText = `${formatUserBlock(u)}\n\n${messageText}`;

      return await tgSendMessage(finalText);
    }

    // ✅ Вариант Б: secret → как раньше (чтобы ничего не сломать)
    if (serverSecret && secret && secret === serverSecret) {
      // Тут initData может не быть — тогда юзера взять неоткуда,
      // но если ты передал user из клиента — покажем его.
      const u = normalizeUser(user);
      const finalText = u ? `${formatUserBlock(u)}\n\n${messageText}` : messageText;

      return await tgSendMessage(finalText);
    }

    console.error("Unauthorized notify", {
      hasInitData: !!initData,
      hasSecret: !!secret,
      hasServerSecret: !!serverSecret,
      hasUser: !!user,
    });
    return new Response("Unauthorized", { status: 403 });
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}
