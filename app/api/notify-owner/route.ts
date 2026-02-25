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

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return !!hash && hmac === hash;
}

export async function POST(req: Request) {
  try {
    const { initData, text } = (await req.json()) as {
      initData?: string;
      text?: string;
    };

    const botToken = process.env.BOT_TOKEN || "";
    const ownerChatId = process.env.OWNER_CHAT_ID || "";

    if (!botToken || !ownerChatId) {
      console.error("Missing env", { hasBotToken: !!botToken, hasOwnerChatId: !!ownerChatId });
      return new Response("Missing env", { status: 500 });
    }

    if (!initData) {
      console.error("Missing initData");
      return new Response("Missing initData", { status: 403 });
    }

    if (!verifyTelegramInitData(initData, botToken)) {
      console.error("Bad initData");
      return new Response("Bad initData", { status: 403 });
    }

    const payload = {
      chat_id: ownerChatId,
      text: String(text || ""),
      disable_web_page_preview: true,
    };

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const tgBodyText = await tgRes.text();

    if (!tgRes.ok) {
      console.error("Telegram sendMessage failed", {
        status: tgRes.status,
        body: tgBodyText,
      });
      return new Response("Telegram API error", { status: 502 });
    }

    // (опционально) распарсим, чтобы было удобнее смотреть
    let tgBody: any = tgBodyText;
    try {
      tgBody = JSON.parse(tgBodyText);
    } catch {}

    return Response.json({ ok: true, telegram: tgBody });
  } catch (e: any) {
    console.error("notify-owner route error", e);
    return new Response("Server error", { status: 500 });
  }
}
