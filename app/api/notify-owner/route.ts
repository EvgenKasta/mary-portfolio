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

async function tgSendMessage(text: string) {
  const botToken = process.env.BOT_TOKEN || "";
  const ownerChatId = process.env.OWNER_CHAT_ID || "";

  if (!botToken || !ownerChatId) {import crypto from "node:crypto";

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

  let tgBody: any = tgBodyText;
  try {
    tgBody = JSON.parse(tgBodyText);
  } catch {}

  return Response.json({ ok: true, telegram: tgBody });
}

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

    // ✅ Вариант А: если пришёл initData — валидируем по Telegram (как у тебя было)
    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) {
        console.error("Bad initData");
        return new Response("Bad initData", { status: 403 });
      }
      return await tgSendMessage(messageText);
    }

    // ✅ Вариант Б: если initData нет — пускаем по секрету (надёжно во всех кейсах)
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
