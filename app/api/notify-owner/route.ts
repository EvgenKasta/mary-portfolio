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

/* ---------- parse user ---------- */

type TgUser = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function parseUserFromInitData(initData: string): TgUser | null {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;

    // raw обычно уже декодирован URLSearchParams’ом, но на всякий случай:
    const json = raw.startsWith("{") ? raw : decodeURIComponent(raw);
    const u = JSON.parse(json);
    if (!u || typeof u !== "object") return null;

    return {
      id: typeof u.id === "number" ? u.id : undefined,
      username: typeof u.username === "string" ? u.username : undefined,
      first_name: typeof u.first_name === "string" ? u.first_name : undefined,
      last_name: typeof u.last_name === "string" ? u.last_name : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeUser(user: any): TgUser | null {
  if (!user || typeof user !== "object") return null;

  return {
    id: typeof user.id === "number" ? user.id : undefined,
    username: typeof user.username === "string" ? user.username : undefined,
    first_name: typeof user.first_name === "string" ? user.first_name : undefined,
    last_name: typeof user.last_name === "string" ? user.last_name : undefined,
  };
}

function formatUserBlock(u: TgUser | null) {
  const id = u?.id ?? "unknown";
  const username = u?.username ? `@${u.username}` : "без username";
  const fullName = [u?.first_name, u?.last_name].filter(Boolean).join(" ") || "не указано";

  return `👤 Пользователь:
ID: ${id}
Логин: ${username}
Имя: ${fullName}`;
}

/* ---------- telegram send ---------- */

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
    const { initData, text, secret, user } = (await req.json()) as {
      initData?: string;
      text?: string;
      secret?: string;
      user?: any; // tg.initDataUnsafe.user
    };

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    // Авторизация: initData ИЛИ secret
    let authorized = false;

    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) {
        console.error("Bad initData");
        return new Response("Bad initData", { status: 403 });
      }
      authorized = true;
    } else if (serverSecret && secret && secret === serverSecret) {
      authorized = true;
    }

    if (!authorized) {
      console.error("Unauthorized notify", {
        hasInitData: !!initData,
        hasUser: !!user,
        hasSecret: !!secret,
        hasServerSecret: !!serverSecret,
      });
      return new Response("Unauthorized", { status: 403 });
    }

    // ✅ Юзер: сначала берём из body.user (самый надёжный), потом из initData
    const bodyUser = normalizeUser(user);
    const initUser = initData ? parseUserFromInitData(initData) : null;
    const finalUser = bodyUser || initUser;

    const finalText = `${formatUserBlock(finalUser)}\n\n${messageText}`;

    return await tgSendMessage(finalText);
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}
