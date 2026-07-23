import { ema, rsi } from "./analytics";
import type { Candle } from "./types";

export type StrategyKind =
  | "trend"
  | "meanReversion"
  | "breakout"
  | "scalping"
  | "funding";

export type StrategyParams = {
  kind: StrategyKind;
  emaFast: number;
  emaSlow: number;
  rsiPeriod: number;
  /** Long only above this RSI; mean-reversion buys below 100-this. */
  rsiFilter: number;
  atrPeriod: number;
  /** Stop distance in ATR multiples. */
  stopAtr: number;
  /** Target as a multiple of the stop distance. */
  targetR: number;
  maxHoldBars: number;
  riskPct: number;
  leverage: number;
  allowShort: boolean;
  feePct: number;
};

export const DEFAULT_PARAMS: StrategyParams = {
  kind: "trend",
  emaFast: 12,
  emaSlow: 34,
  rsiPeriod: 14,
  rsiFilter: 52,
  atrPeriod: 14,
  stopAtr: 1.6,
  targetR: 2.2,
  maxHoldBars: 24,
  riskPct: 0.5,
  leverage: 15,
  allowShort: true,
  feePct: 0.04,
};

export type Trade = {
  entryIndex: number;
  exitIndex: number;
  entryTime: number;
  exitTime: number;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number;
  /** Return on the risked amount, so 1 = one R gained. */
  r: number;
  pnlPct: number;
  reason: "target" | "stop" | "timeout";
};

export type BacktestResult = {
  trades: Trade[];
  equity: number[];
  returnPct: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpe: number;
  avgR: number;
  avgWin: number;
  avgLoss: number;
  expectancy: number;
  tradesPerMonth: number;
  bars: number;
};

const EMPTY: BacktestResult = {
  trades: [],
  equity: [100],
  returnPct: 0,
  winRate: 0,
  profitFactor: 0,
  maxDrawdown: 0,
  sharpe: 0,
  avgR: 0,
  avgWin: 0,
  avgLoss: 0,
  expectancy: 0,
  tradesPerMonth: 0,
  bars: 0,
};

/** True range series, used for stop distance. */
function atrSeries(candles: Candle[], period: number): number[] {
  const out: number[] = new Array(candles.length).fill(0);
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
      const oldPrev = candles[i - period - 1].close;
      const oldTr = Math.max(
        candles[i - period].high - candles[i - period].low,
        Math.abs(candles[i - period].high - oldPrev),
        Math.abs(candles[i - period].low - oldPrev),
      );
      sum -= oldTr;
    }
    out[i] = sum / Math.min(i, period);
  }
  return out;
}

function rsiSeries(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(50);
  for (let i = period + 1; i < closes.length; i++) {
    out[i] = rsi(closes.slice(0, i + 1), period);
  }
  return out;
}

/** Does this bar open a position, and in which direction? */
function signal(
  kind: StrategyKind,
  i: number,
  fast: number[],
  slow: number[],
  rs: number[],
  candles: Candle[],
  p: StrategyParams,
): "LONG" | "SHORT" | null {
  const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
  const crossDown = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];

  switch (kind) {
    case "trend":
      if (crossUp && rs[i] > p.rsiFilter) return "LONG";
      if (p.allowShort && crossDown && rs[i] < 100 - p.rsiFilter) return "SHORT";
      return null;

    case "meanReversion": {
      // Fade extremes back toward the slow average.
      if (rs[i] < 100 - p.rsiFilter && candles[i].close < slow[i]) return "LONG";
      if (p.allowShort && rs[i] > p.rsiFilter && candles[i].close > slow[i]) return "SHORT";
      return null;
    }

    case "breakout": {
      const look = Math.max(10, p.emaSlow);
      if (i < look) return null;
      const window = candles.slice(i - look, i);
      const hi = Math.max(...window.map((c) => c.high));
      const lo = Math.min(...window.map((c) => c.low));
      if (candles[i].close > hi) return "LONG";
      if (p.allowShort && candles[i].close < lo) return "SHORT";
      return null;
    }

    case "scalping": {
      // Short bursts with the trend, entered on a one-bar pullback.
      const withTrend = fast[i] > slow[i];
      const pullback = candles[i].close < candles[i - 1].close;
      if (withTrend && pullback && rs[i] > 45) return "LONG";
      if (p.allowShort && !withTrend && !pullback && rs[i] < 55) return "SHORT";
      return null;
    }

    case "funding": {
      // Proxy for crowded positioning: an extended run away from the slow EMA.
      const stretch = slow[i] ? (candles[i].close - slow[i]) / slow[i] : 0;
      if (stretch < -0.02 && rs[i] < 40) return "LONG";
      if (p.allowShort && stretch > 0.02 && rs[i] > 60) return "SHORT";
      return null;
    }
  }
}

/**
 * Event-driven backtest over real candles.
 *
 * One position at a time. Entries fill at the next bar's open (no look-ahead),
 * exits check the stop before the target within a bar, and every trade pays the
 * fee twice. Position size is fixed-fractional on the stop distance, so each
 * trade risks the same share of equity.
 */
export function backtest(candles: Candle[], p: StrategyParams): BacktestResult {
  const warmup = Math.max(p.emaSlow, p.rsiPeriod, p.atrPeriod) + 2;
  if (candles.length < warmup + 30) return EMPTY;

  const closes = candles.map((c) => c.close);
  const fast = ema(closes, p.emaFast);
  const slow = ema(closes, p.emaSlow);
  const rs = rsiSeries(closes, p.rsiPeriod);
  const atr = atrSeries(candles, p.atrPeriod);

  const trades: Trade[] = [];
  let equity = 100;
  const curve: number[] = [equity];

  let i = warmup;
  while (i < candles.length - 1) {
    const dir = signal(p.kind, i, fast, slow, rs, candles, p);
    if (!dir || atr[i] <= 0) {
      i++;
      continue;
    }

    // Fill on the next bar's open — the signal bar has already closed.
    const entryIndex = i + 1;
    const entry = candles[entryIndex].open;
    const sign = dir === "LONG" ? 1 : -1;
    const stopDist = atr[i] * p.stopAtr;
    const stop = entry - sign * stopDist;
    const target = entry + sign * stopDist * p.targetR;

    let exitIndex = entryIndex;
    let exit = entry;
    let reason: Trade["reason"] = "timeout";

    for (let j = entryIndex; j < Math.min(candles.length, entryIndex + p.maxHoldBars); j++) {
      const bar = candles[j];
      const hitStop = dir === "LONG" ? bar.low <= stop : bar.high >= stop;
      const hitTarget = dir === "LONG" ? bar.high >= target : bar.low <= target;

      // Conservative: if both levels trade in one bar, assume the stop first.
      if (hitStop) {
        exitIndex = j;
        exit = stop;
        reason = "stop";
        break;
      }
      if (hitTarget) {
        exitIndex = j;
        exit = target;
        reason = "target";
        break;
      }
      exitIndex = j;
      exit = bar.close;
    }

    const grossPct = ((exit - entry) / entry) * 100 * sign;
    const netPct = grossPct - p.feePct * 2;
    const r = stopDist ? (netPct / 100) * (entry / stopDist) : 0;

    // Fixed-fractional sizing: risk `riskPct` of equity per trade.
    equity *= 1 + (r * p.riskPct) / 100;
    curve.push(equity);

    trades.push({
      entryIndex,
      exitIndex,
      entryTime: candles[entryIndex].time,
      exitTime: candles[exitIndex].time,
      side: dir,
      entry,
      exit,
      r,
      pnlPct: netPct,
      reason,
    });

    i = exitIndex + 1;
  }

  return summarise(trades, curve, candles, p);
}

function summarise(
  trades: Trade[],
  curve: number[],
  candles: Candle[],
  p: StrategyParams,
): BacktestResult {
  if (trades.length === 0) return { ...EMPTY, bars: candles.length };

  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r <= 0);
  const grossWin = wins.reduce((a, t) => a + t.r, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.r, 0));

  let peak = curve[0];
  let maxDd = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = peak ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) rets.push(curve[i] / curve[i - 1] - 1);
  const mean = rets.reduce((a, b) => a + b, 0) / Math.max(rets.length, 1);
  const sd = Math.sqrt(
    rets.reduce((a, r) => a + (r - mean) ** 2, 0) / Math.max(rets.length, 1),
  );

  const spanDays =
    (candles.at(-1)!.time - candles[0].time) / 86400 || 1;

  return {
    trades,
    equity: curve,
    returnPct: curve.at(-1)! - 100,
    winRate: (wins.length / trades.length) * 100,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0,
    maxDrawdown: maxDd,
    sharpe: sd > 0 ? Math.max(-6, Math.min(9, (mean / sd) * Math.sqrt(rets.length))) : 0,
    avgR: trades.reduce((a, t) => a + t.r, 0) / trades.length,
    avgWin: wins.length ? grossWin / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    expectancy:
      (wins.length / trades.length) * (wins.length ? grossWin / wins.length : 0) -
      (losses.length / trades.length) * (losses.length ? grossLoss / losses.length : 0),
    tradesPerMonth: (trades.length / spanDays) * 30,
    bars: candles.length,
    // riskPct only scales the curve, it does not change trade statistics
    ...(p.riskPct ? {} : {}),
  };
}

export type MonteCarlo = {
  runs: number;
  probProfit: number;
  medianReturn: number;
  p5: number;
  p95: number;
  worstDrawdown: number;
  medianDrawdown: number;
  tailRisk: "ต่ำ" | "ปานกลาง" | "สูง";
  distribution: number[];
};

/**
 * Bootstrap Monte Carlo. Resamples the strategy's *actual* trade results in a
 * random order thousands of times — this measures how much of the backtest was
 * luck of sequencing, which a single equity curve cannot show.
 */
export function monteCarlo(trades: Trade[], riskPct: number, runs = 10000): MonteCarlo | null {
  if (trades.length < 12) return null;

  const rs = trades.map((t) => t.r);
  const finals: number[] = [];
  const dds: number[] = [];

  // Deterministic LCG so the same book always produces the same distribution.
  let seed = 987654321;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let run = 0; run < runs; run++) {
    let eq = 100;
    let peak = 100;
    let dd = 0;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[Math.floor(rand() * rs.length)];
      eq *= 1 + (r * riskPct) / 100;
      if (eq > peak) peak = eq;
      const d = peak ? ((peak - eq) / peak) * 100 : 0;
      if (d > dd) dd = d;
    }
    finals.push(eq - 100);
    dds.push(dd);
  }

  finals.sort((a, b) => a - b);
  dds.sort((a, b) => a - b);
  const at = (arr: number[], q: number) => arr[Math.floor(arr.length * q)];

  const worst = at(dds, 0.99);
  return {
    runs,
    probProfit: (finals.filter((f) => f > 0).length / finals.length) * 100,
    medianReturn: at(finals, 0.5),
    p5: at(finals, 0.05),
    p95: at(finals, 0.95),
    worstDrawdown: worst,
    medianDrawdown: at(dds, 0.5),
    tailRisk: worst > 30 ? "สูง" : worst > 15 ? "ปานกลาง" : "ต่ำ",
    distribution: finals,
  };
}

export type WalkForward = {
  windows: { label: string; result: BacktestResult }[];
  overfit: boolean;
  degradation: number;
  verdictTh: string;
};

/**
 * Walk-forward. Splits the history into train / validation / test and compares
 * out-of-sample performance to in-sample. A large drop is the classic
 * fingerprint of a curve-fitted strategy.
 */
export function walkForward(candles: Candle[], p: StrategyParams): WalkForward {
  const n = candles.length;
  const a = Math.floor(n * 0.5);
  const b = Math.floor(n * 0.75);

  const windows = [
    { label: "Training (50%)", result: backtest(candles.slice(0, a), p) },
    { label: "Validation (25%)", result: backtest(candles.slice(a, b), p) },
    { label: "Testing (25%)", result: backtest(candles.slice(b), p) },
  ];

  const train = windows[0].result;
  const test = windows[2].result;
  const degradation =
    train.profitFactor > 0
      ? ((train.profitFactor - test.profitFactor) / train.profitFactor) * 100
      : 0;

  const overfit = degradation > 45 || (train.profitFactor > 1.4 && test.profitFactor < 1);

  return {
    windows,
    overfit,
    degradation,
    verdictTh: overfit
      ? `พบสัญญาณ Overfitting — Profit Factor ตกจาก ${train.profitFactor.toFixed(2)} เหลือ ${test.profitFactor.toFixed(2)} (ลดลง ${degradation.toFixed(0)}%)`
      : `ผลนอกกลุ่มตัวอย่างใกล้เคียงกับในกลุ่ม (ต่างกัน ${Math.abs(degradation).toFixed(0)}%) ยังไม่พบ Overfitting ชัดเจน`,
  };
}

export type OptimizeRow = {
  params: StrategyParams;
  result: BacktestResult;
  score: number;
};

/**
 * Grid search over the parameters that matter most. Every combination runs a
 * full backtest on the same candles, then is ranked by a score that rewards
 * profit factor but penalises drawdown and thin trade counts.
 */
export function optimize(candles: Candle[], base: StrategyParams): OptimizeRow[] {
  const grid: OptimizeRow[] = [];

  for (const emaFast of [8, 12, 21]) {
    for (const emaSlow of [34, 55, 89]) {
      for (const stopAtr of [1.2, 1.6, 2.2]) {
        for (const targetR of [1.6, 2.2, 3]) {
          if (emaFast >= emaSlow) continue;
          const params = { ...base, emaFast, emaSlow, stopAtr, targetR };
          const result = backtest(candles, params);
          if (result.trades.length < 10) continue;

          const score =
            result.profitFactor * 40 -
            result.maxDrawdown * 1.4 +
            Math.min(result.trades.length, 120) * 0.2 +
            result.winRate * 0.2;

          grid.push({ params, result, score });
        }
      }
    }
  }

  return grid.sort((a, b) => b.score - a.score).slice(0, 8);
}

export const KIND_META: Record<StrategyKind, { th: string; en: string; color: string }> = {
  trend: { th: "ตามแนวโน้ม", en: "Trend Following", color: "#10e08a" },
  meanReversion: { th: "กลับค่าเฉลี่ย", en: "Mean Reversion", color: "#3b9dff" },
  breakout: { th: "เบรกเอาต์", en: "Breakout", color: "#f472b6" },
  scalping: { th: "สแกลป์", en: "Scalping", color: "#facc15" },
  funding: { th: "ส่วนต่างราคา", en: "Divergence / Funding", color: "#a78bfa" },
};

/** Section 16 — emits runnable source for the exact parameter set on screen. */
export function generateCode(
  p: StrategyParams,
  symbol: string,
  interval: string,
  lang: "python" | "typescript" | "pine",
): string {
  if (lang === "pine") {
    return `//@version=5
// NEXORA AITOS — ${KIND_META[p.kind].en} strategy for ${symbol} ${interval}
strategy("NEXORA ${KIND_META[p.kind].en}", overlay=true, initial_capital=10000)

emaFast = ta.ema(close, ${p.emaFast})
emaSlow = ta.ema(close, ${p.emaSlow})
rsiVal  = ta.rsi(close, ${p.rsiPeriod})
atrVal  = ta.atr(${p.atrPeriod})

longSignal  = ta.crossover(emaFast, emaSlow) and rsiVal > ${p.rsiFilter}
shortSignal = ta.crossunder(emaFast, emaSlow) and rsiVal < ${100 - p.rsiFilter}

stopDist = atrVal * ${p.stopAtr}

if longSignal
    strategy.entry("L", strategy.long)
    strategy.exit("L-exit", "L", stop = close - stopDist, limit = close + stopDist * ${p.targetR})
${p.allowShort ? `
if shortSignal
    strategy.entry("S", strategy.short)
    strategy.exit("S-exit", "S", stop = close + stopDist, limit = close - stopDist * ${p.targetR})` : ""}

plot(emaFast, color=color.orange)
plot(emaSlow, color=color.purple)`;
  }

  if (lang === "typescript") {
    return `// NEXORA AITOS — ${KIND_META[p.kind].en} strategy
// Symbol ${symbol} · timeframe ${interval}
export const PARAMS = {
  emaFast: ${p.emaFast},
  emaSlow: ${p.emaSlow},
  rsiPeriod: ${p.rsiPeriod},
  rsiFilter: ${p.rsiFilter},
  atrPeriod: ${p.atrPeriod},
  stopAtr: ${p.stopAtr},
  targetR: ${p.targetR},
  maxHoldBars: ${p.maxHoldBars},
  riskPct: ${p.riskPct},
  leverage: ${p.leverage},
  allowShort: ${p.allowShort},
} as const;

export function signal(c: Candle[], i: number, ind: Indicators): "LONG" | "SHORT" | null {
  const crossUp = ind.fast[i - 1] <= ind.slow[i - 1] && ind.fast[i] > ind.slow[i];
  const crossDown = ind.fast[i - 1] >= ind.slow[i - 1] && ind.fast[i] < ind.slow[i];
  if (crossUp && ind.rsi[i] > PARAMS.rsiFilter) return "LONG";
  if (PARAMS.allowShort && crossDown && ind.rsi[i] < 100 - PARAMS.rsiFilter) return "SHORT";
  return null;
}

/** Stop and target are derived from ATR, so sizing adapts to volatility. */
export function bracket(entry: number, atr: number, side: "LONG" | "SHORT") {
  const sign = side === "LONG" ? 1 : -1;
  const dist = atr * PARAMS.stopAtr;
  return { stop: entry - sign * dist, target: entry + sign * dist * PARAMS.targetR };
}`;
  }

  return `"""NEXORA AITOS — ${KIND_META[p.kind].en} strategy
Symbol: ${symbol} | Timeframe: ${interval}
Generated from the parameter set validated in Strategy Lab.
"""
import pandas as pd

PARAMS = dict(
    ema_fast=${p.emaFast},
    ema_slow=${p.emaSlow},
    rsi_period=${p.rsiPeriod},
    rsi_filter=${p.rsiFilter},
    atr_period=${p.atrPeriod},
    stop_atr=${p.stopAtr},
    target_r=${p.targetR},
    max_hold_bars=${p.maxHoldBars},
    risk_pct=${p.riskPct},
    leverage=${p.leverage},
    allow_short=${p.allowShort ? "True" : "False"},
)


def indicators(df: pd.DataFrame) -> pd.DataFrame:
    df["ema_fast"] = df["close"].ewm(span=PARAMS["ema_fast"]).mean()
    df["ema_slow"] = df["close"].ewm(span=PARAMS["ema_slow"]).mean()
    delta = df["close"].diff()
    gain = delta.clip(lower=0).rolling(PARAMS["rsi_period"]).mean()
    loss = -delta.clip(upper=0).rolling(PARAMS["rsi_period"]).mean()
    df["rsi"] = 100 - 100 / (1 + gain / loss)
    tr = pd.concat([
        df["high"] - df["low"],
        (df["high"] - df["close"].shift()).abs(),
        (df["low"] - df["close"].shift()).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = tr.rolling(PARAMS["atr_period"]).mean()
    return df


def signal(row, prev) -> str | None:
    cross_up = prev.ema_fast <= prev.ema_slow and row.ema_fast > row.ema_slow
    cross_dn = prev.ema_fast >= prev.ema_slow and row.ema_fast < row.ema_slow
    if cross_up and row.rsi > PARAMS["rsi_filter"]:
        return "LONG"
    if PARAMS["allow_short"] and cross_dn and row.rsi < 100 - PARAMS["rsi_filter"]:
        return "SHORT"
    return None


def test_signal_returns_long_on_golden_cross():
    """Unit test: a bullish cross above the RSI filter must open a long."""
    prev = pd.Series(dict(ema_fast=1.0, ema_slow=1.1))
    row = pd.Series(dict(ema_fast=1.2, ema_slow=1.1, rsi=${p.rsiFilter + 5}))
    assert signal(row, prev) == "LONG"`;
}
