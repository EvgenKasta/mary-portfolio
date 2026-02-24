export async function POST(req: Request) {
  const { text } = await req.json();

  const botToken = process.env.BOT_TOKEN;
  const ownerChatId = process.env.OWNER_CHAT_ID;

  if (!botToken || !ownerChatId) {
    return new Response("Missing env", { status: 500 });
  }

  const msg = `✅ Новый результат теста\n\n${text}`;

  const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: ownerChatId,
      text: msg,
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    return new Response(`Telegram error: ${err}`, { status: 500 });
  }

  return Response.json({ ok: true });
}
