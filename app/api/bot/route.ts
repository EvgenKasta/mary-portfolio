export const runtime = "nodejs";

type TgUpdate = {
  message?: {
    text?: string;
    chat?: { id: number };
    from?: { id: number; username?: string; first_name?: string; last_name?: string };
    successful_payment?: any;
  };
  pre_checkout_query?: {
    id: string;
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

  return data;
}

function startKeyboard(appUrl: string) {
  return {
    inline_keyboard: [[{ text: "🚀 Начать тест", web_app: { url: appUrl } }]],
  };
}

function formatNewUserBlock(from?: TgUpdate["message"]["from"]) {
  if (!from) return "👤 Новый пользователь: (unknown)";

  const username = from.username ? `@${from.username}` : "без username";
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ") || "не указано";

  return `👤 Новый пользователь:
ID: ${from.id}
Логин: ${username}
Имя: ${fullName}`;
}

export async function POST(req: Request) {
  let update: TgUpdate | null = null;

  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response("ok");
  }

  try {
    // ✅ Stars: обязательно отвечаем на pre_checkout_query
    if (update?.pre_checkout_query) {
      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: update.pre_checkout_query.id,
        ok: true,
      });
      return new Response("ok");
    }

    const msg = update?.message;
    const text = msg?.text || "";
    const chatId = msg?.chat?.id;

    if (!chatId) return new Response("ok");

    // (опционально) лог успешной оплаты
    if (msg?.successful_payment) {
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: "✅ Оплата получена! Полный отчёт открыт в приложении ⭐",
      });
      return new Response("ok");
    }

    // ✅ /start как было
    if (text.startsWith("/start")) {
      const appUrl = getEnv("APP_URL");

      const caption =
        "Привет! 👋\n\nЭто тест DISC Colors.\nНажми кнопку ниже — открою тест ✅";

      // приветствие пользователю
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: caption,
        reply_markup: startKeyboard(appUrl),
      });

      // ✅ уведомление владельцу о новом пользователе (ВОЗВРАЩАЕМ!)
      const ownerChatId = process.env.OWNER_CHAT_ID || "";
      if (ownerChatId) {
        await tgCall("sendMessage", {
          chat_id: ownerChatId,
          text: formatNewUserBlock(msg.from),
          disable_web_page_preview: true,
        });
      }

      return new Response("ok");
    }

    return new Response("ok");
  } catch (e) {
    console.error("bot route error", e);
    return new Response("ok");
  }
}

export async function GET() {
  return new Response("ok");
}
