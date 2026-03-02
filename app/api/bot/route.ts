import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TgUpdate = {
  update_id: number;

  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    successful_payment?: any;
  };

  pre_checkout_query?: {
    id: string;
    from: { id: number };
    currency: string;
    total_amount: number;
    invoice_payload: string;
  };
};

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
  }

  return { res, data };
}

function startKeyboard(appUrl: string) {
  return {
    inline_keyboard: [
      [
        {
          text: "🚀 Начать тест",
          web_app: { url: appUrl },
        },
      ],
    ],
  };
}

export async function POST(req: Request) {
  let update: TgUpdate | null = null;

  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    // 1) ✅ Stars payment: обязательно отвечаем на pre_checkout_query
    if (update?.pre_checkout_query) {
      const q = update.pre_checkout_query;

      // если хочешь — можешь проверять payload/currency
      const ok = true;

      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok,
      });

      return NextResponse.json({ ok: true });
    }

    const appUrl = getEnv("APP_URL");
    const msg = update?.message;
    const text = msg?.text || "";
    const chatId = msg?.chat?.id;

    if (!chatId) return NextResponse.json({ ok: true });

    // 2) (опционально) лог успешной оплаты
    if (msg?.successful_payment) {
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: "✅ Оплата получена! Возвращайся в приложение — полный отчёт уже доступен.",
      });

      return NextResponse.json({ ok: true });
    }

    // 3) /start
    if (text.startsWith("/start")) {
      const caption =
        "Привет! 👋\n\nЭто тест DISC Colors.\nНажми кнопку ниже — открою тест ✅\n\n(Откроется в режиме WebApp)";

      const photoUrl = process.env.START_PHOTO_URL;

      if (photoUrl) {
        await tgCall("sendPhoto", {
          chat_id: chatId,
          photo: photoUrl,
          caption,
          reply_markup: startKeyboard(appUrl),
        });
      } else {
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: caption,
          reply_markup: startKeyboard(appUrl),
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("bot webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "Telegram webhook endpoint. Use POST." });
}
