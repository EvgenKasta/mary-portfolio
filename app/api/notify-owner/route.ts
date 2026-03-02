export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const botToken =
      process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
    const ownerChatId =
      process.env.OWNER_CHAT_ID || process.env.TELEGRAM_OWNER_CHAT_ID || "";

    if (!botToken) {
      return Response.json(
        { ok: false, error: "Missing env TELEGRAM_BOT_TOKEN (or BOT_TOKEN)" },
        { status: 500 }
      );
    }

    if (!ownerChatId) {
      return Response.json(
        { ok: false, error: "Missing env OWNER_CHAT_ID" },
        { status: 500 }
      );
    }

    const text = String(body?.text || "");
    if (!text) {
      return Response.json({ ok: false, error: "Missing text" }, { status: 400 });
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

    const tgJson = await tgRes.json().catch(() => null);

    if (!tgRes.ok) {
      return Response.json(
        { ok: false, error: "Telegram API error", details: tgJson },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Server error" },
      { status: 500 }
    );
  }
}
