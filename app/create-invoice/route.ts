// app/api/create-invoice/route.ts  (или src/app/api/create-invoice/route.ts)
import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const obj: Record<string, string> = {};
  params.forEach((v, k) => (obj[k] = v));
  return obj;
}

function verifyTelegramWebAppInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "initData has no hash" };

  params.delete("hash");

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    return { ok: false, reason: "hash mismatch" };
  }
  return { ok: true as const };
}

export async function POST(req: Request) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    if (!botToken) {
      return NextResponse.json(
        { error: "Missing env TELEGRAM_BOT_TOKEN" },
        { status: 500 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | { initData?: string }
      | null;

    const initData = (body?.initData || "").trim();
    if (!initData) {
      return NextResponse.json(
        { error: "Missing initData in body" },
        { status: 400 }
      );
    }

    const check = verifyTelegramWebAppInitData(initData, botToken);
    if (!check.ok) {
      return NextResponse.json(
        { error: "Bad initData", reason: check.reason },
        { status: 401 }
      );
    }

    const initObj = parseInitData(initData);

    let userId: number | null = null;
    if (initObj.user) {
      try {
        const u = JSON.parse(initObj.user) as { id?: number };
        if (u?.id) userId = u.id;
      } catch {
        // ignore
      }
    }

    const stars = Number(process.env.FULL_REPORT_PRICE_STARS || "49");
    const amount = Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 49;

    const payload = `full_report_${userId ?? "unknown"}_${Date.now()}`;

    const telegramRes = await fetch(
      `https://api.telegram.org/bot${botToken}/createInvoiceLink`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Полный отчёт DISC",
          description:
            "Открывает разделы: Отношения, Алкоголь, Работа, Бизнес, Сексуальная жизнь.",
          payload,
          currency: "XTR",
          prices: [{ label: "Полный отчёт", amount }],
          provider_token: "",
        }),
      }
    );

    const telegramJson = await telegramRes.json().catch(() => null);

    if (!telegramRes.ok || !telegramJson?.ok) {
      return NextResponse.json(
        {
          error: "Telegram createInvoiceLink failed",
          telegram_status: telegramRes.status,
          telegram_json: telegramJson,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoiceLink: telegramJson.result as string });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Internal error", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
