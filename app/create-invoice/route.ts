import crypto from "node:crypto";

export const runtime = "nodejs";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

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
    const body = (await req.json()) as { initData?: string; secret?: string };
    const initData = String(body.initData || "");
    const secret = String(body.secret || "");

    const botToken = getEnv("BOT_TOKEN");

    // можно оставить как у тебя: initData либо секрет
    if (initData) {
      const ok = verifyTelegramInitData(initData, botToken);
      if (!ok) return new Response("Bad initData", { status: 403 });
    } else {
      const serverSecret = process.env.NOTIFY_SECRET || "";
      if (!serverSecret || !secret || secret !== serverSecret) {
        return new Response("Unauthorized", { status: 403 });
      }
    }

    const stars = Number(process.env.STARS_FULL_REPORT_PRICE || "49");
    if (!Number.isFinite(stars) || stars <= 0) {
      return new Response("Bad STARS_FULL_REPORT_PRICE", { status: 500 });
    }

    // ⚠️ Stars-инвойс: currency = XTR, provider_token НЕ ПЕРЕДАЁМ
    const invoiceLinkData = await tgCall("createInvoiceLink", {
      title: "Полный отчёт DISC",
      description: "Откроется полный отчёт: отношения, алкоголь, работа, бизнес, сексуальная жизнь.",
      payload: `full_report_${Date.now()}`, // любой уникальный payload
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
