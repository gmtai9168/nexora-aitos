import {
  backtest,
  DEFAULT_PARAMS,
  KIND_META,
  type BacktestResult,
  type StrategyKind,
  type StrategyParams,
  type Trade,
} from "./strategy";
import type { Candle } from "./types";

/** The book of strategies the platform runs, with their capital weights. */
export const ROSTER: {
  id: string;
  name: string;
  aiName: string;
  kind: StrategyKind;
  weight: number;
  patch: Partial<StrategyParams>;
}[] = [
  { id: "trend", name: "Quantum Trend AI", aiName: "Trend Hunter", kind: "trend", weight: 0.25, patch: { emaFast: 12, emaSlow: 34, targetR: 2.2 } },
  { id: "flow", name: "AI Order Flow Pro", aiName: "Order Flow AI", kind: "breakout", weight: 0.2, patch: { emaFast: 12, emaSlow: 55, stopAtr: 2.2, targetR: 3 } },
  { id: "mean", name: "Mean Reversion X", aiName: "Mean Reversion AI", kind: "meanReversion", weight: 0.2, patch: { emaFast: 8, emaSlow: 55, rsiFilter: 62, targetR: 1.6 } },
  { id: "vol", name: "Volatility Breakout", aiName: "Volatility AI", kind: "breakout", weight: 0.15, patch: { emaFast: 21, emaSlow: 89, stopAtr: 2.6, targetR: 3.4 } },
  { id: "scalp", name: "Funding Rate Scalp", aiName: "Funding AI", kind: "scalping", weight: 0.1, patch: { emaFast: 8, emaSlow: 21, stopAtr: 1, targetR: 1.4 } },
  { id: "arb", name: "Arbitrage Hunter", aiName: "Liquidity AI", kind: "funding", weight: 0.1, patch: { emaFast: 12, emaSlow: 89, targetR: 2.4 } },
];

export type StrategyRow = {
  id: string;
  name: string;
  aiName: string;
  kindTh: string;
  color: string;
  weight: number;
  result: BacktestResult;
  /** Weighted share of the portfolio's total return. */
  contributionPct: number;
  sortino: number;
  calmar: number;
  accuracy: number;
  grade: "ดีเยี่ยม" | "ดี" | "พอใช้" | "ควรทบทวน";
};

function sortinoOf(equity: number[]): number {
  const rets: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    if (equity[i - 1]) rets.push(equity[i] / equity[i - 1] - 1);
  }
  if (rets.length < 3) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const down = rets.filter((r) => r < 0);
  const dsd = down.length
    ? Math.sqrt(down.reduce((a, r) => a + r ** 2, 0) / down.length)
    : 0;
  return dsd ? Math.max(-6, Math.min(9, (mean / dsd) * Math.sqrt(rets.length))) : 0;
}

/**
 * Runs every strategy on the same candles and blends them by weight.
 *
 * The blended curve is the portfolio; each strategy's contribution is its own
 * return times its weight, which is why the attribution always reconciles to
 * the headline number.
 */
export function runRoster(candles: Candle[], base: StrategyParams = DEFAULT_PARAMS) {
  const rows: StrategyRow[] = ROSTER.map((s) => {
    const result = backtest(candles, { ...base, kind: s.kind, ...s.patch });
    const sortino = sortinoOf(result.equity);
    const calmar = result.maxDrawdown > 0 ? result.returnPct / result.maxDrawdown : 0;

    const grade: StrategyRow["grade"] =
      result.profitFactor >= 1.8 && result.maxDrawdown < 15
        ? "ดีเยี่ยม"
        : result.profitFactor >= 1.3
          ? "ดี"
          : result.profitFactor >= 1
            ? "พอใช้"
            : "ควรทบทวน";

    return {
      id: s.id,
      name: s.name,
      aiName: s.aiName,
      kindTh: KIND_META[s.kind].th,
      color: KIND_META[s.kind].color,
      weight: s.weight,
      result,
      contributionPct: result.returnPct * s.weight,
      sortino,
      calmar,
      accuracy: result.winRate,
      grade,
    };
  });

  // Blended equity curve on a common index so the weights actually compose.
  const steps = 160;
  const portfolio: number[] = [];
  for (let i = 0; i < steps; i++) {
    let value = 0;
    for (const r of rows) {
      const eq = r.result.equity;
      if (eq.length < 2) {
        value += 100 * r.weight;
        continue;
      }
      const idx = Math.min(eq.length - 1, Math.floor((i / (steps - 1)) * (eq.length - 1)));
      value += eq[idx] * r.weight;
    }
    portfolio.push(value);
  }

  return { rows, portfolio };
}

/** Buy-and-hold on the same window — the benchmark every desk is judged against. */
export function buyHoldCurve(candles: Candle[], steps = 160): number[] {
  if (candles.length < 2) return [];
  const first = candles[0].close;
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const idx = Math.min(
      candles.length - 1,
      Math.floor((i / (steps - 1)) * (candles.length - 1)),
    );
    out.push((candles[idx].close / first) * 100);
  }
  return out;
}

export type CurveStat = {
  returnPct: number;
  maxDrawdown: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  volatility: number;
};

export function curveStat(curve: number[]): CurveStat {
  if (curve.length < 3) {
    return { returnPct: 0, maxDrawdown: 0, sharpe: 0, sortino: 0, calmar: 0, volatility: 0 };
  }

  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1]) rets.push(curve[i] / curve[i - 1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length);

  let peak = curve[0];
  let maxDd = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = peak ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  const returnPct = curve[0] ? ((curve.at(-1)! - curve[0]) / curve[0]) * 100 : 0;

  return {
    returnPct,
    maxDrawdown: maxDd,
    sharpe: sd ? Math.max(-6, Math.min(9, (mean / sd) * Math.sqrt(rets.length))) : 0,
    sortino: sortinoOf(curve),
    calmar: maxDd > 0 ? returnPct / maxDd : 0,
    volatility: sd * 100,
  };
}

export type PeriodRow = { label: string; bars: number; returnPct: number; vsBenchmark: number };

/** Trailing returns read off the end of the blended curve. */
export function periodReturns(
  portfolio: number[],
  benchmark: number[],
  interval: string,
): PeriodRow[] {
  const perDay = interval === "1h" ? 24 : interval === "4h" ? 6 : interval === "1d" ? 1 : 96;
  const scale = portfolio.length / Math.max(1, portfolio.length);

  const windows: { label: string; days: number }[] = [
    { label: "1 วัน", days: 1 },
    { label: "7 วัน", days: 7 },
    { label: "30 วัน", days: 30 },
    { label: "90 วัน", days: 90 },
    { label: "ทั้งหมด", days: 9999 },
  ];

  const ret = (series: number[], bars: number) => {
    if (series.length < 2) return 0;
    const from = series[Math.max(0, series.length - 1 - bars)];
    return from ? ((series.at(-1)! - from) / from) * 100 : 0;
  };

  return windows.map((w) => {
    // The blended curve has a fixed length, so windows map proportionally.
    const bars = Math.min(
      portfolio.length - 1,
      Math.round(((w.days * perDay) / (perDay * 90)) * portfolio.length * scale),
    );
    const span = w.days >= 9999 ? portfolio.length - 1 : Math.max(2, bars);
    return {
      label: w.label,
      bars: span,
      returnPct: ret(portfolio, span),
      vsBenchmark: ret(portfolio, span) - ret(benchmark, span),
    };
  });
}

export type MonthCell = { label: string; returnPct: number };

/** Calendar returns bucketed from the real candle timestamps. */
export function monthlyReturns(candles: Candle[], rows: StrategyRow[]): MonthCell[] {
  if (candles.length < 2) return [];

  const trades = rows.flatMap((r) =>
    r.result.trades.map((t) => ({ t, weight: r.weight, risk: DEFAULT_PARAMS.riskPct })),
  );
  if (trades.length === 0) return [];

  const byMonth = new Map<string, number>();
  for (const { t, weight, risk } of trades) {
    const d = new Date(t.exitTime * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth.set(key, (byMonth.get(key) ?? 0) + t.r * risk * weight);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({ label: key.slice(2), returnPct: v }));
}

export type TradeAnalytics = {
  total: number;
  avgHoldingBars: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  longestBars: number;
  shortestBars: number;
  byHour: { hour: number; trades: number; avgR: number }[];
  bySide: { side: string; trades: number; winRate: number }[];
  byReason: { reason: string; th: string; count: number }[];
};

/** Everything measured from the trades the engine actually produced. */
export function tradeAnalytics(rows: StrategyRow[]): TradeAnalytics {
  const trades: Trade[] = rows.flatMap((r) => r.result.trades);

  if (trades.length === 0) {
    return {
      total: 0,
      avgHoldingBars: 0,
      avgWin: 0,
      avgLoss: 0,
      bestTrade: 0,
      worstTrade: 0,
      longestBars: 0,
      shortestBars: 0,
      byHour: [],
      bySide: [],
      byReason: [],
    };
  }

  const holds = trades.map((t) => t.exitIndex - t.entryIndex);
  const wins = trades.filter((t) => t.r > 0);
  const losses = trades.filter((t) => t.r <= 0);

  const hourMap = new Map<number, { n: number; sum: number }>();
  for (const t of trades) {
    const h = new Date(t.entryTime * 1000).getUTCHours();
    const cur = hourMap.get(h) ?? { n: 0, sum: 0 };
    cur.n++;
    cur.sum += t.r;
    hourMap.set(h, cur);
  }

  const sideOf = (side: string) => {
    const list = trades.filter((t) => t.side === side);
    return {
      side,
      trades: list.length,
      winRate: list.length ? (list.filter((t) => t.r > 0).length / list.length) * 100 : 0,
    };
  };

  const reasonTh: Record<string, string> = {
    target: "ถึงเป้าหมาย",
    stop: "ชน Stop",
    timeout: "ครบเวลาถือ",
  };

  return {
    total: trades.length,
    avgHoldingBars: holds.reduce((a, b) => a + b, 0) / holds.length,
    avgWin: wins.length ? wins.reduce((a, t) => a + t.pnlPct, 0) / wins.length : 0,
    avgLoss: losses.length ? losses.reduce((a, t) => a + t.pnlPct, 0) / losses.length : 0,
    bestTrade: Math.max(...trades.map((t) => t.pnlPct)),
    worstTrade: Math.min(...trades.map((t) => t.pnlPct)),
    longestBars: Math.max(...holds),
    shortestBars: Math.min(...holds),
    byHour: Array.from({ length: 24 }, (_, h) => {
      const d = hourMap.get(h);
      return { hour: h, trades: d?.n ?? 0, avgR: d && d.n ? d.sum / d.n : 0 };
    }),
    bySide: [sideOf("LONG"), sideOf("SHORT")],
    byReason: (["target", "stop", "timeout"] as const).map((reason) => ({
      reason,
      th: reasonTh[reason],
      count: trades.filter((t) => t.reason === reason).length,
    })),
  };
}

export type RiskAnalytics = {
  avgRiskPct: number;
  maxRiskPct: number;
  leverage: number;
  liquidations: number;
  worstStreak: number;
  bestStreak: number;
  exposureBars: number;
  totalBars: number;
};

export function riskAnalytics(rows: StrategyRow[], bars: number): RiskAnalytics {
  const trades = rows.flatMap((r) => r.result.trades);
  if (trades.length === 0) {
    return {
      avgRiskPct: 0,
      maxRiskPct: 0,
      leverage: 0,
      liquidations: 0,
      worstStreak: 0,
      bestStreak: 0,
      exposureBars: 0,
      totalBars: bars,
    };
  }

  // Consecutive win/loss runs — the practical measure of a strategy's pain.
  let worst = 0;
  let best = 0;
  let runLoss = 0;
  let runWin = 0;
  for (const t of [...trades].sort((a, b) => a.entryTime - b.entryTime)) {
    if (t.r > 0) {
      runWin++;
      runLoss = 0;
      best = Math.max(best, runWin);
    } else {
      runLoss++;
      runWin = 0;
      worst = Math.max(worst, runLoss);
    }
  }

  const exposure = trades.reduce((a, t) => a + (t.exitIndex - t.entryIndex), 0);

  return {
    avgRiskPct: DEFAULT_PARAMS.riskPct,
    maxRiskPct: DEFAULT_PARAMS.riskPct * 1.5,
    leverage: DEFAULT_PARAMS.leverage,
    // A stop is always honoured in the simulator, so nothing is ever liquidated.
    liquidations: 0,
    worstStreak: worst,
    bestStreak: best,
    exposureBars: exposure,
    totalBars: bars,
  };
}

export type TwinResult = {
  id: string;
  th: string;
  returnPct: number;
  maxDrawdown: number;
  sharpe: number;
  deltaReturn: number;
  deltaDrawdown: number;
  verdict: "ดีขึ้น" | "แย่ลง" | "ใกล้เคียง";
};

/**
 * Performance Digital Twin — re-runs the whole book under a changed assumption
 * and reports the difference. Every row is a full set of backtests, not an
 * estimate.
 */
export function performanceTwin(
  candles: Candle[],
  base: StrategyParams,
  baseline: CurveStat,
): TwinResult[] {
  const variants: { id: string; th: string; build: () => number[] }[] = [
    {
      id: "lev10",
      th: "ใช้ความเสี่ยงต่อไม้ 0.33% แทน 0.5%",
      build: () => runRoster(candles, { ...base, riskPct: 0.33 }).portfolio,
    },
    {
      id: "lev75",
      th: "เพิ่มความเสี่ยงต่อไม้เป็น 0.75%",
      build: () => runRoster(candles, { ...base, riskPct: 0.75 }).portfolio,
    },
    {
      id: "no-scalp",
      th: "ปิด Funding Rate Scalp",
      build: () => {
        const { rows } = runRoster(candles, base);
        const kept = rows.filter((r) => r.id !== "scalp");
        const total = kept.reduce((a, r) => a + r.weight, 0) || 1;
        const steps = 160;
        return Array.from({ length: steps }, (_, i) => {
          let v = 0;
          for (const r of kept) {
            const eq = r.result.equity;
            const idx =
              eq.length < 2
                ? 0
                : Math.min(eq.length - 1, Math.floor((i / (steps - 1)) * (eq.length - 1)));
            v += (eq[idx] ?? 100) * (r.weight / total);
          }
          return v;
        });
      },
    },
    {
      id: "wider-stop",
      th: "ขยาย Stop เป็น 2.2 ATR",
      build: () => runRoster(candles, { ...base, stopAtr: 2.2 }).portfolio,
    },
  ];

  return variants.map((v) => {
    const stat = curveStat(v.build());
    const deltaReturn = stat.returnPct - baseline.returnPct;
    const deltaDrawdown = stat.maxDrawdown - baseline.maxDrawdown;

    return {
      id: v.id,
      th: v.th,
      returnPct: stat.returnPct,
      maxDrawdown: stat.maxDrawdown,
      sharpe: stat.sharpe,
      deltaReturn,
      deltaDrawdown,
      verdict:
        Math.abs(deltaReturn) < 0.4 && Math.abs(deltaDrawdown) < 0.4
          ? "ใกล้เคียง"
          : deltaReturn - deltaDrawdown > 0
            ? "ดีขึ้น"
            : "แย่ลง",
    };
  });
}

export type Improvement = { id: string; th: string; reason: string; priority: "สูง" | "กลาง" | "ต่ำ" };

export function improvements(
  rows: StrategyRow[],
  trade: TradeAnalytics,
  stat: CurveStat,
  twin: TwinResult[],
): Improvement[] {
  const out: Improvement[] = [];

  const weakest = [...rows].sort((a, b) => a.result.profitFactor - b.result.profitFactor)[0];
  if (weakest && weakest.result.profitFactor < 1) {
    out.push({
      id: "drop",
      th: `พักการใช้งาน ${weakest.name} ชั่วคราว`,
      reason: `Profit Factor ${weakest.result.profitFactor.toFixed(2)} ต่ำกว่า 1 — ยังขาดทุนสุทธิในช่วงที่ทดสอบ`,
      priority: "สูง",
    });
  }

  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
  if (best && best.result.profitFactor > 1.3) {
    out.push({
      id: "boost",
      th: `เพิ่มน้ำหนักให้ ${best.name}`,
      reason: `Profit Factor ${best.result.profitFactor.toFixed(2)} สูงสุดในกลุ่ม · ปัจจุบันถือน้ำหนักเพียง ${(best.weight * 100).toFixed(0)}%`,
      priority: "สูง",
    });
  }

  const bestTwin = [...twin].sort((a, b) => b.deltaReturn - b.deltaDrawdown - (a.deltaReturn - a.deltaDrawdown))[0];
  if (bestTwin && bestTwin.verdict === "ดีขึ้น") {
    out.push({
      id: "twin",
      th: bestTwin.th,
      reason: `ผลจำลอง: ผลตอบแทน ${bestTwin.deltaReturn >= 0 ? "+" : ""}${bestTwin.deltaReturn.toFixed(2)}% · Drawdown ${bestTwin.deltaDrawdown >= 0 ? "+" : ""}${bestTwin.deltaDrawdown.toFixed(2)}%`,
      priority: "กลาง",
    });
  }

  const worstHour = [...trade.byHour]
    .filter((h) => h.trades >= 3)
    .sort((a, b) => a.avgR - b.avgR)[0];
  if (worstHour && worstHour.avgR < -0.15) {
    out.push({
      id: "hour",
      th: `หลีกเลี่ยงการเปิดสถานะช่วง ${String(worstHour.hour).padStart(2, "0")}:00 UTC`,
      reason: `ผลเฉลี่ยต่อไม้ในชั่วโมงนี้ ${worstHour.avgR.toFixed(2)}R จาก ${worstHour.trades} ไม้`,
      priority: "กลาง",
    });
  }

  if (stat.maxDrawdown > 15) {
    out.push({
      id: "dd",
      th: "ลดขนาดความเสี่ยงต่อไม้ลง",
      reason: `Drawdown ของพอร์ตรวมอยู่ที่ ${stat.maxDrawdown.toFixed(2)}% เกินเกณฑ์สบายใจ 15%`,
      priority: "สูง",
    });
  }

  if (trade.bySide[1] && trade.bySide[1].winRate < 40 && trade.bySide[1].trades > 10) {
    out.push({
      id: "short",
      th: "ทบทวนเงื่อนไขฝั่ง SHORT",
      reason: `ฝั่ง SHORT ชนะเพียง ${trade.bySide[1].winRate.toFixed(0)}% จาก ${trade.bySide[1].trades} ไม้`,
      priority: "กลาง",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "ok",
      th: "ยังไม่มีจุดที่ต้องแก้เร่งด่วน",
      reason: "ทุกกลยุทธ์และทุกตัวชี้วัดอยู่ในเกณฑ์ที่ตั้งไว้",
      priority: "ต่ำ",
    });
  }

  return out;
}
