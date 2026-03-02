export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function tgCall(method: string, payload: any) {
  const token = getEnv("BOT_TOKEN");
  const url = `https://api.telegram.org/bot${token}/${method}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.ok) {
    console.error("Telegram API error:", { method, status: res.status, data });
    throw new Error(`Telegram API error: ${method}`);
  }

  return data;
}

export async function POST(req: Request) {
  try {
    const { initData } = (await req.json()) as { initData?: string };

    // initData тут не “валидируем”, потому что это ONLY для открытия инвойса из TG.
    // Верификация у тебя уже есть в notify-owner. Тут задача — просто создать ссылку.
    if (!initData) return new Response("Missing initData", { status: 400 });

    const stars = Number(process.env.STARS_FULL_REPORT_PRICE || "49");
    if (!Number.isFinite(stars) || stars <= 0) {
      return new Response("Bad STARS_FULL_REPORT_PRICE", { status: 500 });
    }

    // Stars invoice: currency = XTR, provider_token НЕ передаём
    const invoiceLinkData = await tgCall("createInvoiceLink", {
      title: "Полный отчёт DISC",
      description:
        "Откроется полный отчёт: отношения, алкоголь, работа, бизнес, сексуальная жизнь.",
      payload: `full_report_${Date.now()}`,
      currency: "XTR",
      prices: [{ label: "Полный отчёт", amount: stars }],
    });

    const invoiceLink = String(invoiceLinkData?.result || "");
    if (!invoiceLink) return new Response("No invoice link", { status: 502 });

    return Response.json({ ok: true, invoiceLink, stars });
  } catch (e: any) {
    console.error("create-invoice error", e);
    return new Response("Server error", { status: 500 });
  }
}
