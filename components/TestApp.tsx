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

/* ================= DETECT SAFE MODE ================= */

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
  const ua = navigator.userAgent || "";
  return !!(window as any).Telegram?.WebApp || /Telegram/i.test(ua);
}

/* ================= APP ================= */

export default function TestApp() {
  const [stage, setStage] = useState<Stage>("start");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [safeMode, setSafeMode] = useState(false);

  useEffect(() => {
    const isiOS = detectIos();
    const isTelegram = detectTelegram();
    setSafeMode(isiOS && isTelegram);
  }, []);

  useEffect(() => {
    tgSafeInit();
  }, []);

  const q = QUESTIONS_RU[index];

  const scores = useMemo(() => computeScores(answers), [answers]);
  const ranked = useMemo(() => rankColors(scores), [scores]);

  function setAnswer(v: number) {
    setAnswers((p) => ({ ...p, [q.id]: v }));

    if (index < MAX_Q - 1) setIndex((i) => i + 1);
    else setStage("result");
  }

  function reset() {
    setAnswers({});
    setIndex(0);
    setStage("start");
  }

  /* ================= UI ================= */

  return (
    <div style={shellStyle}>
      <AmbientBackground safeMode={safeMode} />

      {stage === "start" && (
        <Card safeMode={safeMode}>
          <h1>Тест по психотипам</h1>

          <Disclosure safeMode={safeMode} title="🔴 Красный">
            Лидер, скорость, результат
          </Disclosure>

          <Disclosure safeMode={safeMode} title="🟡 Жёлтый">
            Энергия, идеи, общение
          </Disclosure>

          <Disclosure safeMode={safeMode} title="🟢 Зелёный">
            Поддержка, команда
          </Disclosure>

          <Disclosure safeMode={safeMode} title="🔵 Синий">
            Анализ, системность
          </Disclosure>

          <Btn safeMode={safeMode} onClick={() => setStage("test")}>
            Начать тест
          </Btn>
        </Card>
      )}

      {stage === "test" && (
        <Card safeMode={safeMode}>
          <div>{q.text}</div>

          <div style={grid4}>
            {[0, 1, 2, 3].map((n) => (
              <AnswerBtn
                key={n}
                safeMode={safeMode}
                active={answers[q.id] === n}
                onClick={() => setAnswer(n)}
              >
                {n}
              </AnswerBtn>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <Btn safeMode={safeMode} onClick={reset}>
              Начать сначала
            </Btn>
          </div>
        </Card>
      )}

      {stage === "result" && (
        <Card safeMode={safeMode}>
          <h2>Результат</h2>

          <Inset safeMode={safeMode}>
            <TopSummary ranked={ranked} />
          </Inset>

          <Btn safeMode={safeMode} onClick={reset}>
            Пройти заново
          </Btn>
        </Card>
      )}
    </div>
  );
}

/* ================= STYLES ================= */

const shellStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 16,
  color: "#FFF",
};

/* ---------- BG ---------- */

function AmbientBackground({ safeMode }: { safeMode: boolean }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        background: safeMode
          ? "#0B0F16"
          : "linear-gradient(180deg,#0B0F16,#070A0F)",
      }}
    />
  );
}

/* ---------- CARD ---------- */

function Card({
  children,
  safeMode,
}: {
  children: React.ReactNode;
  safeMode: boolean;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        backgroundColor: safeMode ? "#1B2232" : "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.14)",
        marginBottom: 16,
        color: "#FFF",
      }}
    >
      {children}
    </div>
  );
}

/* ---------- INSET (РЕКОМЕНДАЦИИ) ---------- */

function Inset({
  children,
  safeMode,
}: {
  children: React.ReactNode;
  safeMode: boolean;
}) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 16,
        backgroundColor: safeMode ? "#222C40" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.14)",
        color: "#FFF",
      }}
    >
      {children}
    </div>
  );
}

/* ---------- DISCLOSURE (СПИСКИ ЦВЕТОВ) ---------- */

function Disclosure({
  title,
  children,
  safeMode,
}: {
  title: string;
  children: React.ReactNode;
  safeMode: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderRadius: 14,
        marginTop: 10,
        backgroundColor: safeMode ? "#222C40" : "rgba(0,0,0,0.2)",
        border: "1px solid rgba(255,255,255,0.14)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          padding: 10,
          background: "transparent",
          border: "none",
          color: "#FFF",
          textAlign: "left",
          fontWeight: 700,
        }}
      >
        {title}
      </button>

      {open && <div style={{ padding: 10 }}>{children}</div>}
    </div>
  );
}

/* ---------- BUTTONS ---------- */

function Btn({
  children,
  onClick,
  safeMode,
}: {
  children: React.ReactNode;
  onClick: () => void;
  safeMode: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        backgroundColor: safeMode ? "#2C3854" : "#FFF",
        color: safeMode ? "#FFF" : "#000",
        border: "none",
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function AnswerBtn({
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
  return (
    <button
      onClick={onClick}
      style={{
        padding: 12,
        borderRadius: 16,
        backgroundColor: active
          ? "#3E4C70"
          : safeMode
          ? "#2C3854"
          : "rgba(255,255,255,0.12)",
        color: "#FFF",
        border: "1px solid rgba(255,255,255,0.25)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4,1fr)",
  gap: 10,
  marginTop: 16,
};

/* ---------- SUMMARY ---------- */

function TopSummary({
  ranked,
}: {
  ranked: { color: Color; value: number }[];
}) {
  const t1 = shortTips(ranked[0].color);

  return (
    <div style={{ color: "#FFF" }}>
      <b>
        {colorEmoji(ranked[0].color)} {colorLabel(ranked[0].color)}
      </b>

      <ul>
        {t1.strengths.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
