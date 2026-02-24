"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function TestApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [index, setIndex] = useState<number>(0); // 0..39
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isTg, setIsTg] = useState(false);

  useEffect(() => {
    const { isTg } = tgSafeInit();
    setIsTg(isTg);

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          answers?: Record<number, number>;
          index?: number;
          stage?: Stage;
        };
        if (parsed.answers) setAnswers(parsed.answers);
        if (typeof parsed.index === "number") setIndex(parsed.index);
        if (parsed.stage) setStage(parsed.stage);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers, index, stage }));
    } catch {
      // ignore
    }
  }, [answers, index, stage]);

  const q = QUESTIONS_RU[index];

  const progress = useMemo(() => {
    const answeredCount = Object.keys(answers).length;
    return Math.round((answeredCount / MAX_Q) * 100);
  }, [answers]);

  const isComplete = useMemo(() => Object.keys(answers).length >= MAX_Q, [answers]);

  const canPrev = stage === "test" && index > 0;
  const canNext = stage === "test" && index < MAX_Q - 1;

  const selected = answers[q?.id ?? 1];

  const scores = useMemo(() => computeScores(answers), [answers]);
  const ranked = useMemo(() => rankColors(scores), [scores]);

  function start() {
    setStage("test");
    setIndex(0);
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

  function setAnswer(value: number) {
    const v = clampScore(value);
    const id = q.id;
    setAnswers((prev) => ({ ...prev, [id]: v }));

    if (index < MAX_Q - 1) setIndex((i) => i + 1);
    else setStage("result");
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
  }

  function shareText() {
    const top1 = ranked[0];
    const top2 = ranked[1];
    return `Мой профиль: ${colorEmoji(top1.color)} ${colorLabel(top1.color)} (${top1.value}) + ${colorEmoji(
      top2.color
    )} ${colorLabel(top2.color)} (${top2.value}).\n\nПройти тест: ${
      typeof window !== "undefined" ? window.location.href : ""
    }`;
  }

  async function share() {
    const tg = getTgWebApp();
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

    void tg;
  }

  // 🍏 Liquid Glass shell + iPhone safe-area
  const shellStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    paddingLeft: 16,
    paddingRight: 16,
    paddingBottom: 22,
    paddingTop: "calc(env(safe-area-inset-top) + 16px)",
  };

  return (
    <div style={shellStyle}>
      <AmbientBackground />

      <Header progress={stage === "test" ? progress : undefined} />

      {stage === "start" && (
        <GlassCard>
          <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 22, letterSpacing: 0.2 }}>
            Тест по психотипам (4 цвета)
          </h1>

          <p style={{ marginTop: 0, opacity: 0.88, lineHeight: 1.45 }}>
            Узнай свой стиль поведения и коммуникации. Оцени каждое утверждение: 0 (не про меня) … 3 (точно про меня).
          </p>

          <div
            style={{
              marginTop: 14,
              display: "grid",
              gap: 10,
              fontSize: 14,
            }}
          >
            <GlassRow>🔴 <b>Красные</b> — результат, скорость, лидерство</GlassRow>
            <GlassRow>🟡 <b>Жёлтые</b> — энергия, идеи, общение</GlassRow>
            <GlassRow>🟢 <b>Зелёные</b> — стабильность, поддержка, команда</GlassRow>
            <GlassRow>🔵 <b>Синие</b> — логика, анализ, системность</GlassRow>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
            <GlassButton onClick={start}>Начать тест</GlassButton>

            {Object.keys(answers).length > 0 && (
              <GlassButton variant="ghost" onClick={() => setStage("test")}>
                Продолжить
              </GlassButton>
            )}
          </div>

          <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
            * Упрощённая модель (DISC-подобная). Результат — подсказка, не диагноз.
          </div>
        </GlassCard>
      )}

      {stage === "test" && (
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Вопрос {index + 1} / {MAX_Q}
            </div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              Ответов: {Object.keys(answers).length}
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.35 }}>
            {q.text}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            <GlassAnswerButton active={selected === 0} onClick={() => setAnswer(0)}>
              0
              <span style={{ display: "block", fontSize: 12, opacity: 0.65 }}>не про меня</span>
            </GlassAnswerButton>
            <GlassAnswerButton active={selected === 1} onClick={() => setAnswer(1)}>
              1
              <span style={{ display: "block", fontSize: 12, opacity: 0.65 }}>иногда</span>
            </GlassAnswerButton>
            <GlassAnswerButton active={selected === 2} onClick={() => setAnswer(2)}>
              2
              <span style={{ display: "block", fontSize: 12, opacity: 0.65 }}>часто</span>
            </GlassAnswerButton>
            <GlassAnswerButton active={selected === 3} onClick={() => setAnswer(3)}>
              3
              <span style={{ display: "block", fontSize: 12, opacity: 0.65 }}>это я</span>
            </GlassAnswerButton>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <GlassButton variant="ghost" disabled={!canPrev} onClick={prev}>
              Назад
            </GlassButton>
            <GlassButton variant="ghost" disabled={!canNext} onClick={next}>
              Вперёд
            </GlassButton>
            <div style={{ flex: 1 }} />
            {isComplete && <GlassButton onClick={finish}>Результат</GlassButton>}
          </div>

          <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
            Совет: отвечай быстро, как чувствуешь.
          </div>
        </GlassCard>
      )}

      {stage === "result" && (
        <GlassCard>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22 }}>Результат</h2>

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
            <GlassButton variant="ghost" onClick={() => setStage("test")}>
              Вернуться к вопросам
            </GlassButton>
            <GlassButton variant="ghost" onClick={reset}>
              Пройти заново
            </GlassButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ===================== 🍏 Liquid Glass UI ===================== */

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

function GlassCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 22,
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px) saturate(160%)",
        WebkitBackdropFilter: "blur(18px) saturate(160%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: -1,
          borderRadius: 22,
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.20), rgba(255,255,255,0.02) 35%, rgba(255,255,255,0.10))",
          pointerEvents: "none",
          mixBlendMode: "overlay",
          opacity: 0.7,
        }}
      />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function GlassInset({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
      }}
    >
      {children}
    </div>
  );
}

function GlassRow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 16,
        background: "rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
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
  variant = "solid",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
}) {
  const base: React.CSSProperties = {
    borderRadius: 18,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontWeight: 700,
    letterSpacing: 0.2,
    transition: "transform 0.08s ease, filter 0.08s ease",
  };

  const style: React.CSSProperties =
    variant === "solid"
      ? {
          ...base,
          color: "rgba(10,12,16,0.95)",
          background: "rgba(255,255,255,0.92)",
          boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
        }
      : {
          ...base,
          color: "rgba(255,255,255,0.92)",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.14)",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
        };

  return (
    <button
      type="button"
      style={style}
      onClick={disabled ? undefined : onClick}
      onPointerDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.98)";
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(0.98)";
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
      }}
      onPointerCancel={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
      }}
    >
      {children}
    </button>
  );
}

function GlassAnswerButton({
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
        border: active ? "1px solid rgba(255,255,255,0.42)" : "1px solid rgba(255,255,255,0.12)",
        background: active ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.92)",
        cursor: "pointer",
        textAlign: "center",
        backdropFilter: "blur(16px) saturate(150%)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
        boxShadow: active ? "0 10px 26px rgba(0,0,0,0.22)" : "none",
      }}
    >
      {children}
    </button>
  );
}

/* ===================== Existing logic components ===================== */

function Header({ progress }: { progress?: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 800, letterSpacing: 0.3, color: "rgba(255,255,255,0.92)" }}>DISC Colors</div>
        <div style={{ fontSize: 12, opacity: 0.7, color: "rgba(255,255,255,0.8)" }}>Mini App</div>
      </div>

      {typeof progress === "number" && (
        <div
          style={{
            marginTop: 10,
            height: 10,
            borderRadius: 999,
            background: "rgba(255,255,255,0.10)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 999,
              background: "rgba(255,255,255,0.75)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function ScoreRow({ color, value }: { color: Color; value: number }) {
  const max = 30; // 10 вопросов * 3
  const pct = Math.round((value / max) * 100);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 800, color: "rgba(255,255,255,0.92)" }}>
          {colorEmoji(color)} {colorLabel(color)}
        </div>
        <div style={{ opacity: 0.75, color: "rgba(255,255,255,0.85)" }}>
          {value} / {max}
        </div>
      </div>
      <div
        style={{
          marginTop: 6,
          height: 10,
          borderRadius: 999,
          background: "rgba(255,255,255,0.10)",
          border: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: "rgba(255,255,255,0.62)",
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
      <div style={{ fontSize: 16, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
        Твой профиль: {colorEmoji(top1.color)} {colorLabel(top1.color)} + {colorEmoji(top2.color)}{" "}
        {colorLabel(top2.color)}
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
      <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 800, color: "rgba(255,255,255,0.9)" }}>{title}</div>
      <ul style={{ margin: "6px 0 0 18px", padding: 0, lineHeight: 1.35, color: "rgba(255,255,255,0.9)" }}>
        {items.map((x) => (
          <li key={x} style={{ marginTop: 4 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
