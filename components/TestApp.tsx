"use client";

import { useEffect, useMemo, useState } from "react";
import { QUESTIONS_RU } from "@/lib/questions.ru";
import { computeScores, rankColors, colorEmoji, colorLabel, shortTips, type Color } from "@/lib/scoring";
import { tgSafeInit, getTgWebApp } from "@/lib/telegram";

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

    // восстановление
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { answers?: Record<number, number>; index?: number; stage?: Stage };
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

    // авто-переход вперёд (быстро/динамично)
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
    const text = `Мой профиль: ${colorEmoji(top1.color)} ${colorLabel(top1.color)} (${top1.value}) + ${colorEmoji(
      top2.color
    )} ${colorLabel(top2.color)} (${top2.value}).\n\nПройти тест: ${typeof window !== "undefined" ? window.location.href : ""}`;
    return text;
  }

  async function share() {
    const tg = getTgWebApp();
    const text = shareText();

    // Telegram: можно просто скопировать (универсально)
    try {
      await navigator.clipboard.writeText(text);
      alert(isTg ? "Скопировано. Вставь в чат и отправь 👍" : "Скопировано 👍");
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      alert("Скопировано 👍");
    }

    // Если хочешь отправку в чат через бот — добавим (нужен бекенд/бот endpoint).
    void tg;
  }

  const shellStyle: React.CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    padding: 16,
  };

  return (
    <div style={shellStyle}>
      <Header progress={stage === "test" ? progress : undefined} />

      {stage === "start" && (
        <Card>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>Тест по цветам поведения</h1>
          <p style={{ opacity: 0.9, lineHeight: 1.4 }}>
            40 утверждений. Оцени каждое: 0 (не про меня) … 3 (точно про меня).
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <Button onClick={start}>Начать</Button>
            {Object.keys(answers).length > 0 && (
              <Button variant="ghost" onClick={() => setStage("test")}>
                Продолжить
              </Button>
            )}
          </div>

          <div style={{ marginTop: 12, opacity: 0.7, fontSize: 12 }}>
            * Это упрощённая модель (DISC-подобная). Результат — подсказка, не диагноз.
          </div>
        </Card>
      )}

      {stage === "test" && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>
              Вопрос {index + 1} / {MAX_Q}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Ответов: {Object.keys(answers).length}</div>
          </div>

          <div style={{ marginTop: 10, fontSize: 18, lineHeight: 1.35 }}>{q.text}</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
            <AnswerButton active={selected === 0} onClick={() => setAnswer(0)}>
              0
              <span style={{ display: "block", fontSize: 12, opacity: 0.75 }}>не про меня</span>
            </AnswerButton>
            <AnswerButton active={selected === 1} onClick={() => setAnswer(1)}>
              1
              <span style={{ display: "block", fontSize: 12, opacity: 0.75 }}>иногда</span>
            </AnswerButton>
            <AnswerButton active={selected === 2} onClick={() => setAnswer(2)}>
              2
              <span style={{ display: "block", fontSize: 12, opacity: 0.75 }}>часто</span>
            </AnswerButton>
            <AnswerButton active={selected === 3} onClick={() => setAnswer(3)}>
              3
              <span style={{ display: "block", fontSize: 12, opacity: 0.75 }}>это я</span>
            </AnswerButton>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button variant="ghost" disabled={!canPrev} onClick={prev}>
              Назад
            </Button>
            <Button variant="ghost" disabled={!canNext} onClick={next}>
              Вперёд
            </Button>
            <div style={{ flex: 1 }} />
            <Button onClick={finish}>Результат</Button>
          </div>

          <div style={{ marginTop: 10, opacity: 0.65, fontSize: 12 }}>
            Совет: отвечай быстро, как чувствуешь. Не думай слишком долго.
          </div>
        </Card>
      )}

      {stage === "result" && (
        <Card>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22 }}>Результат</h2>

          <ScoreRow color="red" value={scores.red} />
          <ScoreRow color="yellow" value={scores.yellow} />
          <ScoreRow color="green" value={scores.green} />
          <ScoreRow color="blue" value={scores.blue} />

          <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.06)" }}>
            <TopSummary ranked={ranked} />
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <Button onClick={share}>Поделиться (скопировать)</Button>
            <Button variant="ghost" onClick={() => setStage("test")}>
              Вернуться к вопросам
            </Button>
            <Button variant="ghost" onClick={reset}>
              Пройти заново
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Header({ progress }: { progress?: number }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <div style={{ fontWeight: 700, letterSpacing: 0.2 }}>DISC Colors</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Mini App</div>
      </div>

      {typeof progress === "number" && (
        <div style={{ marginTop: 10, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              borderRadius: 999,
              background: "rgba(255,255,255,0.7)",
            }}
          />
        </div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >
      {children}
    </div>
  );
}

function Button({
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
    borderRadius: 14,
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.14)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontWeight: 650,
  };

  const style: React.CSSProperties =
    variant === "solid"
      ? { ...base, background: "rgba(255,255,255,0.92)", color: "#0b0f14" }
      : { ...base, background: "transparent", color: "#e9eef5" };

  return (
    <button type="button" style={style} onClick={disabled ? undefined : onClick}>
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
        borderRadius: 14,
        padding: 12,
        border: active ? "1px solid rgba(255,255,255,0.65)" : "1px solid rgba(255,255,255,0.14)",
        background: active ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.15)",
        color: "#e9eef5",
        cursor: "pointer",
        textAlign: "center",
      }}
    >
      {children}
    </button>
  );
}

function ScoreRow({ color, value }: { color: Color; value: number }) {
  const max = 30; // 10 вопросов * 3
  const pct = Math.round((value / max) * 100);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 700 }}>
          {colorEmoji(color)} {colorLabel(color)}
        </div>
        <div style={{ opacity: 0.85 }}>{value} / {max}</div>
      </div>
      <div style={{ marginTop: 6, height: 10, background: "rgba(255,255,255,0.08)", borderRadius: 999 }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            borderRadius: 999,
            background: "rgba(255,255,255,0.65)",
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
      <div style={{ fontSize: 16, fontWeight: 800 }}>
        Твой профиль: {colorEmoji(top1.color)} {colorLabel(top1.color)} + {colorEmoji(top2.color)}{" "}
        {colorLabel(top2.color)}
      </div>

      <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
        <TipBlock title={`${colorEmoji(top1.color)} ${colorLabel(top1.color)} — сильные стороны`} items={t1.strengths} />
        <TipBlock title={`${colorEmoji(top2.color)} ${colorLabel(top2.color)} — сильные стороны`} items={t2.strengths} />
        <TipBlock title={`Триггеры`} items={[...t1.triggers, ...t2.triggers].slice(0, 3)} />
        <TipBlock title={`Как с тобой общаться`} items={[...t1.howToTalk, ...t2.howToTalk].slice(0, 4)} />
      </div>
    </div>
  );
}

function TipBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.8, fontWeight: 700 }}>{title}</div>
      <ul style={{ margin: "6px 0 0 18px", padding: 0, lineHeight: 1.35 }}>
        {items.map((x) => (
          <li key={x} style={{ marginTop: 4 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
