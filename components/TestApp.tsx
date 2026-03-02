"use client";

import React, { useEffect, useMemo, useState } from "react";
import { QUESTIONS_RU } from "../lib/questions.ru";
import {
  computeScores,
  rankColors,
  colorEmoji,
  colorLabel,
  shortTips,
  type Color,
} from "../lib/scoring";
import { tgSafeInit, getTgWebApp } from "../lib/telegram";

type Stage = "start" | "test" | "result";

const MAX_Q = 40;
const STORAGE_KEY = "disc_colors_answers_v1";

// ✅ NEW: сохраняем факт оплаты полного отчёта
const PAID_FULL_KEY = "disc_colors_paid_full_v1";

function clampScore(v: number) {
  if (v < 0) return 0;
  if (v > 3) return 3;
  return v;
}

type TgUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

function formatUserBlock(user?: TgUser | null) {
  if (!user) return ""; // если открыто не из TG — блока не будет

  const username = user.username ? `@${user.username}` : "—";
  const fullName =
    [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";

  return `👤 Пользователь:
ID: ${user.id}
Логин: ${username}
Имя: ${fullName}

`;
}

/* ===================== NEW: Отношения + Алкоголь + Работа + Бизнес + Секс ===================== */

function relationTips(color: Color): string[] {
  switch (color) {
    case "red":
      return [
        "нужны уважение, прямота и действия (а не «разговоры ради разговоров»)",
        "может давить и «вести» — важны чёткие границы и договорённости",
        "реагирует на тормоза/неопределённость — успокаивает конкретика",
        "лучше работает формат: цель → план → срок → результат",
      ];
    case "yellow":
      return [
        "нужны эмоции, внимание, новизна и общение",
        "может флиртовать/распыляться — спасают тёплые договорённости",
        "плохо переносит холод и игнор — лучше чаще проявляться",
        "любит совместные впечатления: поездки, события, идеи",
      ];
    case "green":
      return [
        "про стабильность, заботу и ощущение «мы команда»",
        "избегает конфликтов — важно говорить мягко, но прямо",
        "раскрывается через безопасность и регулярность",
        "ценит верность, поддержку и спокойный быт без драм",
      ];
    case "blue":
      return [
        "нужны смысл, надёжность и интеллектуальная близость",
        "может держать дистанцию — нужно время и доверие",
        "конфликты решает фактами и логикой, не эмоциями",
        "ценит уважение к границам и предсказуемость",
      ];
  }
}

function alcoholTips(color: Color): string[] {
  switch (color) {
    case "red":
      return [
        "становится ещё прямее и смелее; может сильнее «давить»",
        "легко уходит в режим «я решаю» — лучше держать градус и темп",
        "если злится — пауза/вода/смена темы работают лучше всего",
      ];
    case "yellow":
      return [
        "больше эмоций, шуток и общения; легко «разгоняется»",
        "возможны импульсивные решения и лишние обещания",
        "лучше держать рамки: вода/еда/тайминг/без догонов",
      ];
    case "green":
      return [
        "становится мягче и теплее, больше разговоров «по душам»",
        "может соглашаться на лишнее, чтобы не портить атмосферу",
        "лучше спокойная компания и безопасный темп",
      ];
    case "blue":
      return [
        "может либо уйти в наблюдение/молчание, либо в философию",
        "контроль снижается — важно не перегружать разговорами",
        "если устал — лучше домой, чем «досиживать из вежливости»",
      ];
  }
}

function workTips(color: Color): string[] {
  switch (color) {
    case "red":
      return [
        "берёт ответственность и быстро принимает решения",
        "любит цели, KPI и влияние на результат",
        "может быть резким — спасают правила коммуникации",
        "лучше раскрывается там, где есть скорость и конкуренция",
      ];
    case "yellow":
      return [
        "тащит коммуникацию, креатив и атмосферу",
        "вдохновляет, продаёт идею, легко знакомится",
        "хуже с рутиной — помогают дедлайны и короткие задачи",
        "работает через интерес/признание/новизну",
      ];
    case "green":
      return [
        "надёжный командный игрок, держит стабильность процессов",
        "силён в поддержке, сервисе, координации и «дожиме»",
        "не любит конфликты — важна спокойная среда",
        "раскрывается в долгих проектах и устойчивых командах",
      ];
    case "blue":
      return [
        "аналитика, качество, системность, стандарты",
        "любит данные и чёткие критерии",
        "может тормозить из-за перфекционизма — нужны рамки по времени",
        "силён в экспертных и сложных задачах",
      ];
  }
}

function businessTips(color: Color): string[] {
  switch (color) {
    case "red":
      return [
        "силён в масштабировании, переговорах и жёстких решениях",
        "идёт в риск, если видит награду",
        "важно не «ломать» людей — нужна культура и правила",
        "лучше всего в росте и конкурентной среде",
      ];
    case "yellow":
      return [
        "силён в маркетинге, бренде и продажах через эмоции",
        "генерит направления и быстро тестирует гипотезы",
        "может распыляться — помогает операционный контур/партнёр",
        "лучше всего в публичности, комьюнити и инфоповодах",
      ];
    case "green":
      return [
        "силён в удержании клиентов, сервисе и доверии",
        "строит стабильный бизнес через повторные продажи",
        "может избегать резких шагов — помогает драйвер рядом",
        "силён в процессах и заботе о команде",
      ];
    case "blue":
      return [
        "силён в продукте, финансах и юнит-экономике",
        "строит систему, метрики и контроль качества",
        "может долго готовиться — нужны дедлайны и MVP",
        "лучше всего в нишах, где важны стандарты и экспертность",
      ];
  }
}

/* ✅ NEW: Сексуальная жизнь (без жести, 18+ не нужно) */
function sexTips(color: Color): string[] {
  switch (color) {
    case "red":
      return [
        "инициативный и прямой: любит скорость и понятные сигналы",
        "важны страсть, драйв и ощущение «я нужен/нужна»",
        "может доминировать — спасают договорённости и обратная связь",
        "лучше всего: динамика + уважение к границам",
      ];
    case "yellow":
      return [
        "про игру, флирт, эмоции и атмосферу",
        "важна новизна и внимание к нему/ней",
        "может загораться быстро — помогает разнообразие и легкость",
        "лучше всего: юмор + инициативность + комплименты",
      ];
    case "green":
      return [
        "про нежность, заботу и безопасность",
        "важны доверие, тактильность и стабильная близость",
        "плохо переносит грубость и холод",
        "лучше всего: мягкость + «я рядом» + предсказуемость",
      ];
    case "blue":
      return [
        "про качество и комфорт: нужно время «разогнаться»",
        "важны уважение, границы и чистая коммуникация",
        "может быть сдержанным — раскрывается через доверие",
        "лучше всего: спокойный темп + понятные желания + безопасная атмосфера",
      ];
  }
}

/* ===================== NEW: ПОНЯТНЫЙ ПРОФИЛЬ (название + суть) ===================== */

function profileTitle(
  top1: Color,
  top2: Color
): {
  title: string;
  subtitle: string;
  desc: string;
  resource: string[];
  decisions: string[];
  role: string[];
} {
  const key = `${top1}+${top2}`;

  const pack: Record<
    string,
    {
      title: string;
      subtitle: string;
      desc: string;
      resource: string[];
      decisions: string[];
      role: string[];
    }
  > = {
    "red+yellow": {
      title: "🔴🟡 Драйвер-Коммуникатор",
      subtitle: "Ведёшь людей и заражаешь энергией",
      desc:
        "Ты про скорость, влияние и движение вперёд, но делаешь это через эмоции, общение и публичность. Легко зажигаешь, убеждаешь и запускаешь новое.",
      resource: [
        "энергия и харизма",
        "быстрый старт и смелость",
        "умение продавать идею",
      ],
      decisions: [
        "быстро, по ощущениям и выгоде",
        "если есть цель — действуешь сразу",
        "нужны рамки, чтобы не распыляться",
      ],
      role: [
        "лидер запуска / вдохновитель команды",
        "переговорщик / лицо проекта",
        "инициатор изменений",
      ],
    },
    "yellow+red": {
      title: "🟡🔴 Вдохновитель-Драйвер",
      subtitle: "Сначала эмоция, потом действие",
      desc:
        "Ты зажигаешь атмосферой и идеями, а потом включаешь скорость и результат. Хорошо ведёшь людей через настроение, но умеешь и «дожать».",
      resource: ["общение и влияние", "смелость и напор", "быстрые продажи"],
      decisions: [
        "отталкиваешься от интереса/эмоции",
        "потом включаешь цель и дедлайн",
        "важно фиксировать договорённости",
      ],
      role: [
        "продажи / маркетинг / публичность",
        "лидер команды по энергии",
        "инициатор новых направлений",
      ],
    },

    "red+blue": {
      title: "🔴🔵 Лидер-Стратег",
      subtitle: "Результат + система",
      desc:
        "Ты про победу и контроль результата, но опираешься на логику, факты и структуру. Сильный управленец: ставишь цель, строишь систему, требуешь качество.",
      resource: [
        "жёсткая ясность целей",
        "аналитика и контроль качества",
        "решительность",
      ],
      decisions: [
        "быстро, но по данным",
        "любишь критерии и метрики",
        "не терпишь хаос и «водичку»",
      ],
      role: [
        "управленец / руководитель",
        "стратегия и планирование",
        "переговоры и контроль",
      ],
    },
    "blue+red": {
      title: "🔵🔴 Стратег-Лидер",
      subtitle: "Сначала логика, потом действие",
      desc:
        "Ты думаешь системно и глубоко, а затем включаешь напор. Умеешь принимать жёсткие решения, но хочешь понимать причинно-следственные связи.",
      resource: [
        "системное мышление",
        "качество и стандарты",
        "воля к результату",
      ],
      decisions: [
        "через анализ → план → действие",
        "нужны факты и критерии",
        "лучше работает дедлайн, чтобы не «дополировать»",
      ],
      role: [
        "продукт / аналитика / финансы",
        "управление через систему",
        "архитектор процессов",
      ],
    },

    "red+green": {
      title: "🔴🟢 Лидер-Опора",
      subtitle: "Двигаешь вперёд и удерживаешь стабильность",
      desc:
        "Ты умеешь вести и давать скорость, но при этом держишь команду и отношения. Включаешься, когда нужно «собрать людей» и довести до результата без хаоса.",
      resource: ["влияние + забота", "умение договариваться", "устойчивость в кризисе"],
      decisions: [
        "быстро, но с оглядкой на людей",
        "важно понимать риски для команды",
        "лучше всего: конкретика + поддержка",
      ],
      role: ["руководитель команды", "операционный лидер", "антикризисный «сборщик»"],
    },
    "green+red": {
      title: "🟢🔴 Опора-Лидер",
      subtitle: "Стабильность + сила",
      desc:
        "Ты спокойный и надёжный, но когда нужно — включаешь жёсткость и берёшь управление. Люди тебе доверяют, потому что ты без истерик доводишь до конца.",
      resource: ["стабильность и доверие", "выдержка", "умение довести до результата"],
      decisions: [
        "сначала выслушаешь и оценишь",
        "потом принимаешь решение и продавливаешь реализацию",
        "важно заранее обозначать границы",
      ],
      role: ["тимлид / наставник", "операционка и сервис", "управление людьми"],
    },

    "yellow+green": {
      title: "🟡🟢 Коммуникатор-Дипломат",
      subtitle: "Лёгкость + забота",
      desc:
        "Ты про людей: умеешь создавать атмосферу, объединять и поддерживать. Часто становишься «клеем» команды: чтобы всем было комфортно и продуктивно.",
      resource: ["эмпатия и тепло", "коммуникации", "умение объединять"],
      decisions: [
        "через эмоции и отношения",
        "важно одобрение/поддержка",
        "нужны простые правила, чтобы не тянуть",
      ],
      role: ["комьюнити / HR / аккаунтинг", "сервис и поддержка", "командная динамика"],
    },
    "green+yellow": {
      title: "🟢🟡 Дипломат-Коммуникатор",
      subtitle: "Сначала безопасность, потом эмоции",
      desc:
        "Ты создаёшь ощущение «мы вместе», а дальше добавляешь лёгкость и общение. Хорошо удерживаешь людей и отношения в долгую.",
      resource: ["надёжность", "забота", "коммуникация без давления"],
      decisions: [
        "если спокойно и безопасно — решение быстрее",
        "избегаешь конфликтов",
        "помогает чёткая рамка и сроки",
      ],
      role: ["аккаунт / сервис / поддержка", "координатор", "внутренняя коммуникация"],
    },

    "yellow+blue": {
      title: "🟡🔵 Идейный-Аналитик",
      subtitle: "Креатив + смысл",
      desc:
        "Ты генеришь идеи и умеешь их объяснять логикой. Хорошо чувствуешь людей, но любишь, чтобы всё было «по уму» и с аргументами.",
      resource: ["креатив", "коммуникация", "умение структурировать идеи"],
      decisions: [
        "сначала вдохновение, затем проверка фактами",
        "любишь обсудить варианты",
        "важно не застревать в сомнениях",
      ],
      role: ["маркетинг/контент с аналитикой", "презентации и смыслы", "продуктовые гипотезы"],
    },
    "blue+yellow": {
      title: "🔵🟡 Аналитик-Коммуникатор",
      subtitle: "Логика, которую умеют слушать",
      desc:
        "Ты рациональный и системный, но можешь доносить мысли легко и интересно. Сильная сторона — объяснять сложное простым языком и влиять аргументами.",
      resource: ["структура", "ясная речь", "качество решений"],
      decisions: [
        "через факты и критерии",
        "потом «упаковка» для людей",
        "нужны паузы, чтобы всё обдумать",
      ],
      role: ["аналитика/продукт", "презентации и обучение", "экспертная коммуникация"],
    },

    "green+blue": {
      title: "🟢🔵 Спокойный-Системный",
      subtitle: "Надёжность + качество",
      desc:
        "Ты про стабильность, предсказуемость и высокий стандарт. Умеешь держать процессы, детали и качество, и делать так, чтобы всё работало без драм.",
      resource: ["надёжность", "качество и внимание к деталям", "спокойствие"],
      decisions: [
        "взвешенно и аккуратно",
        "важны факты и безопасность",
        "нужен план и понятные шаги",
      ],
      role: ["операционка/качество", "процессы и регламенты", "поддержка команды"],
    },
    "blue+green": {
      title: "🔵🟢 Системный-Дипломат",
      subtitle: "Структура + человечность",
      desc:
        "Ты строишь понятные правила и процессы, но делаешь это мягко: без лишнего давления. Сильный стабилизатор для команд и проектов.",
      resource: ["система", "логика", "умение держать баланс"],
      decisions: [
        "через анализ и оценку рисков",
        "важно согласование и ясность",
        "лучше заранее договориться о правилах",
      ],
      role: ["процессы и контроль качества", "координация", "наставник/эксперт"],
    },
  };

  const fallback = {
    title: `${colorEmoji(top1)}${colorEmoji(top2)} Профиль`,
    subtitle: "Твой стиль поведения и коммуникации",
    desc:
      "Это сочетание сильных сторон двух ведущих цветов. Первый — как ты действуешь чаще всего, второй — как ты дополняешь себя в коммуникации и решениях.",
    resource: [
      "сильные стороны двух ведущих цветов",
      "гибкость в поведении",
      "адаптация к ситуациям",
    ],
    decisions: [
      "ориентируешься на ведущий цвет",
      "второй цвет помогает балансировать",
      "лучше работают ясные договорённости",
    ],
    role: [
      "комбинация ролей двух цветов",
      "влияние зависит от контекста",
      "сильнее всего там, где есть ясные правила игры",
    ],
  };

  return pack[key] || fallback;
}

function formatExtraBlocksForReport(
  top1: { color: Color },
  top2: { color: Color }
) {
  const list = (items: string[]) => items.map((x) => `• ${x}`).join("\n");

  const rel1 = relationTips(top1.color);
  const rel2 = relationTips(top2.color);
  const alc1 = alcoholTips(top1.color);
  const alc2 = alcoholTips(top2.color);

  const w1 = workTips(top1.color);
  const w2 = workTips(top2.color);
  const b1 = businessTips(top1.color);
  const b2 = businessTips(top2.color);

  const s1 = sexTips(top1.color);
  const s2 = sexTips(top2.color);

  return `

💞 Отношения:

${colorEmoji(top1.color)} ${colorLabel(top1.color)}:
${list(rel1)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)}:
${list(rel2)}

🍷 Алкоголь:

${colorEmoji(top1.color)} ${colorLabel(top1.color)}:
${list(alc1)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)}:
${list(alc2)}

💼 Работа:

${colorEmoji(top1.color)} ${colorLabel(top1.color)}:
${list(w1)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)}:
${list(w2)}

📈 Бизнес:

${colorEmoji(top1.color)} ${colorLabel(top1.color)}:
${list(b1)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)}:
${list(b2)}

🔥 Сексуальная жизнь:

${colorEmoji(top1.color)} ${colorLabel(top1.color)}:
${list(s1)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)}:
${list(s2)}
`;
}

/* ===================== APP ===================== */

export default function TestApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [index, setIndex] = useState<number>(0); // 0..39
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isTg, setIsTg] = useState(false);

  // ✅ сохраняем, кто проходит тест
  const [tgUser, setTgUser] = useState<TgUser | null>(null);

  // ✅ NEW: оплачено ли открытие полного отчёта
  const [paidFull, setPaidFull] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const { isTg } = tgSafeInit();
    setIsTg(isTg);

    // ✅ берём юзера сразу при открытии Mini App
    try {
      const tg = getTgWebApp();
      const user = (tg as any)?.initDataUnsafe?.user as TgUser | undefined;
      if (user?.id) setTgUser(user);
    } catch {
      // ignore
    }

    // ✅ восстановление состояния
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          answers?: Record<number, number>;
          index?: number;
          stage?: Stage;
          tgUser?: TgUser | null;
        };
        if (parsed.answers) setAnswers(parsed.answers);
        if (typeof parsed.index === "number") setIndex(parsed.index);
        if (parsed.stage) setStage(parsed.stage);
        if (parsed.tgUser?.id) setTgUser(parsed.tgUser);
      }
    } catch {
      // ignore
    }

    // ✅ NEW: восстановление оплаты
    try {
      const paidRaw = localStorage.getItem(PAID_FULL_KEY);
      if (paidRaw) {
        const parsedPaid = JSON.parse(paidRaw) as { paidFull?: boolean };
        if (parsedPaid?.paidFull) setPaidFull(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ answers, index, stage, tgUser })
      );
    } catch {
      // ignore
    }
  }, [answers, index, stage, tgUser]);

  // ✅ NEW: сохраняем оплату
  useEffect(() => {
    try {
      localStorage.setItem(PAID_FULL_KEY, JSON.stringify({ paidFull }));
    } catch {
      // ignore
    }
  }, [paidFull]);

  const q = QUESTIONS_RU[index];

  const progress = useMemo(() => {
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / MAX_Q) * 100);
  }, [answers]);

  const isComplete = useMemo(
    () => Object.keys(answers).length >= MAX_Q,
    [answers]
  );

  const canPrev = stage === "test" && index > 0;
  const canNext = stage === "test" && index < MAX_Q - 1;

  const selected = answers[q?.id ?? 1];

  const scores = useMemo(() => computeScores(answers), [answers]);
  const ranked = useMemo(() => rankColors(scores), [scores]);

  function start() {
    setStage("test");
    setIndex(0);

    // ✅ если вдруг tgUser ещё не успел проставиться — пробуем ещё раз
    try {
      const tg = getTgWebApp();
      const user = (tg as any)?.initDataUnsafe?.user as TgUser | undefined;
      if (user?.id) setTgUser(user);
    } catch {
      // ignore
    }
  }

  function reset() {
    setAnswers({});
    setIndex(0);
    setStage("start");
    setPaidFull(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(PAID_FULL_KEY);
    } catch {
      // ignore
    }
  }

  // ✅ Отчёт: базовый всегда, полный — только если full=true
  function shareText(full: boolean) {
    const top1 = ranked[0];
    const top2 = ranked[1];
    const botLink = "https://t.me/MaryPortfolioBot";

    const t1 = shortTips(top1.color);
    const t2 = shortTips(top2.color);

    const list = (items: string[]) => items.map((x) => `• ${x}`).join("\n");

    const triggers = [...t1.triggers, ...t2.triggers].slice(0, 6);
    const howToTalk = [...t1.howToTalk, ...t2.howToTalk].slice(0, 8);

    const userBlock = formatUserBlock(tgUser);
    const extra = full ? formatExtraBlocksForReport(top1, top2) : "";

    const paidMark = full
      ? "\n✅ Полный отчёт: ОПЛАЧЕНО ⭐\n"
      : "\n⚠️ Полный отчёт: НЕ ОПЛАЧЕН ⭐\n";

    const p = profileTitle(top1.color, top2.color);

    // ✅ без цифр + без «Мой профиль DISC» и «Все результаты»
    return `${userBlock}Твой профиль:
${p.title}
${p.subtitle}

${p.desc}

Ведущие стили:
${colorEmoji(top1.color)} ${colorLabel(top1.color)}
${colorEmoji(top2.color)} ${colorLabel(top2.color)}

${paidMark}
💎 Твой главный ресурс:
${list(p.resource)}

🧠 Как ты принимаешь решения:
${list(p.decisions)}

🤝 Твоя роль в команде:
${list(p.role)}

Сильные стороны:
${list([...t1.strengths, ...t2.strengths].slice(0, 8))}

Триггеры:
${list(triggers)}

Как с тобой общаться:
${list(howToTalk)}${extra}

Пройти тест: ${botLink}`;
  }

  async function notifyOwner(full: boolean) {
    try {
      const tg = getTgWebApp();

      const initData = tg?.initData || "";
      const user = (tg as any)?.initDataUnsafe?.user || null;

      const text = shareText(full);

      await fetch("/api/notify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initData,
          user,
          text,
          secret: process.env.NEXT_PUBLIC_NOTIFY_SECRET || "",
        }),
      });
    } catch {
      // ignore
    }
  }

  // ✅ NEW: отправка отчёта пользователю в личку бота
  async function sendReportToUser(full: boolean) {
    try {
      if (!tgUser?.id) return;

      const text = shareText(full);

      await fetch("/api/send-user-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: tgUser.id,
          text,
        }),
      });
    } catch {
      // ignore
    }
  }

  // ✅ NEW: оплата Stars и после оплаты — отправляем полный отчёт
  async function payStarsAndUnlock() {
    try {
      const tg = getTgWebApp() as any;

      if (!tg) {
        alert("Открой Mini App внутри Telegram, иначе оплата недоступна.");
        return;
      }

      setPaying(true);

      const initData = tg.initData || "";
      if (!initData) {
        alert("initData не найден. Открой Mini App из Telegram-бота.");
        return;
      }

      const res = await fetch("/api/create-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });

      const raw = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(raw);
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg =
          data?.error ||
          data?.reason ||
          data?.telegram_json?.description ||
          raw ||
          `HTTP ${res.status}`;
        alert(`Ошибка создания счёта:\n${msg}`);
        return;
      }

      const invoiceLink = String(data?.invoiceLink || "");
      if (!invoiceLink) {
        alert(`Не удалось получить ссылку на оплату:\n${raw}`);
        return;
      }

      // ✅ 1) основной путь (если поддерживается)
      if (typeof tg.openInvoice === "function") {
        tg.openInvoice(invoiceLink, async (status: string) => {
          if (status === "paid") {
            setPaidFull(true);
            await notifyOwner(true);
            await sendReportToUser(true);
          }
        });
        return;
      }

      // ✅ 2) fallback: откроет ссылку инвойса внутри Telegram
      if (typeof tg.openLink === "function") {
        tg.openLink(invoiceLink);
        return;
      }

      // ✅ 3) самый простой fallback
      window.location.href = invoiceLink;
    } catch (e: any) {
      console.error(e);
      alert(`Ошибка оплаты:\n${String(e?.message || e)}`);
    } finally {
      setPaying(false);
    }
  }

  function setAnswer(value: number) {
    const v = clampScore(value);
    const id = q.id;

    setAnswers((prev) => ({ ...prev, [id]: v }));

    if (index < MAX_Q - 1) {
      setIndex((i) => i + 1);
    } else {
      setStage("result");

      // ✅ базовый отчёт сразу (без платных блоков) — OWNER + ПОЛЬЗОВАТЕЛЮ
      void notifyOwner(false);
      void sendReportToUser(false);
    }
  }

  function prev() {
    if (!canPrev) return;
    setIndex((i) => i - 1);
  }

  function next() {
    if (!canNext) return;
    setIndex((i) => i + 1);
  }

  function finish() {
    setStage("result");
    if (isComplete) {
      void notifyOwner(false);
      void sendReportToUser(false);
    }
  }

  async function share() {
    const text = shareText(paidFull);

    try {
      await navigator.clipboard.writeText(text);
      alert(isTg ? "Скопировано. Вставь в чат и отправь 👍" : "Скопировано 👍");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Скопировано 👍");
    }
  }

  const shellStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 22,
    paddingTop: "calc(env(safe-area-inset-top) + 100px)",
    color: "rgba(255,255,255,0.95)",
    WebkitTextSizeAdjust: "100%",
  };

  return (
    <div style={shellStyle}>
      <AmbientBackground />

      <Header progress={stage === "test" ? progress : undefined} />

      {stage === "start" && (
        <GlassCard>
          <h1
            style={{
              marginTop: 0,
              marginBottom: 10,
              fontSize: 22,
              letterSpacing: 0.2,
            }}
          >
            Тест по психотипам (4 цвета)
          </h1>

          <p style={{ marginTop: 0, opacity: 0.88, lineHeight: 1.45 }}>
            Узнай свой стиль поведения и коммуникации. Оцени каждое утверждение:
            0 (не про меня) … 3 (точно про меня).
          </p>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
              fontSize: 14,
            }}
          >
            <GlassDisclosure
              title="🔴 Красный — результат, скорость, лидерство"
              body={
                <>
                  <p style={p0}>Кто это: лидер, драйвер, человек действия.</p>
                  <div style={h}>Сильные стороны:</div>
                  <ul style={ul}>
                    <li style={li}>быстро принимает решения</li>
                    <li style={li}>не боится ответственности</li>
                    <li style={li}>нацелен на результат</li>
                    <li style={li}>умеет давить и ускорять</li>
                  </ul>
                  <p style={p1}>
                    <b>Мотивация:</b> победа, влияние, достижение целей.
                  </p>
                  <p style={p1}>
                    <b>Триггеры:</b> медлительность, слабость, неопределённость.
                  </p>
                </>
              }
            />

            <GlassDisclosure
              title="🟡 Жёлтый — энергия, идеи, общение"
              body={
                <>
                  <p style={p0}>
                    Кто это: вдохновитель, генератор идей, коммуникатор.
                  </p>
                  <div style={h}>Сильные стороны:</div>
                  <ul style={ul}>
                    <li style={li}>харизма</li>
                    <li style={li}>лёгкость в общении</li>
                    <li style={li}>креатив</li>
                    <li style={li}>умеет зажигать людей</li>
                  </ul>
                  <p style={p1}>
                    <b>Мотивация:</b> признание, свобода, эмоции.
                  </p>
                  <p style={p1}>
                    <b>Триггеры:</b> рутина, жёсткие рамки, критика без
                    поддержки.
                  </p>
                </>
              }
            />

            <GlassDisclosure
              title="🟢 Зелёный — стабильность, поддержка, команда"
              body={
                <>
                  <p style={p0}>Кто это: командный игрок, дипломат, опора.</p>
                  <div style={h}>Сильные стороны:</div>
                  <ul style={ul}>
                    <li style={li}>терпение</li>
                    <li style={li}>надёжность</li>
                    <li style={li}>эмпатия</li>
                    <li style={li}>умеет слушать</li>
                  </ul>
                  <p style={p1}>
                    <b>Мотивация:</b> гармония, безопасность, стабильность.
                  </p>
                  <p style={p1}>
                    <b>Триггеры:</b> конфликты, давление, резкие изменения.
                  </p>
                </>
              }
            />

            <GlassDisclosure
              title="🔵 Синий — логика, анализ, системность"
              body={
                <>
                  <p style={p0}>
                    Кто это: аналитик, стратег, системный мыслитель.
                  </p>
                  <div style={h}>Сильные стороны:</div>
                  <ul style={ul}>
                    <li style={li}>внимание к деталям</li>
                    <li style={li}>логика</li>
                    <li style={li}>структурность</li>
                    <li style={li}>высокий стандарт качества</li>
                  </ul>
                  <p style={p1}>
                    <b>Мотивация:</b> точность, факты, компетентность.
                  </p>
                  <p style={p1}>
                    <b>Триггеры:</b> хаос, поверхностность, эмоциональное
                    давление.
                  </p>
                </>
              }
            />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <GlassButton onClick={start}>Начать тест</GlassButton>

            {Object.keys(answers).length > 0 && (
              <GlassButton onClick={() => setStage("test")}>
                Продолжить
              </GlassButton>
            )}
          </div>

          <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
            * Упрощённая модель (DISC-подобная). Результат — подсказка, не
            диагноз.
          </div>
        </GlassCard>
      )}

      {stage === "test" && (
        <GlassCard>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Вопрос {index + 1} / {MAX_Q}
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              Ответов: {Object.keys(answers).length}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.35 }}>
            {q.text}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginTop: 16,
            }}
          >
            <AnswerButton active={selected === 0} onClick={() => setAnswer(0)}>
              0
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>
                не про меня
              </span>
            </AnswerButton>
            <AnswerButton active={selected === 1} onClick={() => setAnswer(1)}>
              1
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>
                иногда
              </span>
            </AnswerButton>
            <AnswerButton active={selected === 2} onClick={() => setAnswer(2)}>
              2
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>
                часто
              </span>
            </AnswerButton>
            <AnswerButton active={selected === 3} onClick={() => setAnswer(3)}>
              3
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>
                это я
              </span>
            </AnswerButton>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 16,
              flexWrap: "wrap",
            }}
          >
            <GlassButton onClick={reset}>Начать сначала</GlassButton>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", gap: 10 }}>
              <GlassButton disabled={!canPrev} onClick={prev}>
                Назад
              </GlassButton>
              <GlassButton disabled={!canNext} onClick={next}>
                Вперёд
              </GlassButton>
              {isComplete && (
                <GlassButton onClick={finish}>Результат</GlassButton>
              )}
            </div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
            Совет: отвечай быстро, как чувствуешь.
          </div>
        </GlassCard>
      )}

      {stage === "result" && (
        <GlassCard>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22 }}>
            Твой профиль
          </h2>

          <div style={{ marginTop: 14 }}>
            <GlassInset>
              <TopSummary ranked={ranked} paidFull={paidFull} />
            </GlassInset>
          </div>

          {/* ✅ кнопка оплаты полного отчёта */}
          {!paidFull && (
            <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <GlassButton onClick={payStarsAndUnlock} disabled={paying}>
                {paying ? "Открываю оплату…" : "⭐ Открыть полный отчёт"}
              </GlassButton>
              <div style={{ opacity: 0.75, fontSize: 12, lineHeight: 1.35 }}>
                Полный отчёт откроет разделы: Отношения, Алкоголь, Работа,
                Бизнес, Сексуальная жизнь.
              </div>
            </div>
          )}

          {paidFull && (
            <div style={{ marginTop: 12, opacity: 0.85, fontSize: 12 }}>
              ✅ Полный отчёт открыт ⭐
            </div>
          )}

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <GlassButton onClick={share}>Поделиться (скопировать)</GlassButton>
            <GlassButton onClick={() => setStage("test")}>
              Вернуться к вопросам
            </GlassButton>
            <GlassButton onClick={reset}>Пройти заново</GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ---------- текстовые стили ---------- */
const p0: React.CSSProperties = {
  margin: "10px 0 0",
  opacity: 0.88,
  lineHeight: 1.45,
};
const p1: React.CSSProperties = {
  margin: "10px 0 0",
  opacity: 0.88,
  lineHeight: 1.45,
};
const h: React.CSSProperties = { marginTop: 10, fontWeight: 800, opacity: 0.95 };
const ul: React.CSSProperties = {
  margin: "6px 0 0 18px",
  padding: 0,
  lineHeight: 1.35,
  opacity: 0.95,
};
const li: React.CSSProperties = { marginTop: 4 };

/* ===================== фон ===================== */

function AmbientBackground() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background:
          "radial-gradient(900px 500px at 20% 10%, rgba(120,170,255,0.28), transparent 60%)," +
          "radial-gradient(900px 500px at 80% 20%, rgba(255,120,200,0.22), transparent 55%)," +
          "radial-gradient(900px 500px at 50% 90%, rgba(120,255,210,0.18), transparent 60%)," +
          "linear-gradient(180deg, #0B0F16 0%, #070A0F 100%)",
      }}
    />
  );
}

/* ===================== SOLID UI ===================== */

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 22,
        backgroundColor: "rgba(26,32,46,0.98)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        color: "rgba(255,255,255,0.95)",
        overflow: "hidden",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      {children}
    </div>
  );
}

function GlassInset({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        backgroundColor: "rgba(42,50,70,0.98)",
        border: "1px solid rgba(255,255,255,0.18)",
        color: "rgba(255,255,255,0.95)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      {children}
    </div>
  );
}

function GlassButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      style={{
        borderRadius: 18,
        padding: "12px 14px",
        backgroundColor: disabled
          ? "rgba(60,70,90,0.6)"
          : "rgba(42,50,70,0.98)",
        border: "1px solid rgba(255,255,255,0.22)",
        color: "rgba(255,255,255,0.95)",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        letterSpacing: 0.2,
        boxShadow: "0 6px 16px rgba(0,0,0,0.25)",
        WebkitTapHighlightColor: "transparent",
        appearance: "none",
        WebkitAppearance: "none",
        opacity: disabled ? 0.55 : 1,
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      {children}
    </button>
  );
}

function AnswerButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 18,
        padding: 12,
        backgroundColor: active
          ? "rgba(64,76,104,0.98)"
          : "rgba(42,50,70,0.98)",
        border: active
          ? "1px solid rgba(255,255,255,0.40)"
          : "1px solid rgba(255,255,255,0.22)",
        color: "rgba(255,255,255,0.95)",
        cursor: "pointer",
        textAlign: "center",
        boxShadow: active
          ? "0 10px 24px rgba(0,0,0,0.28)"
          : "0 6px 16px rgba(0,0,0,0.18)",
        WebkitTapHighlightColor: "transparent",
        appearance: "none",
        WebkitAppearance: "none",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      {children}
    </button>
  );
}

function GlassDisclosure({
  title,
  body,
}: {
  title: string;
  body: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: "rgba(42,50,70,0.98)",
        border: "1px solid rgba(255,255,255,0.18)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
        overflow: "hidden",
        backdropFilter: "none",
        WebkitBackdropFilter: "none",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
          padding: "10px 12px",
          userSelect: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          color: "rgba(255,255,255,0.95)",
          fontWeight: 800,
          background: "transparent",
          border: "none",
          WebkitTapHighlightColor: "transparent",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        <span>{title}</span>
        <span
          style={{
            opacity: 0.85,
            fontWeight: 900,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        >
          ⌄
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 12px 12px", color: "rgba(255,255,255,0.92)" }}>
          {body}
        </div>
      )}
    </div>
  );
}

function Header({ progress }: { progress?: number }) {
  if (typeof progress !== "number") return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          marginTop: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden",
          backdropFilter: "none",
          WebkitBackdropFilter: "none",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.75)",
          }}
        />
      </div>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 900 }}>
        {title}
      </div>
      <ul
        style={{
          margin: "6px 0 0 18px",
          padding: 0,
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {items.map((x) => (
          <li key={x} style={{ marginTop: 4 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopSummary({
  ranked,
  paidFull,
}: {
  ranked: { color: Color; value: number }[];
  paidFull: boolean;
}) {
  const top1 = ranked[0];
  const top2 = ranked[1];

  const t1 = shortTips(top1.color);
  const t2 = shortTips(top2.color);

  const r1 = relationTips(top1.color);
  const r2 = relationTips(top2.color);

  const a1 = alcoholTips(top1.color);
  const a2 = alcoholTips(top2.color);

  const w1 = workTips(top1.color);
  const w2 = workTips(top2.color);

  const b1 = businessTips(top1.color);
  const b2 = businessTips(top2.color);

  const s1 = sexTips(top1.color);
  const s2 = sexTips(top2.color);

  const profile = profileTitle(top1.color, top2.color);

  return (
    <div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "rgba(255,255,255,0.95)",
        }}
      >
        Твой профиль: {profile.title}
      </div>

      <div style={{ marginTop: 6, opacity: 0.92, fontWeight: 800 }}>
        {profile.subtitle}
      </div>

      <div style={{ marginTop: 8, opacity: 0.88, lineHeight: 1.45 }}>
        {profile.desc}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <Section title="💎 Твой главный ресурс" items={profile.resource} />
        <Section title="🧠 Как ты принимаешь решения" items={profile.decisions} />
        <Section title="🤝 Твоя роль в команде" items={profile.role} />

        <TipBlock
          title={`${colorEmoji(top1.color)} ${colorLabel(top1.color)} — сильные стороны`}
          items={t1.strengths}
        />
        <TipBlock
          title={`${colorEmoji(top2.color)} ${colorLabel(top2.color)} — сильные стороны`}
          items={t2.strengths}
        />
        <TipBlock
          title="Триггеры"
          items={[...t1.triggers, ...t2.triggers].slice(0, 3)}
        />
        <TipBlock
          title="Как с тобой общаться"
          items={[...t1.howToTalk, ...t2.howToTalk].slice(0, 4)}
        />

        {/* ✅ платные блоки показываем только после оплаты */}
        {paidFull && (
          <>
            <TipBlock
              title={`💞 Отношения — ${colorEmoji(top1.color)} ${colorLabel(
                top1.color
              )}`}
              items={r1}
            />
            <TipBlock
              title={`💞 Отношения — ${colorEmoji(top2.color)} ${colorLabel(
                top2.color
              )}`}
              items={r2}
            />

            <TipBlock
              title={`🍷 Алкоголь — ${colorEmoji(top1.color)} ${colorLabel(
                top1.color
              )}`}
              items={a1}
            />
            <TipBlock
              title={`🍷 Алкоголь — ${colorEmoji(top2.color)} ${colorLabel(
                top2.color
              )}`}
              items={a2}
            />

            <TipBlock
              title={`💼 Работа — ${colorEmoji(top1.color)} ${colorLabel(
                top1.color
              )}`}
              items={w1}
            />
            <TipBlock
              title={`💼 Работа — ${colorEmoji(top2.color)} ${colorLabel(
                top2.color
              )}`}
              items={w2}
            />

            <TipBlock
              title={`📈 Бизнес — ${colorEmoji(top1.color)} ${colorLabel(
                top1.color
              )}`}
              items={b1}
            />
            <TipBlock
              title={`📈 Бизнес — ${colorEmoji(top2.color)} ${colorLabel(
                top2.color
              )}`}
              items={b2}
            />

            <TipBlock
              title={`🔥 Сексуальная жизнь — ${colorEmoji(
                top1.color
              )} ${colorLabel(top1.color)}`}
              items={s1}
            />
            <TipBlock
              title={`🔥 Сексуальная жизнь — ${colorEmoji(
                top2.color
              )} ${colorLabel(top2.color)}`}
              items={s2}
            />
          </>
        )}
      </div>
    </div>
  );
}

function TipBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 13,
          opacity: 0.9,
          fontWeight: 800,
          color: "rgba(255,255,255,0.95)",
        }}
      >
        {title}
      </div>
      <ul
        style={{
          margin: "6px 0 0 18px",
          padding: 0,
          lineHeight: 1.35,
          color: "rgba(255,255,255,0.92)",
        }}
      >
        {items.map((x) => (
          <li key={x} style={{ marginTop: 4 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
