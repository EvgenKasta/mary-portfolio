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

function detectIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
}

function detectTelegram(): boolean {
  if (typeof window === "undefined") return false;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const hasTgObj = !!(window as any).Telegram?.WebApp;
  const isTelegramUA = /Telegram/i.test(ua) || /TelegramWebView/i.test(ua);
  return hasTgObj || isTelegramUA;
}

export default function TestApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [index, setIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isTg, setIsTg] = useState(false);

  // ✅ SAFE MODE: iOS + Telegram → убираем blur / прозрачные “стекла”, делаем solid UI
  const [safeMode, setSafeMode] = useState(false);
  useEffect(() => {
    const isiOS = detectIos();
    const isTelegram = detectTelegram();

    const supportsBackdrop =
      typeof CSS !== "undefined" &&
      ((CSS as any).supports?.("backdrop-filter: blur(1px)") ||
        (CSS as any).supports?.("-webkit-backdrop-filter: blur(1px)"));

    setSafeMode((isiOS && isTelegram) || !supportsBackdrop);
  }, []);

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
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ answers, index, stage })
      );
    } catch {
      // ignore
    }
  }, [answers, index, stage]);

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

  // ✅ копируем ВЕСЬ результат + пояснение + ссылка
  function shareText() {
    const top1 = ranked[0];
    const top2 = ranked[1];
    const botLink = "https://t.me/MaryPortfolioBot";

    const t1 = shortTips(top1.color);
    const t2 = shortTips(top2.color);

    const list = (items: string[]) => items.map((x) => `• ${x}`).join("\n");

    const triggers = [...t1.triggers, ...t2.triggers].slice(0, 6);
    const howToTalk = [...t1.howToTalk, ...t2.howToTalk].slice(0, 8);

    return `Мой профиль DISC:
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
      if (!initData) return;

      const text = shareText();

      await fetch("/api/notify-owner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData, text }),
      });
    } catch {
      // ignore
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
    paddingTop: "max(calc(env(safe-area-inset-top) + 44px), 84px)",
    color: "rgba(255,255,255,0.92)",
    WebkitTextSizeAdjust: "100%",
  };

  return (
    <div style={shellStyle}>
      <AmbientBackground safeMode={safeMode} />

      <Header safeMode={safeMode} progress={stage === "test" ? progress : undefined} />

      {stage === "start" && (
        <GlassCard safeMode={safeMode}>
          <h1 style={{ marginTop: 0, marginBottom: 10, fontSize: 22, letterSpacing: 0.2 }}>
            Тест по психотипам (4 цвета)
          </h1>

          <p style={{ marginTop: 0, opacity: 0.88, lineHeight: 1.45 }}>
            Узнай свой стиль поведения и коммуникации. Оцени каждое утверждение: 0 (не про меня) … 3 (точно про меня).
          </p>

          {/* ✅ ВОЗВРАЩЕНО: полноценные списки на главном экране */}
          <div style={{ marginTop: 14, display: "grid", gap: 10, fontSize: 14 }}>
            <GlassDisclosure
              safeMode={safeMode}
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
              safeMode={safeMode}
              title="🟡 Жёлтый — энергия, идеи, общение"
              body={
                <>
                  <p style={p0}>Кто это: вдохновитель, генератор идей, коммуникатор.</p>
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
              safeMode={safeMode}
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
              safeMode={safeMode}
              title="🔵 Синий — логика, анализ, системность"
              body={
                <>
                  <p style={p0}>Кто это: аналитик, стратег, системный мыслитель.</p>
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
            <SolidButton safeMode={safeMode} onClick={start}>
              Начать тест
            </SolidButton>

            {Object.keys(answers).length > 0 && (
              <SolidButton safeMode={safeMode} variant="ghost" onClick={() => setStage("test")}>
                Продолжить
              </SolidButton>
            )}
          </div>

          <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
            * Упрощённая модель (DISC-подобная). Результат — подсказка, не диагноз.
          </div>
        </GlassCard>
      )}

      {stage === "test" && (
        <GlassCard safeMode={safeMode}>
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
            <AnswerButton safeMode={safeMode} active={selected === 0} onClick={() => setAnswer(0)}>
              0
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>не про меня</span>
            </AnswerButton>
            <AnswerButton safeMode={safeMode} active={selected === 1} onClick={() => setAnswer(1)}>
              1
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>иногда</span>
            </AnswerButton>
            <AnswerButton safeMode={safeMode} active={selected === 2} onClick={() => setAnswer(2)}>
              2
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>часто</span>
            </AnswerButton>
            <AnswerButton safeMode={safeMode} active={selected === 3} onClick={() => setAnswer(3)}>
              3
              <span style={{ display: "block", fontSize: 12, opacity: 0.72 }}>это я</span>
            </AnswerButton>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
            {/* ✅ ВАЖНО: эти кнопки теперь тоже SOLID как ответы */}
            <SolidButton safeMode={safeMode} variant="ghost" onClick={reset}>
              Начать сначала
            </SolidButton>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", gap: 10 }}>
              <SolidButton safeMode={safeMode} variant="ghost" disabled={!canPrev} onClick={prev}>
                Назад
              </SolidButton>
              <SolidButton safeMode={safeMode} variant="ghost" disabled={!canNext} onClick={next}>
                Вперёд
              </SolidButton>
              {isComplete && (
                <SolidButton safeMode={safeMode} onClick={finish}>
                  Результат
                </SolidButton>
              )}
            </div>
          </div>

          <div style={{ marginTop: 10, opacity: 0.6, fontSize: 12 }}>
            Совет: отвечай быстро, как чувствуешь.
          </div>
        </GlassCard>
      )}

      {stage === "result" && (
        <GlassCard safeMode={safeMode}>
          <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 22 }}>Результат</h2>

          <ScoreRow color="red" value={scores.red} safeMode={safeMode} />
          <ScoreRow color="yellow" value={scores.yellow} safeMode={safeMode} />
          <ScoreRow color="green" value={scores.green} safeMode={safeMode} />
          <ScoreRow color="blue" value={scores.blue} safeMode={safeMode} />

          <div style={{ marginTop: 14 }}>
            {/* ✅ ВАЖНО: рекомендации теперь тоже SOLID, чтобы не “выбеливалось” */}
            <GlassInset safeMode={safeMode}>
              <TopSummary ranked={ranked} />
            </GlassInset>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <SolidButton safeMode={safeMode} onClick={share}>
              Поделиться (скопировать)
            </SolidButton>

            <SolidButton safeMode={safeMode} variant="ghost" onClick={() => setStage("test")}>
              Вернуться к вопросам
            </SolidButton>

            <SolidButton safeMode={safeMode} variant="ghost" onClick={reset}>
              Пройти заново
            </SolidButton>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ---------- текстовые стили ---------- */
const p0: React.CSSProperties = { margin: "10px 0 0", opacity: 0.88, lineHeight: 1.45 };
const p1: React.CSSProperties = { margin: "10px 0 0", opacity: 0.88, lineHeight: 1.45 };
const h: React.CSSProperties = { marginTop: 10, fontWeight: 800, opacity: 0.9 };
const ul: React.CSSProperties = { margin: "6px 0 0 18px", padding: 0, lineHeight: 1.35, opacity: 0.92 };
const li: React.CSSProperties = { marginTop: 4 };

/* ===================== UI ===================== */

function AmbientBackground({ safeMode }: { safeMode: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background: safeMode
          ? "linear-gradient(180deg, #0B0F16 0%, #070A0F 100%)"
          : "radial-gradient(900px 500px at 20% 10%, rgba(120,170,255,0.28), transparent 60%)," +
            "radial-gradient(900px 500px at 80% 20%, rgba(255,120,200,0.22), transparent 55%)," +
            "radial-gradient(900px 500px at 50% 90%, rgba(120,255,210,0.18), transparent 60%)," +
            "linear-gradient(180deg, #0B0F16 0%, #070A0F 100%)",
      }}
    />
  );
}

function GlassCard({ children, safeMode }: { children: React.ReactNode; safeMode: boolean }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 22,
        backgroundColor: safeMode ? "rgba(18,22,32,0.98)" : "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        backdropFilter: safeMode ? "none" : "blur(18px) saturate(160%)",
        WebkitBackdropFilter: safeMode ? "none" : "blur(18px) saturate(160%)",
        position: "relative",
        overflow: "hidden",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {!safeMode && (
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
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

/* ✅ FIX: рекомендации/инсет — solid в safeMode */
function GlassInset({ children, safeMode }: { children: React.ReactNode; safeMode: boolean }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        backgroundColor: safeMode ? "rgba(34,44,64,0.98)" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: safeMode ? "none" : "blur(14px) saturate(140%)",
        WebkitBackdropFilter: safeMode ? "none" : "blur(14px) saturate(140%)",
        color: "rgba(255,255,255,0.92)",
      }}
    >
      {children}
    </div>
  );
}

/* ✅ FIX: ВСЕ кнопки делаем solid как AnswerButton */
function SolidButton({
  children,
  onClick,
  disabled,
  variant = "solid",
  safeMode,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "solid" | "ghost";
  safeMode: boolean;
}) {
  const base: React.CSSProperties = {
    borderRadius: 18,
    padding: "12px 14px",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontWeight: 800,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    WebkitTapHighlightColor: "transparent",
    appearance: "none",
    WebkitAppearance: "none",
    border: "1px solid rgba(255,255,255,0.22)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  };

  const style: React.CSSProperties =
    variant === "solid"
      ? {
          ...base,
          color: "rgba(10,12,16,0.95)",
          backgroundColor: "rgba(255,255,255,0.92)",
          border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "0 10px 26px rgba(0,0,0,0.25)",
        }
      : {
          ...base,
          color: "rgba(255,255,255,0.95)",
          backgroundColor: safeMode ? "rgba(44,56,84,0.98)" : "rgba(255,255,255,0.12)",
          border: safeMode ? "1px solid rgba(255,255,255,0.18)" : "1px solid rgba(255,255,255,0.22)",
          boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
        };

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
  safeMode,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active: boolean;
  safeMode: boolean;
}) {
  const bg = safeMode
    ? active
      ? "rgba(64,76,104,0.98)"
      : "rgba(42,50,70,0.98)"
    : active
    ? "rgba(255,255,255,0.22)"
    : "rgba(255,255,255,0.12)";

  const border = safeMode
    ? active
      ? "rgba(255,255,255,0.40)"
      : "rgba(255,255,255,0.18)"
    : active
    ? "rgba(255,255,255,0.55)"
    : "rgba(255,255,255,0.22)";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderRadius: 18,
        padding: 12,
        backgroundColor: bg,
        border: `1px solid ${border}`,
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

/* ✅ FIX: disclosure тоже solid в safeMode */
function GlassDisclosure({
  title,
  body,
  safeMode,
}: {
  title: string;
  body: React.ReactNode;
  safeMode: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: 16,
        backgroundColor: safeMode ? "rgba(34,44,64,0.98)" : "rgba(0,0,0,0.18)",
        border: "1px solid rgba(255,255,255,0.10)",
        backdropFilter: safeMode ? "none" : "blur(10px)",
        WebkitBackdropFilter: safeMode ? "none" : "blur(10px)",
        overflow: "hidden",
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
          color: "rgba(255,255,255,0.92)",
          fontWeight: 900,
          backgroundColor: "transparent",
          border: "none",
          WebkitTapHighlightColor: "transparent",
          appearance: "none",
          WebkitAppearance: "none",
        }}
      >
        <span>{title}</span>
        <span
          style={{
            opacity: 0.7,
            fontWeight: 900,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 180ms ease",
          }}
        >
          ⌄
        </span>
      </button>

      {open && <div style={{ padding: "0 12px 12px", color: "rgba(255,255,255,0.92)" }}>{body}</div>}
    </div>
  );
}

function Header({ progress, safeMode }: { progress?: number; safeMode: boolean }) {
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
          backdropFilter: safeMode ? "none" : "blur(12px)",
          WebkitBackdropFilter: safeMode ? "none" : "blur(12px)",
          overflow: "hidden",
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

function ScoreRow({
  color,
  value,
  safeMode,
}: {
  color: Color;
  value: number;
  safeMode: boolean;
}) {
  const max = 30;
  const pct = Math.round((value / max) * 100);

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
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
          backgroundColor: safeMode ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.10)",
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
      <div style={{ fontSize: 13, opacity: 0.85, fontWeight: 900, color: "rgba(255,255,255,0.92)" }}>
        {title}
      </div>
      <ul style={{ margin: "6px 0 0 18px", padding: 0, lineHeight: 1.35, color: "rgba(255,255,255,0.92)" }}>
        {items.map((x) => (
          <li key={x} style={{ marginTop: 4 }}>
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}
