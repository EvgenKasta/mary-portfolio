export type Color = "red" | "yellow" | "green" | "blue";

export const QUESTION_TO_COLOR: Record<number, Color> = {
  // 🔴
  1: "red",
  5: "red",
  9: "red",
  13: "red",
  17: "red",
  21: "red",
  25: "red",
  29: "red",
  33: "red",
  37: "red",
  // 🟡
  2: "yellow",
  6: "yellow",
  10: "yellow",
  14: "yellow",
  18: "yellow",
  22: "yellow",
  26: "yellow",
  30: "yellow",
  34: "yellow",
  38: "yellow",
  // 🟢
  3: "green",
  7: "green",
  11: "green",
  15: "green",
  19: "green",
  23: "green",
  27: "green",
  31: "green",
  35: "green",
  39: "green",
  // 🔵
  4: "blue",
  8: "blue",
  12: "blue",
  16: "blue",
  20: "blue",
  24: "blue",
  28: "blue",
  32: "blue",
  36: "blue",
  40: "blue",
};

export type Scores = Record<Color, number>;

export const emptyScores = (): Scores => ({
  red: 0,
  yellow: 0,
  green: 0,
  blue: 0,
});

export function computeScores(answers: Record<number, number>): Scores {
  const scores = emptyScores();
  for (const [qStr, val] of Object.entries(answers)) {
    const q = Number(qStr);
    const color = QUESTION_TO_COLOR[q];
    if (!color) continue;
    scores[color] += val;
  }
  return scores;
}

export function rankColors(scores: Scores): { color: Color; value: number }[] {
  return (Object.entries(scores) as [Color, number][])
    .map(([color, value]) => ({ color, value }))
    .sort((a, b) => b.value - a.value);
}

export function colorLabel(c: Color): string {
  switch (c) {
    case "red":
      return "Красный";
    case "yellow":
      return "Жёлтый";
    case "green":
      return "Зелёный";
    case "blue":
      return "Синий";
  }
}

export function colorEmoji(c: Color): string {
  switch (c) {
    case "red":
      return "🔴";
    case "yellow":
      return "🟡";
    case "green":
      return "🟢";
    case "blue":
      return "🔵";
  }
}

export function shortTips(c: Color): { strengths: string[]; triggers: string[]; howToTalk: string[] } {
  switch (c) {
    case "red":
      return {
        strengths: ["решительность", "скорость", "ориентация на результат"],
        triggers: ["медлительность", "«вода» без сути"],
        howToTalk: ["коротко и по делу", "с вариантами решения", "с конкретным сроком"],
      };
    case "yellow":
      return {
        strengths: ["энергия", "идеи", "коммуникация"],
        triggers: ["рутина", "жёсткие ограничения"],
        howToTalk: ["дружелюбно", "через смысл и выгоду", "оставь пространство для выбора"],
      };
    case "green":
      return {
        strengths: ["надёжность", "поддержка", "стабильность"],
        triggers: ["давление", "резкие изменения"],
        howToTalk: ["спокойно", "дай время подумать", "подчеркни безопасность и последовательность"],
      };
    case "blue":
      return {
        strengths: ["логика", "точность", "системность"],
        triggers: ["хаос", "нелогичность"],
        howToTalk: ["факты и критерии", "структура и план", "прозрачные правила"],
      };
  }
}
