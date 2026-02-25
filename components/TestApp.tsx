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
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "—";

  return `👤 Пользователь:
ID: ${user.id}
Логин: ${username}
Имя: ${fullName}

`;
}

export default function TestApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [index, setIndex] = useState<number>(0); // 0..39
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isTg, setIsTg] = useState(false);

  // ✅ сохраняем, кто проходит тест
  const [tgUser, setTgUser] = useState<TgUser | null>(null);

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
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // ✅ Отчёт теперь начинается с блока пользователя (если он есть)
  function shareText() {
    const top1 = ranked[0];
    const top2 = ranked[1];
    const botLink = "https://t.me/MaryPortfolioBot";

    const t1 = shortTips(top1.color);
    const t2 = shortTips(top2.color);

    const list = (items: string[]) => items.map((x) => `• ${x}`).join("\n");

    const triggers = [...t1.triggers, ...t2.triggers].slice(0, 6);
    const howToTalk = [...t1.howToTalk, ...t2.howToTalk].slice(0, 8);

    const userBlock = formatUserBlock(tgUser);

    return `${userBlock}Мой профиль DISC:
${colorEmoji(top1.color)} ${colorLabel(top1.color)} — ${top1.value}
${colorEmoji(top2.color)} ${colorLabel(top2.color)} — ${top2.value}

Все результаты:
🔴 Красный: ${scores.red}/30
🟡 Жёлтый: ${scores.yellow}/30
🟢 Зелёный: ${scores.green}/30
🔵 Синий: ${scores.blue}/30

Пояснение результата:

${colorEmoji(top1.color)} ${colorLabel(top1.color)} — сильные стороны:
${list(t1.strengths)}

${colorEmoji(top2.color)} ${colorLabel(top2.color)} — сильные стороны:
${list(t2.strengths)}

Триггеры:
${list(triggers)}

Как с тобой общаться:
${list(howToTalk)}

Пройти тест: ${botLink}`;
  }

  async function notifyOwner() {
  try {
    const tg = getTgWebApp();

    const initData = tg?.initData || "";

    // ✅ достаём user максимально надёжно:
    // 1) пробуем tg.initDataUnsafe.user
    // 2) если пусто — парсим из initData параметр user
    let user: any = (tg as any)?.initDataUnsafe?.user || null;

    if (!user && initData) {
      try {
        const p = new URLSearchParams(initData);
        const userRaw = p.get("user");
        if (userRaw) user = JSON.parse(userRaw);
      } catch {
        // ignore
      }
    }

    const username = user?.username ? `@${user.username}` : "без username";
    const fullName =
      [user?.first_name, user?.last_name].filter(Boolean).join(" ") || "не указано";
    const userId = user?.id ? String(user.id) : "unknown";

    const userBlock =
      `👤 Пользователь:\n` +
      `ID: ${userId}\n` +
      `Логин: ${username}\n` +
      `Имя: ${fullName}\n\n`;

    const messageText = (userBlock + shareText()).trim();

    const secret = (process.env.NEXT_PUBLIC_NOTIFY_SECRET || "").trim();

    const body: any = { text: messageText, secret };
    if (initData) body.initData = initData;

    const res = await fetch("/api/notify-owner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      console.error("notifyOwner failed:", res.status, t);
    }
  } catch (e) {
    console.error("notifyOwner crash:", e);
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
      void notifyOwner();
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
    if (isComplete) void notifyOwner();
  }

  async function share() {
    const text = shareText();

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

          <div style={{ marginTop: 14, display: "grid", gap: 10, fontSize: 14 }}>
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
                    <b>Триггеры:</b> рутина, жёсткие рамки, критика без поддержки.
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
                    <b>Триггеры:</b> хаос, поверхностность, эмоциональное давление.
                  </p>
                </>
              }
            />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <GlassButton onClick={start}>Начать тест</GlassButton>

            {Object.keys(answers).length > 0 && (
              <GlassButton onClick={() => setStage("test")}>Продолжить</GlassButton>
            )}
          </div>

          <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
            * Упрощённая модель (DISC-подобная). Результат — подсказка, не диагноз.
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
            Результат
          </h2>

          <ScoreRow color="red" value={scores.red} />
          <ScoreRow color="yellow" value={scores.yellow} />
          <ScoreRow color="green" value={scores.green} />
          <ScoreRow color="blue" value={scores.blue} />

          <div style={{ marginTop: 14 }}>
            <GlassInset>
              <TopSummary ranked={ranked} />
            </GlassInset>
          </div>

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
const p0: React.CSSProperties = { margin: "10px 0 0", opacity: 0.88, lineHeight: 1.45 };
const p1: React.CSSProperties = { margin: "10px 0 0", opacity: 0.88, lineHeight: 1.45 };
const h: React.CSSProperties = { marginTop: 10, fontWeight: 800, opacity: 0.95 };
const ul: React.CSSProperties = { margin: "6px 0 0 18px", padding: 0, lineHeight: 1.35, opacity: 0.95 };
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
        backgroundColor: disabled ? "rgba(60,70,90,0.6)" : "rgba(42,50,70,0.98)",
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
        backgroundColor: active ? "rgba(64,76,104,0.98)" : "rgba(42,50,70,0.98)",
        border: active ? "1px solid rgba(255,255,255,0.40)" : "1px solid rgba(255,255,255,0.22)",
        color: "rgba(255,255,255,0.95)",
        cursor: "pointer",
        textAlign: "center",
        boxShadow: active ? "0 10px 24px rgba(0,0,0,0.28)" : "0 6px 16px rgba(0,0,0,0.18)",
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

function GlassDisclosure({ title, body }: { title: string; body: React.ReactNode }) {
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

function ScoreRow({ color, value }: { color: Color; value: number }) {
  const max = 30;
  const pct = Math.round((value / max) * 100);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
          {colorEmoji(color)} {colorLabel(color)}
        </div>
        <div style={{ opacity: 0.8, color: "rgba(255,255,255,0.88)" }}>
          {value} / {max}
        </div>
      </div>

      <div
        style={{
          marginTop: 6,
          height: 10,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.62)",
          }}
        />
      </div>
    </div>
  );
}

function TopSummary({ ranked }: { ranked: { color: Color; value: number }[] }) {
  const top1 = ranked[0];
  const top2 = ranked[1];

  const t1 = shortTips(top1.color);
  const t2 = shortTips(top2.color);

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.95)" }}>
        Твой профиль: {colorEmoji(top1.color)} {colorLabel(top1.color)} +{" "}
        {colorEmoji(top2.color)} {colorLabel(top2.color)}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <TipBlock title={`${colorEmoji(top1.color)} ${colorLabel(top1.color)} — сильные стороны`} items={t1.strengths} />
        <TipBlock title={`${colorEmoji(top2.color)} ${colorLabel(top2.color)} — сильные стороны`} items={t2.strengths} />
        <TipBlock title="Триггеры" items={[...t1.triggers, ...t2.triggers].slice(0, 3)} />
        <TipBlock title="Как с тобой общаться" items={[...t1.howToTalk, ...t2.howToTalk].slice(0, 4)} />
      </div>
    </div>
  );
}

function TipBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.9, fontWeight: 800, color: "rgba(255,255,255,0.95)" }}>
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
