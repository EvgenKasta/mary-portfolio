import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    web_app_data?: { data: string; button_text?: string };
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

function formatUserBlock(from?: TgUpdate["message"]["from"]) {
  const username = from?.username ? `@${from.username}` : "без username";
  const fullName = [from?.first_name, from?.last_name].filter(Boolean).join(" ") || "не указано";
  const userId = from?.id ? String(from.id) : "unknown";

  return (
    `👤 Пользователь:\n` +
    `ID: ${userId}\n` +
    `Логин: ${username}\n` +
    `Имя: ${fullName}\n\n`
  );
}

export async function POST(req: Request) {
  let update: TgUpdate | null = null;

  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const appUrl = getEnv("APP_URL"); // например https://mary-portfolio-xyz.vercel.app
    const ownerChatId = getEnv("OWNER_CHAT_ID");

    const msg = update?.message;
    const text = msg?.text || "";
    const chatId = msg?.chat?.id;

    if (!chatId) return NextResponse.json({ ok: true });

    // ✅ 1) /start
    if (text.startsWith("/start")) {
      const caption =
        "Привет! 👋\n\nЭто тест DISC Colors.\nНажми кнопку ниже — открою тест ✅";

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

    // ✅ 2) Результат из WebApp через Telegram.WebApp.sendData()
    const webData = msg?.web_app_data?.data;
    if (webData) {
      // webData может быть plain текстом или JSON — поддержим оба
      let reportText = webData;
      try {
        const parsed = JSON.parse(webData);
        if (typeof parsed?.text === "string") reportText = parsed.text;
      } catch {
        // not json
      }

      const finalText = formatUserBlock(msg?.from) + String(reportText || "").trim();

      await tgCall("sendMessage", {
        chat_id: ownerChatId,
        text: finalText,
        disable_web_page_preview: true,
      });

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
