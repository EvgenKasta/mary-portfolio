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

function formatUserBlock(user: any) {
  const username = user?.username ? `@${user.username}` : "без username";
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ");
  return `👤 Пользователь:
ID: ${user?.id ?? "unknown"}
Логин: ${username}
Имя: ${fullName || "не указано"}`;
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

  return Response.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const { initData, text, secret, user } = (await req.json()) as {
      initData?: string;
      text?: string;
      secret?: string;
      user?: any; // ✅ юзер из tg.initDataUnsafe.user
    };

    const botToken = process.env.BOT_TOKEN || "";
    const serverSecret = process.env.NOTIFY_SECRET || "";

    const messageText = String(text || "").trim();
    if (!messageText) return new Response("Empty text", { status: 400 });

    // ---- AUTH (оставляем как было, чтобы НЕ сломать рабочее) ----
    let authorized = false;

    // Вариант A: initData
    if (initData && botToken) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (ok) authorized = true;
    }

    // Вариант B: secret (основной у тебя сейчас)
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

    // ---- USER BLOCK ----
    // Берём user из body (самый надёжный). Если нет — пробуем вытащить из initData.
    let resolvedUser: any = user ?? null;

    if (!resolvedUser && initData) {
      try {
        const params = new URLSearchParams(initData);
        const userRaw = params.get("user");
        if (userRaw) resolvedUser = JSON.parse(userRaw);
      } catch {
        // ignore
      }
    }

    const finalText = resolvedUser
      ? `${formatUserBlock(resolvedUser)}\n\n${messageText}`
      : messageText;

    return await tgSendMessage(finalText);
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}
