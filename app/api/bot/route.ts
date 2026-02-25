import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
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

  // Telegram будет долбить вебхук, нам важно отвечать 200 быстро
  // поэтому: минимум логики + без падений
  try {
    const appUrl = getEnv("APP_URL"); // например https://mary-portfolio-xyz.vercel.app
    const msg = update?.message;
    const text = msg?.text || "";
    const chatId = msg?.chat?.id;

    if (!chatId) return NextResponse.json({ ok: true });

    // /start (и /start payload)
    if (text.startsWith("/start")) {
      const caption =
        "Привет! 👋\n\nЭто тест DISC Colors.\nНажми кнопку ниже — открою тест ✅\n\n(Откроется в режиме WebApp)";

      // Вариант 1: отправляем картинку по URL (лучший для Vercel)
      // Поставь START_PHOTO_URL в env (например, картинка на CDN/telegra.ph/discord/любая https ссылка)
      const photoUrl = process.env.START_PHOTO_URL;

      if (photoUrl) {
        await tgCall("sendPhoto", {
          chat_id: chatId,
          photo: photoUrl,
          caption,
          reply_markup: startKeyboard(appUrl),
        });
      } else {
        // Вариант 2: если нет картинки — просто текст + кнопка
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: caption,
          reply_markup: startKeyboard(appUrl),
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Можно игнорить остальные сообщения
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("bot webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}

// (не обязательно, но удобно) чтобы Telegram мог проверять GET
export async function GET() {
  return NextResponse.json({ ok: true, hint: "Telegram webhook endpoint. Use POST." });
}
