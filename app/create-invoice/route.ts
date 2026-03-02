import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST() {
  try {
    const botToken = process.env.BOT_TOKEN || "";
    if (!botToken) return new Response("Missing BOT_TOKEN", { status: 500 });

    // Цена в звёздах (XTR). Можешь поменять.
    const STARS_AMOUNT = 49;

    const payload = `full_report_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Полный отчёт DISC",
        description: "Откроет разделы: Отношения, Алкоголь, Работа, Бизнес, Сексуальная жизнь.",
        payload,
        provider_token: "", // ✅ для Stars — пустая строка
        currency: "XTR", // ✅ Stars
        prices: [{ label: "Полный отчёт", amount: STARS_AMOUNT }],
      }),
    });

    const bodyText = await tgRes.text();

    if (!tgRes.ok) {
      console.error("createInvoiceLink failed", { status: tgRes.status, body: bodyText });
      return new Response("Invoice create failed", { status: 502 });
    }

    let json: any = null;
    try {
      json = JSON.parse(bodyText);
    } catch {
      console.error("createInvoiceLink bad json", bodyText);
      return new Response("Bad Telegram response", { status: 502 });
    }

    const invoiceLink = json?.result;
    if (!invoiceLink || typeof invoiceLink !== "string") {
      console.error("createInvoiceLink missing result", json);
      return new Response("No invoice link", { status: 502 });
    }

    return Response.json({ ok: true, invoiceLink });
  } catch (e) {
    console.error("create-invoice error", e);
    return new Response("Server error", { status: 500 });
  }
}
