export type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;

  // Telegram добавляет методы не везде, поэтому держим опциональными
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;

  MainButton?: {
    setText: (t: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };

  initData?: string;
  initDataUnsafe?: any;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTgWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

export function tgSafeInit() {
  const tg = getTgWebApp();
  if (!tg) return { tg: null, isTg: false };

  try {
    tg.ready();

    // ✅ максимально раскрыть WebApp
    tg.expand();

    // ✅ если доступно — просим фуллскрин (не на всех клиентах Telegram)
    tg.requestFullscreen?.();

    // ✅ iOS: помогает убрать лишние жесты
    tg.disableVerticalSwipes?.();
  } catch {
    // ignore
  }

  return { tg, isTg: true };
}
