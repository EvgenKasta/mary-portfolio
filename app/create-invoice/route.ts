export const runtime = "nodejs";

export async function POST() {
  try {
    const botToken = process.env.BOT_TOKEN || "";

    if (!botToken) {
      return Response.json(
        { ok: false, error: "Missing BOT_TOKEN env" },
        { status: 500 }
      );
    }

    const STARS_AMOUNT = 49; // ⭐ цена в звёздах
    const payload = `full_report_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Полный отчёт DISC",
          description:
            "Откроет разделы: Отношения, Алкоголь, Работа, Бизнес, Сексуальная жизнь.",
          payload,
          provider_token: "", // ✅ для Stars — пусто
          currency: "XTR", // ✅ Stars
          prices: [{ label: "Полный отчёт", amount: STARS_AMOUNT }],
        }),
      }
    );

    const raw = await tgRes.text();

    // Пытаемся распарсить что вернул Telegram
    let tgJson: any = null;
    try {
      tgJson = JSON.parse(raw);
    } catch {
      tgJson = null;
    }

    if (!tgRes.ok) {
      console.error("Telegram createInvoiceLink HTTP error:", tgRes.status, raw);
      return Response.json(
        {
          ok: false,
          where: "telegram_http",
          status: tgRes.status,
          telegram_raw: raw,
          telegram_json: tgJson,
        },
        { status: 502 }
      );
    }

    if (!tgJson?.ok || !tgJson?.result) {
      console.error("Telegram createInvoiceLink bad payload:", raw);
      return Response.json(
        {
          ok: false,
          where: "telegram_payload",
          telegram_raw: raw,
          telegram_json: tgJson,
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, invoiceLink: tgJson.result });
  } catch (e: any) {
    console.error("create-invoice route crash:", e);
    return Response.json(
      { ok: false, error: "Server error", details: String(e?.message || e) },
      { status: 500 }
    );
  }
}
