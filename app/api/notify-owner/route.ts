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

export async function POST(req: Request) {
  const { initData, text } = (await req.json()) as { initData?: string; text?: string };

  const botToken = process.env.BOT_TOKEN;
  const ownerChatId = process.env.OWNER_CHAT_ID;

  if (!botToken || !ownerChatId) {
    return new Response("Missing env", { status: 500 });
  }

  if (!initData || !verifyTelegramInitData(initData, botToken)) {
    return new Response("Bad initData", { status: 403 });
  }

  // кто прошёл тест (для удобства)
  const params = new URLSearchParams(initData);
  const userRaw = params.get("user");

  let who = "unknown";
  try {
    if (userRaw) {
      const u = JSON.parse(userRaw);
      who = `${u.first_name || ""}${u.last_name ? " " + u.last_name : ""}`.trim();
      if (u.username) who += ` (@${u.username})`;
      who += ` | id=${u.id}`;
    }
  } catch {
    // ignore
  }

  const msg = `✅ Пройден тест DISC\n👤 ${who}\n\n${text || ""}`;

  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerChatId,
      text: msg,
      disable_web_page_preview: true,
    }),
  });

  if (!r.ok) {
    const err = await r.text().catch(() => "");
    return new Response(`Telegram error: ${err}`, { status: 500 });
  }

  return Response.json({ ok: true });
}
