import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TgUpdate = {
  update_id: number;
  message?: {
    message_id: number;
    text?: string;
    chat: { id: number };
    from?: {
      id: number;
      username?: string;
      first_name?: string;
      last_name?: string;
      language_code?: string;
    };
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

function formatUser(from?: TgUpdate["message"]["from"]) {
  if (!from) {
    return `👤 Новый пользователь (/start):
ID: unknown
Логин: без username
Имя: не указано`;
  }

  const username = from.username ? `@${from.username}` : "без username";
  const fullName =
    [from.first_name, from.last_name].filter(Boolean).join(" ").trim() || "не указано";

  return `👤 Новый пользователь (/start):
ID: ${from.id}
Логин: ${username}
Имя: ${fullName}
Язык: ${from.language_code || "—"}`;
}

/**
 * Telegram может прислать один и тот же update повторно.
 * Делаем лёгкую дедупликацию в памяти (работает в рамках одного инстанса).
 * Для Vercel это не 100% глобально, но очень часто убирает тройные сообщения.
 */
const seen = new Set<number>();
function isDuplicate(updateId: number) {
  if (seen.has(updateId)) return true;
  seen.add(updateId);
  // чистим память
  if (seen.size > 5000) {
    const arr = Array.from(seen);
    for (let i = 0; i < 2000; i++) seen.delete(arr[i]);
  }
  return false;
}

export async function POST(req: Request) {
  let update: TgUpdate | null = null;

  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const msg = update?.message;
    const text = msg?.text || "";
    const chatId = msg?.chat?.id;
    const updateId = update?.update_id;

    if (!chatId || !updateId) return NextResponse.json({ ok: true });

    // ✅ Дедуп: если прилетел повтор — молча игнорим
    if (isDuplicate(updateId)) return NextResponse.json({ ok: true });

    // /start (и /start payload)
    if (text.startsWith("/start")) {
      const appUrl = getEnv("APP_URL"); // https://xxxx.vercel.app
      const ownerChatId = process.env.OWNER_CHAT_ID; // куда слать тебе
      const caption =
        "Привет! 👋\n\nЭто тест DISC Colors.\nНажми кнопку ниже — открою тест ✅\n\n(Откроется в режиме WebApp)";

      // 1) Сообщение пользователю (картинка опционально)
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

      // 2) Сообщение ТЕБЕ о новом пользователе
      if (ownerChatId) {
        await tgCall("sendMessage", {
          chat_id: ownerChatId,
          text: formatUser(msg?.from),
          disable_web_page_preview: true,
        });
      } else {
        console.warn("OWNER_CHAT_ID is not set — skip owner notify for /start");
      }

      return NextResponse.json({ ok: true });
    }

    // Остальные сообщения игнорим
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("bot webhook error:", e);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: "Telegram webhook endpoint. Use POST." });
}
