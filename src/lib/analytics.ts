import type { Candle } from "./types";

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    out.push(values[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

export function rsi(values: number[], period = 14): number {
  if (values.length < period + 1) return 50;
  let gain = 0;
  let loss = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  const rs = gain / period / (loss / period);
  return 100 - 100 / (1 + rs);
}

/** Average true range as a percentage of price — the volatility input. */
export function atrPct(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev),
      Math.abs(candles[i].low - prev),
    );
    sum += tr;
  }
  const last = candles.at(-1)!.close;
  return last ? (sum / period / last) * 100 : 0;
}

export type Regime = {
  label: "TRENDING" | "RANGING" | "VOLATILE" | "REVERSAL";
  labelTh: string;
  bias: "Bullish" | "Bearish" | "Neutral";
  biasTh: string;
  confidence: number; // 0-100
  volatility: "Low" | "Medium" | "High";
  volatilityTh: string;
  phase: string;
  phaseTh: string;
  rsi: number;
  atr: number;
  slope: number; // % distance between fast and slow EMA
};

const NEUTRAL: Regime = {
  label: "RANGING",
  labelTh: "แกว่งตัว",
  bias: "Neutral",
  biasTh: "เป็นกลาง",
  confidence: 50,
  volatility: "Low",
  volatilityTh: "ต่ำ",
  phase: "Accumulation",
  phaseTh: "สะสม",
  rsi: 50,
  atr: 0,
  slope: 0,
};

/**
 * Classifies the market from the same candles the chart is drawing, so the
 * "AI" panels always agree with what the user can see.
 */
export function detectRegime(candles: Candle[]): Regime {
  if (candles.length < 30) return NEUTRAL;

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, 12).at(-1)!;
  const slow = ema(closes, 34).at(-1)!;
  const last = closes.at(-1)!;
  const slope = ((fast - slow) / slow) * 100;
  const strength = Math.abs(slope);
  const r = rsi(closes, 14);
  const atr = atrPct(candles, 14);

  const bias: Regime["bias"] =
    slope > 0.08 ? "Bullish" : slope < -0.08 ? "Bearish" : "Neutral";
  const biasTh =
    bias === "Bullish" ? "ขาขึ้น" : bias === "Bearish" ? "ขาลง" : "เป็นกลาง";

  let label: Regime["label"];
  if (strength > 0.35) label = "TRENDING";
  else if (atr > 1.2) label = "VOLATILE";
  else if ((r > 72 || r < 28) && strength > 0.12) label = "REVERSAL";
  else label = "RANGING";

  const labelTh = {
    TRENDING: "มีแนวโน้ม",
    RANGING: "แกว่งตัว",
    VOLATILE: "ผันผวน",
    REVERSAL: "กลับตัว",
  }[label];

  const volatility: Regime["volatility"] =
    atr > 1.1 ? "High" : atr > 0.45 ? "Medium" : "Low";
  const volatilityTh =
    volatility === "High" ? "สูง" : volatility === "Medium" ? "ปานกลาง" : "ต่ำ";

  // Confidence blends trend strength with how far RSI sits from the 50 line.
  const confidence = Math.round(
    Math.min(96, 42 + strength * 55 + Math.abs(r - 50) * 0.55),
  );

  const range = Math.max(...closes.slice(-60)) - Math.min(...closes.slice(-60));
  const pos = range
    ? (last - Math.min(...closes.slice(-60))) / range
    : 0.5;
  const phase =
    label === "TRENDING"
      ? pos > 0.7
        ? "Expansion"
        : "Continuation"
      : label === "REVERSAL"
        ? "Distribution"
        : pos < 0.3
          ? "Accumulation"
          : "Consolidation";
  const phaseTh = {
    Expansion: "ขยายตัว",
    Continuation: "ต่อเนื่อง",
    Distribution: "แจกจ่าย",
    Accumulation: "สะสม",
    Consolidation: "พักตัว",
  }[phase as "Expansion"];

  return {
    label,
    labelTh,
    bias,
    biasTh,
    confidence,
    volatility,
    volatilityTh,
    phase,
    phaseTh,
    rsi: r,
    atr,
    slope,
  };
}

export type SignalRead = {
  direction: "LONG" | "SHORT" | "FLAT";
  confidence: number;
  quality: number;
  liquidity: number;
  riskReward: number;
  winRate: number;
};

export function readSignal(candles: Candle[], regime: Regime): SignalRead {
  const direction: SignalRead["direction"] =
    regime.bias === "Bullish" ? "LONG" : regime.bias === "Bearish" ? "SHORT" : "FLAT";

  // Volume consistency stands in for liquidity quality.
  const vols = candles.slice(-30).map((c) => c.volume);
  const avg = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1);
  const variance =
    vols.reduce((a, v) => a + (v - avg) ** 2, 0) / Math.max(vols.length, 1);
  const cv = avg ? Math.sqrt(variance) / avg : 1;
  const liquidity = Math.round(Math.max(35, Math.min(99, 100 - cv * 42)));

  const quality = Math.round(
    Math.min(99, regime.confidence * 0.7 + liquidity * 0.3),
  );
  const riskReward = Math.max(
    1.1,
    Math.min(3.4, 1.2 + Math.abs(regime.slope) * 1.6 + regime.atr * 0.25),
  );
  const winRate = Math.round(Math.min(78, 38 + quality * 0.32));

  return {
    direction,
    confidence: regime.confidence,
    quality,
    liquidity,
    riskReward: Number(riskReward.toFixed(1)),
    winRate,
  };
}
