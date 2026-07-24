import { ema } from "./analytics";
import type { Candle } from "./types";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

export type LabStrategyKind =
  | "trend"
  | "breakout"
  | "meanReversion"
  | "orderFlow"
  | "funding"
  | "scalping"
  | "ensemble";

export type LabConfig = {
  symbol: string;
  interval: string;
  bars: number;
  /** Futures adds funding cost and a liquidation price; spot has neither. */
  market: "spot" | "futures";
  direction: "long" | "short" | "both";
  strategy: LabStrategyKind;
  capital: number;
  leverage: number;
  /** Share of equity risked per position, in percent. */
  riskPct: number;
  /** Taker fee per side, in percent of notional. */
  feePct: number;
  /** Funding paid by the long side every 8 hours, in percent of notional. */
  fundingPct: number;
  /** Price concession per side, in percent. */
  slippagePct: number;
  stopAtr: number;
  targetR: number;
  trailing: boolean;
  /** Trail distance in ATR multiples, armed once the trade is 1R ahead. */
  trailAtr: number;
  maxHoldBars: number;
  maxPositions: number;
  margin: "cross" | "isolated";
};

export const DEFAULT_CONFIG: LabConfig = {
  symbol: "BTCUSDT",
  interval: "1h",
  bars: 2000,
  market: "futures",
  direction: "both",
  strategy: "trend",
  capital: 100_000,
  leverage: 5,
  riskPct: 1,
  feePct: 0.04,
  fundingPct: 0.01,
  slippagePct: 0.02,
  stopAtr: 1.6,
  targetR: 2.2,
  trailing: false,
  trailAtr: 1.2,
  maxHoldBars: 48,
  maxPositions: 1,
  margin: "isolated",
};

export const STRATEGY_META: Record<
  LabStrategyKind,
  { th: string; en: string; version: string; color: string; entryTh: string; exitTh: string }
> = {
  trend: {
    th: "ตามแนวโน้ม",
    en: "Trend Following",
    version: "v3.2",
    color: "#14e2a0",
    entryTh: "EMA เร็วตัดขึ้น/ลงผ่าน EMA ช้า และ RSI ยืนยันทิศทาง",
    exitTh: "แตะ Stop (ATR) · แตะ Target (R-multiple) · ครบเวลาถือ",
  },
  breakout: {
    th: "เบรกเอาต์",
    en: "Breakout",
    version: "v2.4",
    color: "#f472b6",
    entryTh: "ราคาปิดทะลุจุดสูงสุด/ต่ำสุดของ N แท่งก่อนหน้า พร้อมวอลุ่มยืนยัน",
    exitTh: "แตะ Stop · แตะ Target · ครบเวลาถือ",
  },
  meanReversion: {
    th: "กลับค่าเฉลี่ย",
    en: "Mean Reversion",
    version: "v2.1",
    color: "#3b9dff",
    entryTh: "RSI เข้าเขตสุดขั้ว และราคาห่างจาก EMA ช้าเกินเกณฑ์",
    exitTh: "กลับเข้าหาค่าเฉลี่ย · แตะ Stop · ครบเวลาถือ",
  },
  orderFlow: {
    th: "แรงซื้อขาย",
    en: "Order Flow",
    version: "v1.8",
    color: "#a78bfa",
    entryTh: "วอลุ่มพุ่งเกินค่าเฉลี่ย และราคาปิดใกล้ปลายแท่ง (แรงฝั่งเดียว)",
    exitTh: "แตะ Stop · แตะ Target · ครบเวลาถือ",
  },
  funding: {
    th: "ส่วนต่าง Funding",
    en: "Funding Arbitrage",
    version: "v1.5",
    color: "#facc15",
    entryTh: "ราคายืดออกจาก EMA ช้าเกิน 2% สวนทางกับ RSI (ตำแหน่งแออัด)",
    exitTh: "ราคาหดกลับ · แตะ Stop · ครบเวลาถือ",
  },
  scalping: {
    th: "สแกลป์โมเมนตัม",
    en: "Momentum Scalping",
    version: "v2.0",
    color: "#ff8f3d",
    entryTh: "ตามเทรนด์หลัก เข้าเมื่อย่อ 1 แท่ง และโมเมนตัมยังอยู่",
    exitTh: "แตะ Stop · แตะ Target · ครบเวลาถือ (สั้น)",
  },
  ensemble: {
    th: "รวมโมเดล AI",
    en: "AI Ensemble",
    version: "v4.0",
    color: "#00d4ff",
    entryTh: "โหวตจาก 6 โมเดลข้างต้น ต้องเห็นตรงกันอย่างน้อย 2 เสียงและไม่มีเสียงค้าน",
    exitTh: "แตะ Stop · แตะ Target · ครบเวลาถือ",
  },
};

/* ------------------------------------------------------------------ *
 * Market regime — classified per bar from price/volume only
 * ------------------------------------------------------------------ */

export type RegimeKind =
  | "strongUp"
  | "downtrend"
  | "sideway"
  | "highVol"
  | "lowVol"
  | "newsShock"
  | "liqCascade";

export const REGIME_META: Record<RegimeKind, { th: string; en: string; color: string }> = {
  strongUp: { th: "ขาขึ้นแรง", en: "Strong Uptrend", color: "#14e2a0" },
  downtrend: { th: "ขาลง", en: "Downtrend", color: "#ff4a68" },
  sideway: { th: "ออกข้าง", en: "Sideway", color: "#6b8497" },
  highVol: { th: "ผันผวนสูง", en: "High Volatility", color: "#ffb020" },
  lowVol: { th: "ผันผวนต่ำ", en: "Low Volatility", color: "#3b9dff" },
  newsShock: { th: "ช็อกจากข่าว", en: "News Shock", color: "#f472b6" },
  liqCascade: { th: "ลูกโซ่ล้างพอร์ต", en: "Liquidation Cascade", color: "#a78bfa" },
};

export const REGIME_ORDER: RegimeKind[] = [
  "strongUp",
  "downtrend",
  "sideway",
  "highVol",
  "lowVol",
  "newsShock",
  "liqCascade",
];

/** ATR in absolute price terms, Wilder-free simple mean over `period` bars. */
function atrSeries(candles: Candle[], period: number): number[] {
  const out = new Array<number>(candles.length).fill(0);
  let sum = 0;
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - prev),
      Math.abs(candles[i].low - prev),
    );
    sum += tr;
    if (i > period) {
      const p = candles[i - period - 1].close;
      const oldTr = Math.max(
        candles[i - period].high - candles[i - period].low,
        Math.abs(candles[i - period].high - p),
        Math.abs(candles[i - period].low - p),
      );
      sum -= oldTr;
    }
    out[i] = sum / Math.min(i, period);
  }
  return out;
}

function rsiSeries(closes: number[], period: number): number[] {
  const out = new Array<number>(closes.length).fill(50);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period && i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  gain /= period;
  loss /= period;
  if (period < closes.length) out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

function rollingMean(values: number[], period: number): number[] {
  const out = new Array<number>(values.length).fill(0);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out[i] = sum / Math.min(i + 1, period);
  }
  return out;
}

type Indicators = {
  closes: number[];
  fast: number[];
  slow: number[];
  anchor: number[];
  rs: number[];
  atr: number[];
  volAvg: number[];
  regimes: RegimeKind[];
  /** Standard deviation of one-bar returns, used for the shock threshold. */
  retSd: number;
  barSec: number;
};

/** Most common gap between candles — real bar length, not an assumed one. */
function barSeconds(candles: Candle[]): number {
  if (candles.length < 3) return 3600;
  const gaps: number[] = [];
  for (let i = 1; i < Math.min(candles.length, 60); i++) {
    const g = candles[i].time - candles[i - 1].time;
    if (g > 0) gaps.push(g);
  }
  if (gaps.length === 0) return 3600;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function buildIndicators(candles: Candle[]): Indicators {
  const closes = candles.map((c) => c.close);
  const fast = ema(closes, 12);
  const slow = ema(closes, 34);
  const anchor = ema(closes, 100);
  const rs = rsiSeries(closes, 14);
  const atr = atrSeries(candles, 14);
  const volAvg = rollingMean(candles.map((c) => c.volume), 20);

  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    rets.push(closes[i - 1] ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(rets.length, 1);
  const retSd =
    Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(rets.length, 1)) || 1e-9;

  // A trailing window of ATR readings gives each bar a volatility percentile.
  const regimes: RegimeKind[] = new Array(candles.length).fill("sideway");
  const window = 200;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const a = atr[i];
    if (i < 40 || a <= 0) continue;

    const range = c.high - c.low;
    const vol = c.volume;
    const avgVol = volAvg[i] || 1;
    const ret = i > 0 && closes[i - 1] ? (closes[i] - closes[i - 1]) / closes[i - 1] : 0;

    const from = Math.max(0, i - window);
    let below = 0;
    let counted = 0;
    for (let j = from; j < i; j++) {
      if (atr[j] <= 0) continue;
      counted++;
      if (atr[j] < a) below++;
    }
    const volRank = counted ? below / counted : 0.5;
    const trendPct = slow[i] ? ((fast[i] - slow[i]) / slow[i]) * 100 : 0;
    const above = anchor[i] ? (c.close - anchor[i]) / anchor[i] : 0;

    if (range > 4 * a && vol > 3 * avgVol) regimes[i] = "liqCascade";
    else if (Math.abs(ret) > 3 * retSd) regimes[i] = "newsShock";
    else if (volRank > 0.85) regimes[i] = "highVol";
    else if (volRank < 0.15) regimes[i] = "lowVol";
    else if (trendPct > 0.35 && above > 0) regimes[i] = "strongUp";
    else if (trendPct < -0.35 && above < 0) regimes[i] = "downtrend";
    else regimes[i] = "sideway";
  }

  return {
    closes,
    fast,
    slow,
    anchor,
    rs,
    atr,
    volAvg,
    regimes,
    retSd,
    barSec: barSeconds(candles),
  };
}

/* ------------------------------------------------------------------ *
 * Signals
 * ------------------------------------------------------------------ */

type Signal = { dir: "LONG" | "SHORT"; reason: string; strength: number };

/** `strength` is 0–1 and comes from how far past its threshold the trigger is. */
function rawSignal(
  kind: Exclude<LabStrategyKind, "ensemble">,
  i: number,
  c: Candle[],
  ind: Indicators,
): Signal | null {
  const { fast, slow, rs, atr, volAvg, closes } = ind;
  const bar = c[i];
  const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
  const crossDown = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  switch (kind) {
    case "trend": {
      const slope = slow[i] ? Math.abs((fast[i] - slow[i]) / slow[i]) * 100 : 0;
      if (crossUp && rs[i] > 52)
        return { dir: "LONG", reason: `EMA12 ตัดขึ้น EMA34 · RSI ${rs[i].toFixed(0)}`, strength: clamp01(slope / 1.2) };
      if (crossDown && rs[i] < 48)
        return { dir: "SHORT", reason: `EMA12 ตัดลง EMA34 · RSI ${rs[i].toFixed(0)}`, strength: clamp01(slope / 1.2) };
      return null;
    }

    case "breakout": {
      const look = 40;
      if (i < look) return null;
      let hi = -Infinity;
      let lo = Infinity;
      for (let j = i - look; j < i; j++) {
        if (c[j].high > hi) hi = c[j].high;
        if (c[j].low < lo) lo = c[j].low;
      }
      const volOk = bar.volume > (volAvg[i] || 0) * 1.2;
      if (!volOk) return null;
      if (bar.close > hi)
        return {
          dir: "LONG",
          reason: `ปิดเหนือ High ${look} แท่ง (${hi.toFixed(2)}) · วอลุ่ม ${(bar.volume / (volAvg[i] || 1)).toFixed(1)}x`,
          strength: clamp01((bar.close - hi) / (atr[i] || 1)),
        };
      if (bar.close < lo)
        return {
          dir: "SHORT",
          reason: `ปิดใต้ Low ${look} แท่ง (${lo.toFixed(2)}) · วอลุ่ม ${(bar.volume / (volAvg[i] || 1)).toFixed(1)}x`,
          strength: clamp01((lo - bar.close) / (atr[i] || 1)),
        };
      return null;
    }

    case "meanReversion": {
      const stretch = slow[i] ? ((bar.close - slow[i]) / slow[i]) * 100 : 0;
      if (rs[i] < 30 && stretch < -1.5)
        return { dir: "LONG", reason: `RSI ${rs[i].toFixed(0)} (ขายมากเกิน) · ต่ำกว่า EMA34 ${Math.abs(stretch).toFixed(1)}%`, strength: clamp01((30 - rs[i]) / 18) };
      if (rs[i] > 70 && stretch > 1.5)
        return { dir: "SHORT", reason: `RSI ${rs[i].toFixed(0)} (ซื้อมากเกิน) · สูงกว่า EMA34 ${stretch.toFixed(1)}%`, strength: clamp01((rs[i] - 70) / 18) };
      return null;
    }

    case "orderFlow": {
      // Free OHLCV has no tape, so aggression is inferred from where the bar
      // closed inside its own range plus how far volume ran above average.
      const range = bar.high - bar.low;
      if (range <= 0) return null;
      const closePos = (bar.close - bar.low) / range;
      const volRatio = bar.volume / (volAvg[i] || 1);
      if (volRatio < 1.8) return null;
      if (closePos > 0.78)
        return { dir: "LONG", reason: `วอลุ่ม ${volRatio.toFixed(1)}x · ปิดที่ ${(closePos * 100).toFixed(0)}% ของแท่ง (แรงซื้อ)`, strength: clamp01((volRatio - 1.8) / 2.5) };
      if (closePos < 0.22)
        return { dir: "SHORT", reason: `วอลุ่ม ${volRatio.toFixed(1)}x · ปิดที่ ${(closePos * 100).toFixed(0)}% ของแท่ง (แรงขาย)`, strength: clamp01((volRatio - 1.8) / 2.5) };
      return null;
    }

    case "funding": {
      // Crowded positioning proxy: price stretched away from the slow mean
      // while momentum has already turned the other way.
      const stretch = slow[i] ? ((bar.close - slow[i]) / slow[i]) * 100 : 0;
      if (stretch < -2 && rs[i] < 42)
        return { dir: "LONG", reason: `ราคายืดต่ำกว่า EMA34 ${Math.abs(stretch).toFixed(1)}% · ฝั่ง Short แออัด`, strength: clamp01((Math.abs(stretch) - 2) / 3) };
      if (stretch > 2 && rs[i] > 58)
        return { dir: "SHORT", reason: `ราคายืดเหนือ EMA34 ${stretch.toFixed(1)}% · ฝั่ง Long แออัด`, strength: clamp01((stretch - 2) / 3) };
      return null;
    }

    case "scalping": {
      if (i < 3) return null;
      const withTrend = fast[i] > slow[i];
      const dip = closes[i] < closes[i - 1];
      const pop = closes[i] > closes[i - 1];
      const push = Math.abs(closes[i] - closes[i - 2]) / (atr[i] || 1);
      if (withTrend && dip && rs[i] > 45)
        return { dir: "LONG", reason: `เทรนด์ขึ้น + ย่อ 1 แท่ง · RSI ${rs[i].toFixed(0)}`, strength: clamp01(push / 1.6) };
      if (!withTrend && pop && rs[i] < 55)
        return { dir: "SHORT", reason: `เทรนด์ลง + เด้ง 1 แท่ง · RSI ${rs[i].toFixed(0)}`, strength: clamp01(push / 1.6) };
      return null;
    }
  }
}

const VOTERS: Exclude<LabStrategyKind, "ensemble">[] = [
  "trend",
  "breakout",
  "meanReversion",
  "orderFlow",
  "funding",
  "scalping",
];

function signalFor(kind: LabStrategyKind, i: number, c: Candle[], ind: Indicators): Signal | null {
  if (kind !== "ensemble") return rawSignal(kind, i, c, ind);

  let long = 0;
  let short = 0;
  let strength = 0;
  const names: string[] = [];
  for (const v of VOTERS) {
    const s = rawSignal(v, i, c, ind);
    if (!s) continue;
    if (s.dir === "LONG") long++;
    else short++;
    strength += s.strength;
    names.push(`${STRATEGY_META[v].th}→${s.dir === "LONG" ? "ซื้อ" : "ขาย"}`);
  }

  const votes = long + short;
  if (votes < 2) return null;
  // A split vote means the models disagree — sit it out.
  if (long > 0 && short > 0) return null;

  return {
    dir: long > short ? "LONG" : "SHORT",
    reason: `โหวต ${votes}/6 เห็นตรงกัน · ${names.join(" · ")}`,
    strength: Math.max(0, Math.min(1, strength / votes + (votes - 2) * 0.12)),
  };
}

/* ------------------------------------------------------------------ *
 * Trades & results
 * ------------------------------------------------------------------ */

export type ExitReason = "target" | "stop" | "trail" | "timeout" | "liquidation" | "eod";

export const EXIT_META: Record<
  ExitReason,
  { th: string; en: string; tone: "up" | "down" | "warn" | "neutral" }
> = {
  target: { th: "ถึงเป้าหมาย", en: "Take profit", tone: "up" },
  stop: { th: "ตัดขาดทุน", en: "Stop loss", tone: "down" },
  trail: { th: "Trailing Stop", en: "Trailing stop", tone: "warn" },
  timeout: { th: "ครบเวลาถือ", en: "Max hold time", tone: "neutral" },
  liquidation: { th: "ถูกล้างพอร์ต", en: "Liquidated", tone: "down" },
  eod: { th: "จบชุดข้อมูล", en: "End of data", tone: "neutral" },
};

/** One voter's opinion at the bar that produced the signal. */
export type Vote = { kind: Exclude<LabStrategyKind, "ensemble">; dir: "LONG" | "SHORT"; strength: number };

/** A stop that was moved while the position was open. */
export type StopMove = { time: number; from: number; to: number };

export type LabTrade = {
  id: number;
  /** Bar that produced the signal — the fill happens on the next one. */
  signalTime: number;
  entryTime: number;
  exitTime: number;
  entryIndex: number;
  exitIndex: number;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number;
  stop: number;
  target: number;
  qty: number;
  notional: number;
  leverage: number;
  /** Currency amount the position was sized to risk — the unit behind `r`. */
  riskUsd: number;
  feeUsd: number;
  fundingUsd: number;
  slippageUsd: number;
  grossUsd: number;
  pnlUsd: number;
  pnlPct: number;
  /** Profit measured in units of the amount risked on the trade. */
  r: number;
  holdBars: number;
  holdHours: number;
  entryReason: string;
  exitReason: ExitReason;
  confidence: number;
  regime: RegimeKind;
  equityAfter: number;
  /** Which of the six models agreed and which disagreed at the signal bar. */
  agree: Vote[];
  disagree: Vote[];
  stopMoves: StopMove[];
  /** Best unrealised gain the trade ever showed, in R. */
  mfe: number;
  /** Worst unrealised loss the trade ever showed, in R. */
  mae: number;
  /** Traded volume on the signal bar — the only liquidity reading OHLCV gives. */
  entryVolume: number;
  /** ATR as a share of price at entry, i.e. how wide the market was moving. */
  atrPctAtEntry: number;
};

/** A signal the engine refused to act on, and why. */
export type SkippedSignal = {
  time: number;
  side: "LONG" | "SHORT";
  reason: "maxPositions" | "direction" | "noStopDistance" | "noCash";
  confidence: number;
  regime: RegimeKind;
  entryReason: string;
};

export const SKIP_META: Record<SkippedSignal["reason"], { th: string; en: string }> = {
  maxPositions: { th: "เต็มเพดาน Position", en: "Position limit reached" },
  direction: { th: "ถูกตัวกรองทิศทางปฏิเสธ", en: "Blocked by direction filter" },
  noStopDistance: { th: "คำนวณระยะ Stop ไม่ได้", en: "No valid stop distance" },
  noCash: { th: "เงินทุนไม่พอ", en: "Insufficient equity" },
};

export type DrawdownStats = {
  current: number;
  max: number;
  avg: number;
  longestBars: number;
  longestHours: number;
  recoveryBars: number;
  recovered: boolean;
  worstLossStreak: number;
  worstStreakUsd: number;
  clusters: { startTime: number; endTime: number; depth: number; bars: number }[];
  series: number[];
};

export type LabResult = {
  ok: boolean;
  note: string;
  config: LabConfig;
  trades: LabTrade[];
  skipped: SkippedSignal[];
  equity: number[];
  times: number[];
  buyHold: number[];
  netProfit: number;
  returnPct: number;
  buyHoldPct: number;
  cagr: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  riskReward: number;
  expectancy: number;
  recoveryFactor: number;
  totalFees: number;
  totalFunding: number;
  totalSlippage: number;
  /** Fees + funding + slippage, all of it already deducted from netProfit. */
  totalCosts: number;
  /** What the same trades would have returned with every cost set to zero. */
  grossBeforeCosts: number;
  /** Sum of winning trades, net of costs — the numerator of Profit Factor. */
  grossProfit: number;
  /** Sum of losing trades, net of costs — the denominator of Profit Factor. */
  grossLoss: number;
  liquidations: number;
  bars: number;
  barSec: number;
  spanDays: number;
  drawdown: DrawdownStats;
};

function emptyResult(config: LabConfig, note: string): LabResult {
  return {
    ok: false,
    note,
    config,
    trades: [],
    skipped: [],
    equity: [config.capital],
    times: [],
    buyHold: [config.capital],
    netProfit: 0,
    returnPct: 0,
    buyHoldPct: 0,
    cagr: 0,
    winRate: 0,
    profitFactor: 0,
    sharpe: 0,
    sortino: 0,
    maxDrawdown: 0,
    avgWin: 0,
    avgLoss: 0,
    riskReward: 0,
    expectancy: 0,
    recoveryFactor: 0,
    totalFees: 0,
    totalFunding: 0,
    totalSlippage: 0,
    totalCosts: 0,
    grossBeforeCosts: 0,
    grossProfit: 0,
    grossLoss: 0,
    liquidations: 0,
    bars: 0,
    barSec: 3600,
    spanDays: 0,
    drawdown: {
      current: 0,
      max: 0,
      avg: 0,
      longestBars: 0,
      longestHours: 0,
      recoveryBars: 0,
      recovered: true,
      worstLossStreak: 0,
      worstStreakUsd: 0,
      clusters: [],
      series: [],
    },
  };
}

type OpenPosition = {
  id: number;
  side: "LONG" | "SHORT";
  entryIndex: number;
  entryTime: number;
  signalTime: number;
  entry: number;
  qty: number;
  notional: number;
  stop: number;
  target: number;
  liq: number;
  best: number;
  /** Extremes reached while open, for the MFE/MAE readings. */
  hiPrice: number;
  loPrice: number;
  atr: number;
  riskUsd: number;
  entryFee: number;
  entrySlip: number;
  reason: string;
  confidence: number;
  regime: RegimeKind;
  agree: Vote[];
  disagree: Vote[];
  stopMoves: StopMove[];
  entryVolume: number;
  atrPctAtEntry: number;
};

/** The stop distance the position was sized on — the R that MFE/MAE use. */
function stopDistOf(p: OpenPosition): number {
  return Math.abs(p.entry - (p.stopMoves[0]?.from ?? p.stop));
}

/** Every model's read at one bar — the committee record behind a trade. */
function pollCommittee(i: number, c: Candle[], ind: Indicators, dir: "LONG" | "SHORT") {
  const agree: Vote[] = [];
  const disagree: Vote[] = [];
  for (const v of VOTERS) {
    const s = rawSignal(v, i, c, ind);
    if (!s) continue;
    (s.dir === dir ? agree : disagree).push({ kind: v, dir: s.dir, strength: s.strength });
  }
  return { agree, disagree };
}

/**
 * Event-driven backtest with explicit trading costs.
 *
 * Ordering inside each bar is deliberate and conservative: queued entries fill
 * at the open, open positions are then tested against that same bar's range
 * (liquidation first, then stop, then target), trailing stops only move on the
 * bar's close, and a new signal read from bars up to `i` can fill no earlier
 * than `i + 1`. Nothing reads a price the simulated clock has not reached.
 */
export function runLab(candles: Candle[], cfg: LabConfig): LabResult {
  if (candles.length < 150) {
    return emptyResult(cfg, "ข้อมูลย้อนหลังไม่พอสำหรับการทดสอบ (ต้องการอย่างน้อย 150 แท่ง)");
  }

  const ind = buildIndicators(candles);
  const n = candles.length;
  const warmup = 105;
  const isFutures = cfg.market === "futures";
  const slip = cfg.slippagePct / 100;
  const fee = cfg.feePct / 100;
  const fundingPerSec = isFutures ? cfg.fundingPct / 100 / (8 * 3600) : 0;
  const maintenance = 0.005;

  let cash = cfg.capital;
  const trades: LabTrade[] = [];
  const skipped: SkippedSignal[] = [];
  const equity: number[] = [];
  const times: number[] = [];
  const open: OpenPosition[] = [];
  type Queued = {
    side: "LONG" | "SHORT";
    reason: string;
    confidence: number;
    atr: number;
    regime: RegimeKind;
    signalTime: number;
    agree: Vote[];
    disagree: Vote[];
    volume: number;
    price: number;
  };
  let queued: Queued | null = null;
  let nextId = 1;
  let liquidations = 0;
  let totalFees = 0;
  let totalFunding = 0;
  let totalSlippage = 0;

  const markToMarket = (i: number) => {
    let unreal = 0;
    for (const p of open) {
      const sign = p.side === "LONG" ? 1 : -1;
      unreal += (candles[i].close - p.entry) * p.qty * sign;
    }
    return cash + unreal;
  };

  const close = (p: OpenPosition, i: number, rawExit: number, reason: ExitReason) => {
    const sign = p.side === "LONG" ? 1 : -1;
    // Slippage always works against the trade, on the way out as well as in.
    const exit = rawExit * (1 - sign * slip);
    const exitSlip = Math.abs(rawExit - exit) * p.qty;
    const exitNotional = Math.abs(exit * p.qty);
    const exitFee = exitNotional * fee;

    const heldSec = Math.max(candles[i].time - p.entryTime, 0);
    // The long side pays when funding is positive; the short side collects it.
    const funding = isFutures ? p.notional * fundingPerSec * heldSec * sign : 0;

    const gross = (exit - p.entry) * p.qty * sign;
    const costs = p.entryFee + exitFee + funding;
    let net = gross - costs;

    // A liquidation cannot lose more than the margin that backed the position.
    if (reason === "liquidation") {
      const margin = p.notional / cfg.leverage;
      net = Math.max(net, -margin);
      liquidations++;
    }

    cash += net;
    totalFees += p.entryFee + exitFee;
    totalFunding += funding;
    totalSlippage += p.entrySlip + exitSlip;

    const holdBars = i - p.entryIndex;
    trades.push({
      id: p.id,
      signalTime: p.signalTime,
      entryTime: p.entryTime,
      exitTime: candles[i].time,
      entryIndex: p.entryIndex,
      exitIndex: i,
      side: p.side,
      entry: p.entry,
      exit,
      stop: p.stop,
      target: p.target,
      qty: p.qty,
      notional: p.notional,
      leverage: cfg.leverage,
      riskUsd: p.riskUsd,
      feeUsd: p.entryFee + exitFee,
      fundingUsd: funding,
      slippageUsd: p.entrySlip + exitSlip,
      grossUsd: gross,
      pnlUsd: net,
      pnlPct: p.notional ? (net / (p.notional / cfg.leverage)) * 100 : 0,
      r: p.riskUsd ? net / p.riskUsd : 0,
      holdBars,
      holdHours: (holdBars * ind.barSec) / 3600,
      entryReason: p.reason,
      exitReason: reason,
      confidence: p.confidence,
      regime: p.regime,
      equityAfter: cash,
      agree: p.agree,
      disagree: p.disagree,
      stopMoves: p.stopMoves,
      // Both are measured against the original stop distance, so 1 MFE means
      // the trade was once a full R in front.
      mfe: stopDistOf(p) ? ((sign > 0 ? p.hiPrice - p.entry : p.entry - p.loPrice) / stopDistOf(p)) : 0,
      mae: stopDistOf(p) ? ((sign > 0 ? p.entry - p.loPrice : p.hiPrice - p.entry) / stopDistOf(p)) : 0,
      entryVolume: p.entryVolume,
      atrPctAtEntry: p.atrPctAtEntry,
    });
  };

  for (let i = warmup; i < n; i++) {
    const bar = candles[i];

    // 1) Fill anything the previous bar queued, at this bar's open.
    if (queued) {
      const skip = (reason: SkippedSignal["reason"]) =>
        skipped.push({
          time: queued!.signalTime,
          side: queued!.side,
          reason,
          confidence: queued!.confidence,
          regime: queued!.regime,
          entryReason: queued!.reason,
        });

      if (open.length >= cfg.maxPositions) skip("maxPositions");
      else if (cash <= 0) skip("noCash");
      else if (queued.atr * cfg.stopAtr <= 0) skip("noStopDistance");
    }

    if (queued && open.length < cfg.maxPositions && cash > 0) {
      const sign = queued.side === "LONG" ? 1 : -1;
      const raw = bar.open;
      const entry = raw * (1 + sign * slip);
      const stopDist = queued.atr * cfg.stopAtr;

      if (stopDist > 0) {
        const riskUsd = (cash * cfg.riskPct) / 100;
        let qty = riskUsd / stopDist;
        // Leverage caps how large the notional may get, whatever the stop says.
        const maxNotional = cash * cfg.leverage;
        if (qty * entry > maxNotional) qty = maxNotional / entry;

        if (qty > 0) {
          const notional = qty * entry;
          const entryFee = notional * fee;
          const entrySlip = Math.abs(entry - raw) * qty;
          // Isolated risks only this position's margin; cross backs it with the
          // whole balance, so the liquidation price sits much further away.
          const backing = cfg.margin === "isolated" ? notional / cfg.leverage : cash;
          const liqDist = Math.max((backing / Math.max(qty, 1e-9)) - entry * maintenance, 0);

          open.push({
            id: nextId++,
            side: queued.side,
            entryIndex: i,
            entryTime: bar.time,
            signalTime: queued.signalTime,
            entry,
            qty,
            notional,
            stop: entry - sign * stopDist,
            target: entry + sign * stopDist * cfg.targetR,
            liq: entry - sign * liqDist,
            best: entry,
            // The position is live for the rest of the bar it filled on, so its
            // range counts toward MFE/MAE. Exit checks still skip this bar —
            // those drive decisions, these only describe what already happened.
            hiPrice: Math.max(bar.high, entry),
            loPrice: Math.min(bar.low, entry),
            atr: queued.atr,
            riskUsd,
            entryFee,
            entrySlip,
            reason: queued.reason,
            confidence: queued.confidence,
            regime: queued.regime,
            agree: queued.agree,
            disagree: queued.disagree,
            stopMoves: [],
            entryVolume: queued.volume,
            atrPctAtEntry: queued.price ? (queued.atr / queued.price) * 100 : 0,
          });
        }
      }
    }
    queued = null;

    // 2) Resolve open positions against this bar.
    for (let k = open.length - 1; k >= 0; k--) {
      const p = open[k];
      if (p.entryIndex === i) continue; // just filled at this open
      if (bar.high > p.hiPrice) p.hiPrice = bar.high;
      if (bar.low < p.loPrice) p.loPrice = bar.low;
      const long = p.side === "LONG";
      const hitLiq = cfg.leverage > 1 && (long ? bar.low <= p.liq : bar.high >= p.liq);
      const hitStop = long ? bar.low <= p.stop : bar.high >= p.stop;
      const hitTarget = long ? bar.high >= p.target : bar.low <= p.target;
      const expired = i - p.entryIndex >= cfg.maxHoldBars;

      if (hitLiq) {
        close(p, i, p.liq, "liquidation");
        open.splice(k, 1);
      } else if (hitStop) {
        // If both levels trade inside one bar, assume the stop filled first.
        close(p, i, p.stop, p.best !== p.entry && cfg.trailing ? "trail" : "stop");
        open.splice(k, 1);
      } else if (hitTarget) {
        close(p, i, p.target, "target");
        open.splice(k, 1);
      } else if (expired) {
        close(p, i, bar.close, "timeout");
        open.splice(k, 1);
      } else if (cfg.trailing) {
        // Trail on the close only — using this bar's extreme would peek.
        const before = p.stop;
        if (long) {
          if (bar.close > p.best) p.best = bar.close;
          if (p.best - p.entry > p.atr * cfg.stopAtr) {
            p.stop = Math.max(p.stop, p.best - p.atr * cfg.trailAtr);
          }
        } else {
          if (bar.close < p.best) p.best = bar.close;
          if (p.entry - p.best > p.atr * cfg.stopAtr) {
            p.stop = Math.min(p.stop, p.best + p.atr * cfg.trailAtr);
          }
        }
        if (p.stop !== before) p.stopMoves.push({ time: bar.time, from: before, to: p.stop });
      }
    }

    equity.push(markToMarket(i));
    times.push(bar.time);

    // 3) Read a signal from closed data and queue it for the next open.
    if (i < n - 1 && ind.atr[i] > 0) {
      const s = signalFor(cfg.strategy, i, candles, ind);
      if (s) {
        const allowed =
          cfg.direction === "both" ||
          (cfg.direction === "long" && s.dir === "LONG") ||
          (cfg.direction === "short" && s.dir === "SHORT");
        const confidence = Math.round(50 + s.strength * 45);

        if (!allowed) {
          skipped.push({
            time: bar.time,
            side: s.dir,
            reason: "direction",
            confidence,
            regime: ind.regimes[i],
            entryReason: s.reason,
          });
        } else {
          const { agree, disagree } = pollCommittee(i, candles, ind, s.dir);
          queued = {
            side: s.dir,
            reason: s.reason,
            confidence,
            atr: ind.atr[i],
            regime: ind.regimes[i],
            signalTime: bar.time,
            agree,
            disagree,
            volume: bar.volume,
            price: bar.close,
          };
        }
      }
    }
  }

  // Anything still open at the end closes on the final bar.
  for (const p of open) close(p, n - 1, candles[n - 1].close, "eod");
  if (open.length) {
    equity[equity.length - 1] = cash;
  }

  return summarise(trades, skipped, equity, times, candles.slice(warmup), cfg, ind.barSec, {
    totalFees,
    totalFunding,
    totalSlippage,
    liquidations,
  });
}

function summarise(
  trades: LabTrade[],
  skipped: SkippedSignal[],
  equity: number[],
  times: number[],
  candles: Candle[],
  cfg: LabConfig,
  barSec: number,
  costs: { totalFees: number; totalFunding: number; totalSlippage: number; liquidations: number },
): LabResult {
  const base = emptyResult(cfg, "");
  if (equity.length < 2 || candles.length < 2) {
    return { ...base, note: "ไม่มีแท่งเทียนพอสำหรับสรุปผล" };
  }

  const first = candles[0].close;
  const buyHold = candles.map((c) => (cfg.capital * c.close) / first);
  const spanDays = (candles.at(-1)!.time - candles[0].time) / 86400 || 1;

  const finalEquity = equity.at(-1)!;
  const netProfit = finalEquity - cfg.capital;
  const returnPct = (netProfit / cfg.capital) * 100;

  const wins = trades.filter((t) => t.pnlUsd > 0);
  const losses = trades.filter((t) => t.pnlUsd <= 0);
  const grossProfit = wins.reduce((a, t) => a + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlUsd, 0));

  // Per-bar returns drive Sharpe/Sortino so flat stretches are counted too.
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    rets.push(equity[i - 1] ? equity[i] / equity[i - 1] - 1 : 0);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(rets.length, 1);
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(rets.length, 1));
  const downside = rets.filter((r) => r < 0);
  const dsd = Math.sqrt(
    downside.reduce((a, r) => a + r * r, 0) / Math.max(downside.length, 1),
  );
  const perYear = (365 * 86400) / barSec;
  const clampRatio = (v: number) => Math.max(-9, Math.min(9, v));
  const sharpe = sd > 0 ? clampRatio((mean / sd) * Math.sqrt(perYear)) : 0;
  const sortino = dsd > 0 ? clampRatio((mean / dsd) * Math.sqrt(perYear)) : 0;

  const drawdown = drawdownStats(equity, times, trades, barSec);
  const years = spanDays / 365;
  const cagr =
    years > 0 && finalEquity > 0 ? (Math.pow(finalEquity / cfg.capital, 1 / years) - 1) * 100 : 0;

  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;

  return {
    ...base,
    ok: trades.length > 0,
    note: trades.length ? "" : "เงื่อนไขนี้ไม่เกิดสัญญาณเลยในช่วงข้อมูลที่เลือก",
    trades,
    skipped,
    equity,
    times,
    buyHold,
    netProfit,
    returnPct,
    buyHoldPct: ((buyHold.at(-1)! - cfg.capital) / cfg.capital) * 100,
    cagr,
    winRate: trades.length ? (wins.length / trades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    sharpe,
    sortino,
    maxDrawdown: drawdown.max,
    avgWin,
    avgLoss,
    riskReward: avgLoss > 0 ? avgWin / avgLoss : 0,
    expectancy: trades.length ? netProfit / trades.length : 0,
    recoveryFactor: drawdown.max > 0 ? returnPct / drawdown.max : 0,
    totalFees: costs.totalFees,
    totalFunding: costs.totalFunding,
    totalSlippage: costs.totalSlippage,
    totalCosts: costs.totalFees + costs.totalFunding + costs.totalSlippage,
    // Slippage is already baked into each trade's entry and exit price, so it
    // is added back here to recover the frictionless result.
    grossBeforeCosts:
      trades.reduce((a, t) => a + t.grossUsd, 0) + costs.totalSlippage,
    grossProfit,
    grossLoss,
    liquidations: costs.liquidations,
    bars: candles.length,
    barSec,
    spanDays,
    drawdown,
  };
}

function drawdownStats(
  equity: number[],
  times: number[],
  trades: LabTrade[],
  barSec: number,
): DrawdownStats {
  let peak = equity[0];
  let peakIndex = 0;
  let max = 0;
  let longestBars = 0;
  let recoveryBars = 0;
  let recovered = true;
  const series: number[] = [];
  const depths: number[] = [];
  const clusters: DrawdownStats["clusters"] = [];

  let inDd = false;
  let ddStart = 0;
  let ddDepth = 0;

  for (let i = 0; i < equity.length; i++) {
    const v = equity[i];
    if (v >= peak) {
      if (inDd) {
        const bars = i - ddStart;
        if (bars > longestBars) {
          longestBars = bars;
          recoveryBars = i - peakIndex;
        }
        depths.push(ddDepth);
        clusters.push({
          startTime: times[ddStart] ?? 0,
          endTime: times[i] ?? 0,
          depth: ddDepth,
          bars,
        });
        inDd = false;
        ddDepth = 0;
      }
      peak = v;
      peakIndex = i;
      series.push(0);
      continue;
    }

    const d = peak ? ((peak - v) / peak) * 100 : 0;
    series.push(d);
    if (d > max) max = d;
    if (!inDd) {
      inDd = true;
      ddStart = i;
    }
    if (d > ddDepth) ddDepth = d;
  }

  if (inDd) {
    recovered = false;
    const bars = equity.length - ddStart;
    if (bars > longestBars) {
      longestBars = bars;
      recoveryBars = 0;
    }
    depths.push(ddDepth);
    clusters.push({
      startTime: times[ddStart] ?? 0,
      endTime: times.at(-1) ?? 0,
      depth: ddDepth,
      bars,
    });
  }

  // Longest run of consecutive losing trades, and what it cost.
  let streak = 0;
  let worstLossStreak = 0;
  let streakUsd = 0;
  let worstStreakUsd = 0;
  for (const t of trades) {
    if (t.pnlUsd <= 0) {
      streak++;
      streakUsd += t.pnlUsd;
      if (streak > worstLossStreak) {
        worstLossStreak = streak;
        worstStreakUsd = streakUsd;
      }
    } else {
      streak = 0;
      streakUsd = 0;
    }
  }

  return {
    current: series.at(-1) ?? 0,
    max,
    avg: depths.length ? depths.reduce((a, b) => a + b, 0) / depths.length : 0,
    longestBars,
    longestHours: (longestBars * barSec) / 3600,
    recoveryBars,
    recovered,
    worstLossStreak,
    worstStreakUsd,
    clusters: clusters.sort((a, b) => b.depth - a.depth).slice(0, 5),
    series,
  };
}

/* ------------------------------------------------------------------ *
 * Pre-flight checks — what the run bar reports before simulating
 * ------------------------------------------------------------------ */

export type DataQuality = {
  bars: number;
  from: number;
  to: number;
  gaps: number;
  duplicates: number;
  invalid: number;
  zeroVolume: number;
  ok: boolean;
  noteTh: string;
};

/** Scans the candle series for the flaws that quietly corrupt a backtest. */
export function dataQuality(candles: Candle[]): DataQuality {
  const expected = barSeconds(candles);
  let gaps = 0;
  let duplicates = 0;
  let invalid = 0;
  let zeroVolume = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.high < c.low ||
      c.close <= 0
    ) {
      invalid++;
    }
    if (c.volume === 0) zeroVolume++;
    if (i > 0) {
      const d = c.time - candles[i - 1].time;
      if (d === 0) duplicates++;
      else if (d > expected * 1.5) gaps++;
    }
  }

  const ok = candles.length >= 150 && invalid === 0 && duplicates === 0;
  const problems: string[] = [];
  if (candles.length < 150) problems.push(`แท่งน้อยเกินไป (${candles.length})`);
  if (invalid) problems.push(`${invalid} แท่งเสียหาย`);
  if (duplicates) problems.push(`${duplicates} แท่งซ้ำเวลา`);
  if (gaps) problems.push(`${gaps} ช่วงข้อมูลขาด`);

  return {
    bars: candles.length,
    from: candles[0]?.time ?? 0,
    to: candles.at(-1)?.time ?? 0,
    gaps,
    duplicates,
    invalid,
    zeroVolume,
    ok,
    noteTh: problems.length ? problems.join(" · ") : "ข้อมูลครบถ้วน ไม่พบแท่งเสียหายหรือซ้ำเวลา",
  };
}

export type SignalScan = { total: number; long: number; short: number; avgConfidence: number };

/**
 * How many raw signals the strategy fires over the series, before position
 * limits and direction filters throw any of them away. The gap between this
 * and the trade count is what those constraints actually cost.
 */
export function countSignals(candles: Candle[], cfg: LabConfig): SignalScan {
  if (candles.length < 150) return { total: 0, long: 0, short: 0, avgConfidence: 0 };
  const ind = buildIndicators(candles);
  let long = 0;
  let short = 0;
  let strength = 0;
  for (let i = 105; i < candles.length - 1; i++) {
    if (ind.atr[i] <= 0) continue;
    const s = signalFor(cfg.strategy, i, candles, ind);
    if (!s) continue;
    if (s.dir === "LONG") long++;
    else short++;
    strength += s.strength;
  }
  const total = long + short;
  return {
    total,
    long,
    short,
    avgConfidence: total ? Math.round(50 + (strength / total) * 45) : 0,
  };
}

/* ------------------------------------------------------------------ *
 * Distribution
 * ------------------------------------------------------------------ */

export type Bucket = { label: string; trades: number; pnl: number; winRate: number };

export type Distribution = {
  byHour: Bucket[];
  byWeekday: Bucket[];
  byMonth: Bucket[];
  byRegime: (Bucket & { kind: RegimeKind })[];
  bySide: Bucket[];
  byOutcome: { label: string; count: number; color: string }[];
};

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function toBucket(label: string, list: LabTrade[]): Bucket {
  const pnl = list.reduce((a, t) => a + t.pnlUsd, 0);
  const wins = list.filter((t) => t.pnlUsd > 0).length;
  return { label, trades: list.length, pnl, winRate: list.length ? (wins / list.length) * 100 : 0 };
}

/** Bangkok-local hour/weekday, because that is the desk's trading clock. */
function bkkParts(unixSec: number) {
  const d = new Date(unixSec * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    weekday: "short",
    month: "numeric",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const month = Number(parts.find((p) => p.type === "month")?.value ?? "1") - 1;
  const wdName = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wdName);
  return { hour, weekday: wd < 0 ? 0 : wd, month };
}

export function distribution(trades: LabTrade[]): Distribution {
  const hours: LabTrade[][] = Array.from({ length: 24 }, () => []);
  const days: LabTrade[][] = Array.from({ length: 7 }, () => []);
  const months: LabTrade[][] = Array.from({ length: 12 }, () => []);
  const regimes = new Map<RegimeKind, LabTrade[]>();

  for (const t of trades) {
    const { hour, weekday, month } = bkkParts(t.entryTime);
    hours[hour].push(t);
    days[weekday].push(t);
    months[month].push(t);
    const arr = regimes.get(t.regime) ?? [];
    arr.push(t);
    regimes.set(t.regime, arr);
  }

  const longs = trades.filter((t) => t.side === "LONG");
  const shorts = trades.filter((t) => t.side === "SHORT");

  const outcomes = new Map<ExitReason, number>();
  for (const t of trades) outcomes.set(t.exitReason, (outcomes.get(t.exitReason) ?? 0) + 1);
  const outcomeColor: Record<ExitReason, string> = {
    target: "#14e2a0",
    trail: "#ffb020",
    stop: "#ff4a68",
    timeout: "#6b8497",
    liquidation: "#a78bfa",
    eod: "#3b9dff",
  };

  return {
    byHour: hours.map((list, h) => toBucket(`${String(h).padStart(2, "0")}`, list)),
    byWeekday: days.map((list, d) => toBucket(WEEKDAYS[d], list)),
    byMonth: months.map((list, m) => toBucket(MONTHS[m], list)),
    byRegime: REGIME_ORDER.map((kind) => ({
      ...toBucket(REGIME_META[kind].th, regimes.get(kind) ?? []),
      kind,
    })),
    bySide: [toBucket("Long", longs), toBucket("Short", shorts)],
    byOutcome: (Object.keys(EXIT_META) as ExitReason[])
      .filter((k) => (outcomes.get(k) ?? 0) > 0)
      .map((k) => ({
        label: EXIT_META[k].th,
        count: outcomes.get(k) ?? 0,
        color: outcomeColor[k],
      })),
  };
}

/* ------------------------------------------------------------------ *
 * Walk-forward & Monte Carlo
 * ------------------------------------------------------------------ */

export type LabWalkForward = {
  windows: { label: string; result: LabResult }[];
  degradation: number;
  overfit: boolean;
  verdictTh: string;
};

export function labWalkForward(candles: Candle[], cfg: LabConfig): LabWalkForward {
  const n = candles.length;
  const a = Math.floor(n * 0.5);
  const b = Math.floor(n * 0.75);
  const windows = [
    { label: "In-Sample (50%)", result: runLab(candles.slice(0, a), cfg) },
    { label: "Validation (25%)", result: runLab(candles.slice(a, b), cfg) },
    { label: "Out-of-Sample (25%)", result: runLab(candles.slice(b), cfg) },
  ];

  const inS = windows[0].result;
  const out = windows[2].result;
  const degradation =
    inS.profitFactor > 0 ? ((inS.profitFactor - out.profitFactor) / inS.profitFactor) * 100 : 0;
  const overfit = degradation > 45 || (inS.profitFactor > 1.4 && out.profitFactor < 1);

  // A verdict drawn from a handful of trades is noise, and should say so.
  const thin = out.trades.length < 10 || inS.trades.length < 10;
  const caveat = thin
    ? ` — แต่ชุดนี้มีเพียง ${inS.trades.length} ไม้ในกลุ่มและ ${out.trades.length} ไม้นอกกลุ่ม จำนวนน้อยเกินกว่าจะสรุปได้มั่นใจ ควรขยายช่วงข้อมูล`
    : "";

  return {
    windows,
    degradation,
    overfit,
    verdictTh:
      (overfit
        ? `พบสัญญาณ Overfitting — Profit Factor ตกจาก ${inS.profitFactor.toFixed(2)} เหลือ ${out.profitFactor.toFixed(2)} (ลดลง ${degradation.toFixed(0)}%)`
        : `ผลนอกกลุ่มตัวอย่างต่างจากในกลุ่ม ${Math.abs(degradation).toFixed(0)}% — ยังไม่พบ Overfitting ชัดเจน`) + caveat,
  };
}

export type LabMonteCarlo = {
  runs: number;
  probProfit: number;
  median: number;
  p5: number;
  p95: number;
  worstDrawdown: number;
  medianDrawdown: number;
  riskOfRuin: number;
  distribution: number[];
};

/**
 * Bootstrap over the trades that actually happened. Reshuffling the order
 * thousands of times separates edge from a lucky sequence, and counts how often
 * the account would have been wiped out along the way.
 */
export function labMonteCarlo(result: LabResult, runs = 5000): LabMonteCarlo | null {
  const trades = result.trades;
  if (trades.length < 12) return null;

  const pnls = trades.map((t) => t.pnlUsd);
  const capital = result.config.capital;
  const finals: number[] = [];
  const dds: number[] = [];
  let ruined = 0;

  let seed = 20240520;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let run = 0; run < runs; run++) {
    let eq = capital;
    let peak = capital;
    let dd = 0;
    let dead = false;
    for (let i = 0; i < pnls.length; i++) {
      // Scale each sampled trade to the equity it would be taken on.
      eq += pnls[Math.floor(rand() * pnls.length)] * (eq / capital);
      if (eq <= capital * 0.2) dead = true;
      if (eq > peak) peak = eq;
      const d = peak ? ((peak - eq) / peak) * 100 : 0;
      if (d > dd) dd = d;
    }
    if (dead) ruined++;
    finals.push(((eq - capital) / capital) * 100);
    dds.push(dd);
  }

  finals.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);
  const at = (arr: number[], q: number) => arr[Math.min(arr.length - 1, Math.floor(arr.length * q))];

  return {
    runs,
    probProfit: (finals.filter((f) => f > 0).length / finals.length) * 100,
    median: at(finals, 0.5),
    p5: at(finals, 0.05),
    p95: at(finals, 0.95),
    worstDrawdown: at(dds, 0.99),
    medianDrawdown: at(dds, 0.5),
    riskOfRuin: (ruined / runs) * 100,
    distribution: finals,
  };
}

/* ------------------------------------------------------------------ *
 * Approval gates
 * ------------------------------------------------------------------ */

export type Gate = {
  id: string;
  label: string;
  detail: string;
  pass: boolean;
  value: string;
  threshold: string;
};

export function gateChecks(
  result: LabResult,
  wf: LabWalkForward | null,
  mc: LabMonteCarlo | null,
  maxDdAllowed: number,
): Gate[] {
  const gates: Gate[] = [
    {
      id: "pf",
      label: "Profit Factor",
      detail: "กำไรรวมต้องมากกว่าขาดทุนรวมอย่างมีนัย",
      pass: result.profitFactor >= 1.5,
      value: result.profitFactor.toFixed(2),
      threshold: "≥ 1.50",
    },
    {
      id: "dd",
      label: "Max Drawdown",
      detail: "ช่วงขาดทุนลึกสุดต้องไม่เกินเพดานที่ตั้งไว้",
      pass: result.maxDrawdown <= maxDdAllowed,
      value: `${result.maxDrawdown.toFixed(1)}%`,
      threshold: `≤ ${maxDdAllowed}%`,
    },
    {
      id: "count",
      label: "จำนวนไม้",
      detail: "ต้องมีตัวอย่างมากพอให้สถิติมีความหมาย",
      pass: result.trades.length >= 30,
      value: `${result.trades.length}`,
      threshold: "≥ 30",
    },
    {
      id: "net",
      label: "กำไรหลังหักต้นทุน",
      detail: "หัก Fee, Funding และ Slippage แล้วยังต้องเป็นบวก",
      pass: result.netProfit > 0,
      value: `${result.netProfit >= 0 ? "+" : ""}${result.netProfit.toFixed(0)}`,
      threshold: "> 0",
    },
    {
      id: "liq",
      label: "ความเสี่ยงล้างพอร์ต",
      detail: "ต้องไม่มีไม้ใดถูกบังคับปิดจากการโดน Liquidation",
      pass: result.liquidations === 0,
      value: `${result.liquidations} ครั้ง`,
      threshold: "= 0",
    },
  ];

  if (wf) {
    gates.push({
      id: "wf",
      label: "Walk-Forward",
      detail: "ผลนอกกลุ่มตัวอย่างต้องไม่ทรุดจากในกลุ่มมากเกินไป",
      pass: !wf.overfit,
      value: `${wf.degradation >= 0 ? "-" : "+"}${Math.abs(wf.degradation).toFixed(0)}%`,
      threshold: "ตกไม่เกิน 45%",
    });
  }

  if (mc) {
    gates.push({
      id: "ruin",
      label: "Risk of Ruin",
      detail: "โอกาสที่พอร์ตจะเหลือต่ำกว่า 20% ของทุนตั้งต้น",
      pass: mc.riskOfRuin < 5,
      value: `${mc.riskOfRuin.toFixed(1)}%`,
      threshold: "< 5%",
    });
  }

  return gates;
}

/* ------------------------------------------------------------------ *
 * AI review — every sentence traces to a number above
 * ------------------------------------------------------------------ */

export type AiReview = {
  grade: string;
  score: number;
  headline: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  adjustments: string[];
  bestRegime: string;
  worstRegime: string;
  bestHour: string;
  suitability: string;
  ready: boolean;
  readyNote: string;
};

export function aiReview(
  result: LabResult,
  dist: Distribution,
  wf: LabWalkForward | null,
  mc: LabMonteCarlo | null,
  gates: Gate[],
): AiReview {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const risks: string[] = [];
  const adjustments: string[] = [];
  const cfg = result.config;

  const traded = dist.byRegime.filter((r) => r.trades >= 3);
  const best = [...traded].sort((a, b) => b.pnl - a.pnl)[0];
  const worst = [...traded].sort((a, b) => a.pnl - b.pnl)[0];
  const bestHour = [...dist.byHour].filter((h) => h.trades >= 3).sort((a, b) => b.pnl - a.pnl)[0];

  if (result.profitFactor >= 1.5)
    strengths.push(`Profit Factor ${result.profitFactor.toFixed(2)} — กำไรรวมมากกว่าขาดทุนรวม ${result.profitFactor.toFixed(2)} เท่า`);
  if (result.winRate >= 50)
    strengths.push(`อัตราชนะ ${result.winRate.toFixed(1)}% จาก ${result.trades.length} ไม้`);
  if (result.riskReward >= 1.5)
    strengths.push(`ไม้ที่ชนะใหญ่กว่าไม้ที่แพ้ ${result.riskReward.toFixed(2)} เท่า`);
  if (result.returnPct > result.buyHoldPct)
    strengths.push(`ชนะการถือยาว (Buy & Hold) อยู่ ${(result.returnPct - result.buyHoldPct).toFixed(1)} จุด`);
  if (best && best.pnl > 0)
    strengths.push(`ทำงานได้ดีที่สุดในสภาวะ "${best.label}" (${best.trades} ไม้ · ชนะ ${best.winRate.toFixed(0)}%)`);
  if (result.sharpe >= 1)
    strengths.push(`Sharpe ${result.sharpe.toFixed(2)} — ผลตอบแทนต่อความผันผวนอยู่ในเกณฑ์ใช้ได้`);

  if (result.profitFactor < 1.5)
    weaknesses.push(`Profit Factor ${result.profitFactor.toFixed(2)} ต่ำกว่าเกณฑ์ 1.50 ที่ระบบกำหนด`);
  if (result.maxDrawdown > 20)
    weaknesses.push(`Max Drawdown ${result.maxDrawdown.toFixed(1)}% ถือว่าลึกสำหรับบัญชีเงินจริง`);
  if (result.trades.length < 30)
    weaknesses.push(`มีเพียง ${result.trades.length} ไม้ — ตัวอย่างน้อยเกินกว่าจะสรุปได้มั่นใจ`);
  if (worst && worst.pnl < 0)
    weaknesses.push(`ขาดทุนหนักที่สุดในสภาวะ "${worst.label}" (${worst.trades} ไม้ · ${worst.pnl.toFixed(0)} USDT)`);
  if (result.drawdown.worstLossStreak >= 5)
    weaknesses.push(`เคยแพ้ติดกัน ${result.drawdown.worstLossStreak} ไม้ รวม ${result.drawdown.worstStreakUsd.toFixed(0)} USDT`);
  if (wf?.overfit) weaknesses.push(wf.verdictTh);

  // How much of the frictionless result the costs consumed.
  const costShare =
    result.grossBeforeCosts > 0 ? (result.totalCosts / result.grossBeforeCosts) * 100 : 0;
  const costsFlipped = result.grossBeforeCosts > 0 && result.netProfit <= 0;

  if (result.liquidations > 0)
    risks.push(`ถูก Liquidation ${result.liquidations} ครั้งที่ Leverage ${cfg.leverage}x — เงินจริงจะเสียหายทันที`);
  if (costsFlipped)
    risks.push(`ถ้าไม่มีต้นทุนกลยุทธ์นี้จะได้กำไร ${result.grossBeforeCosts.toFixed(0)} แต่ Fee, Funding และ Slippage รวม ${result.totalCosts.toFixed(0)} พลิกให้กลายเป็นขาดทุน`);
  else if (costShare > 30)
    risks.push(`ต้นทุน (Fee + Funding + Slippage) กินผลตอบแทนก่อนหักต้นทุนไป ${costShare.toFixed(0)}%`);
  if (mc && mc.riskOfRuin >= 5)
    risks.push(`Monte Carlo ให้โอกาสพอร์ตเหลือต่ำกว่า 20% ของทุนอยู่ที่ ${mc.riskOfRuin.toFixed(1)}%`);
  if (mc && mc.worstDrawdown > result.maxDrawdown * 1.6)
    risks.push(`ลำดับไม้ที่แย่ที่สุดใน Monte Carlo ให้ Drawdown ${mc.worstDrawdown.toFixed(1)}% สูงกว่าที่เห็นใน Backtest มาก`);
  if (!result.drawdown.recovered)
    risks.push(`ยังไม่ฟื้นจาก Drawdown ล่าสุด — ปัจจุบันติดลบจากจุดสูงสุด ${result.drawdown.current.toFixed(1)}%`);
  if (cfg.leverage >= 10)
    risks.push(`Leverage ${cfg.leverage}x ทำให้ราคาสวนเพียง ${(100 / cfg.leverage).toFixed(1)}% ก็ถึงจุดล้างพอร์ต`);

  if (result.maxDrawdown > 20 && cfg.leverage > 3)
    adjustments.push(`ลด Leverage จาก ${cfg.leverage}x เหลือ ${Math.max(2, Math.floor(cfg.leverage / 2))}x เพื่อกด Drawdown ลงราวครึ่งหนึ่ง`);
  if (worst && worst.pnl < 0)
    adjustments.push(`ปิดการเทรดในสภาวะ "${worst.label}" ด้วยตัวกรองสภาวะตลาด`);
  if (result.riskReward < 1.2 && result.winRate < 55)
    adjustments.push(`ขยาย Take Profit จาก ${cfg.targetR}R เป็น ${(cfg.targetR + 0.6).toFixed(1)}R หรือขยับ Stop ให้แคบลง`);
  if (!cfg.trailing && result.trades.filter((t) => t.exitReason === "timeout").length > result.trades.length * 0.3)
    adjustments.push(`เปิด Trailing Stop — มี ${((result.trades.filter((t) => t.exitReason === "timeout").length / Math.max(result.trades.length, 1)) * 100).toFixed(0)}% ของไม้ที่ปิดเพราะหมดเวลาถือ`);
  if (costShare > 30 || costsFlipped)
    adjustments.push(`ยืด Timeframe ให้ยาวขึ้นจาก ${cfg.interval} เพื่อลดจำนวนครั้งที่จ่ายค่าธรรมเนียม`);
  if (bestHour)
    adjustments.push(`จำกัดเวลาเปิดสถานะไว้รอบชั่วโมง ${bestHour.label}:00 (เวลาไทย) ซึ่งให้ผลดีที่สุด`);
  if (result.trades.length < 30)
    adjustments.push("ขยายช่วงข้อมูลย้อนหลังหรือผ่อนเงื่อนไข Entry เพื่อให้ได้จำนวนไม้มากพอ");

  const passed = gates.filter((g) => g.pass).length;
  const score = Math.round((passed / Math.max(gates.length, 1)) * 100);
  const grade =
    score >= 95 ? "A+" : score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : score >= 40 ? "D" : "F";
  const failed = gates.filter((g) => !g.pass);

  return {
    grade,
    score,
    headline: result.ok
      ? `กลยุทธ์${STRATEGY_META[cfg.strategy].th}บน ${cfg.symbol} ${cfg.interval} ให้ผลตอบแทนสุทธิ ${result.returnPct >= 0 ? "+" : ""}${result.returnPct.toFixed(2)}% จาก ${result.trades.length} ไม้ หลังหักค่าธรรมเนียม Funding และ Slippage ครบแล้ว โดยมี Drawdown ลึกสุด ${result.maxDrawdown.toFixed(1)}%${best ? ` และทำงานได้ดีที่สุดในสภาวะ${best.label}` : ""}`
      : result.note,
    strengths,
    weaknesses,
    risks,
    adjustments,
    bestRegime: best?.label ?? "—",
    worstRegime: worst?.label ?? "—",
    bestHour: bestHour ? `${bestHour.label}:00` : "—",
    suitability: `${cfg.symbol} · ${cfg.interval} · ${cfg.market === "futures" ? "Futures" : "Spot"} · ${cfg.direction === "both" ? "สองทาง" : cfg.direction === "long" ? "ฝั่งซื้อเท่านั้น" : "ฝั่งขายเท่านั้น"}`,
    ready: failed.length === 0,
    readyNote:
      failed.length === 0
        ? "ผ่านเกณฑ์ครบทุกข้อ — ส่งต่อไป Paper Trading ได้"
        : `ยังไม่ผ่าน ${failed.length} เกณฑ์: ${failed.map((g) => g.label).join(", ")}`,
  };
}

/* ------------------------------------------------------------------ *
 * Comparison
 * ------------------------------------------------------------------ */

export type CompareRow = {
  kind: LabStrategyKind;
  name: string;
  result: LabResult;
  score: number;
};

/**
 * Runs every strategy over the identical candles and cost model, then ranks by
 * a score that pays for return but charges for drawdown — so a strategy cannot
 * win on profit alone.
 */
export function compareStrategies(candles: Candle[], cfg: LabConfig): CompareRow[] {
  const kinds = Object.keys(STRATEGY_META) as LabStrategyKind[];
  return kinds
    .map((kind) => {
      const result = runLab(candles, { ...cfg, strategy: kind });
      const score =
        result.returnPct * 0.6 -
        result.maxDrawdown * 1.2 +
        Math.min(result.profitFactor, 4) * 12 +
        Math.min(result.trades.length, 100) * 0.12 -
        result.liquidations * 25;
      return { kind, name: STRATEGY_META[kind].en, result, score };
    })
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ *
 * Export helpers
 * ------------------------------------------------------------------ */

export function tradesToCsv(trades: LabTrade[]): string {
  const head = [
    "id", "entry_time", "exit_time", "side", "entry", "exit", "stop", "target",
    "qty", "notional", "leverage", "fee", "funding", "slippage", "gross_pnl",
    "net_pnl", "pnl_pct", "r", "hold_bars", "hold_hours", "confidence",
    "regime", "entry_reason", "exit_reason", "result",
  ].join(",");

  const iso = (s: number) => new Date(s * 1000).toISOString();
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = trades.map((t) =>
    [
      t.id, iso(t.entryTime), iso(t.exitTime), t.side,
      t.entry.toFixed(6), t.exit.toFixed(6), t.stop.toFixed(6), t.target.toFixed(6),
      t.qty.toFixed(8), t.notional.toFixed(2), t.leverage,
      t.feeUsd.toFixed(4), t.fundingUsd.toFixed(4), t.slippageUsd.toFixed(4),
      t.grossUsd.toFixed(2), t.pnlUsd.toFixed(2), t.pnlPct.toFixed(3), t.r.toFixed(3),
      t.holdBars, t.holdHours.toFixed(2), t.confidence,
      REGIME_META[t.regime].en, esc(t.entryReason), EXIT_META[t.exitReason].th,
      t.pnlUsd > 0 ? "WIN" : "LOSS",
    ].join(","),
  );

  return [head, ...rows].join("\n");
}
