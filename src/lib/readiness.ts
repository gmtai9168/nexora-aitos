import { memoryView, MIN_SAMPLES, type AiMemory } from "./ai-memory";

/**
 * Go-Live readiness — turns the AI's real (testnet) track record into a plain
 * pass/fail checklist so it's obvious whether the strategy has earned the right
 * to risk real money, and exactly what is still missing.
 *
 * Tuned for a TREND/MOMENTUM strategy: such systems win <50% of the time but
 * make money because winners are bigger than losers, so Profit Factor and
 * expectancy — not raw win rate — are the real edge measures. Win rate is kept
 * only as a sanity floor. A consistency gate (the recent half of trades must
 * still be profitable) guards against an edge that was really just a favourable
 * market streak. Deliberately strict: these gates exist to stop deploying an
 * unproven, leveraged bot. Passing them means "eligible for a small, careful
 * live test", not "safe to size up".
 */

export const GATES = {
  MIN_TRADES: 300, // enough samples for the numbers to mean something
  MIN_PROFIT_FACTOR: 1.6, // gross win / gross loss — buffered above 1.5 for real-world cost drag
  MIN_RECENT_PF: 1.3, // the most-recent half must still show an edge (not early luck)
  MIN_WIN_RATE_FLOOR: 40, // % — a floor, not a target; catches degenerate profiles
  MAX_DRAWDOWN: 20, // % peak-to-trough on the equity curve
  MIN_REGIMES: 3, // proven across different market conditions
} as const;

export type Check = {
  id: string;
  label: string;
  current: string;
  target: string;
  pass: boolean;
  detail: string;
};

export type Readiness = {
  checks: Check[];
  passed: number;
  total: number;
  ready: boolean;
  tradesRemaining: number;
  score: number;
};

function maxDrawdownPct(series: number[], startEquity: number): number | null {
  if (!series.length) return null;
  let eq = startEquity;
  let peak = startEquity;
  let maxDd = 0;
  for (const p of series) {
    eq += p;
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

function profitFactor(series: number[]): number | null {
  if (!series.length) return null;
  let gw = 0;
  let gl = 0;
  for (const p of series) {
    if (p > 0) gw += p;
    else gl += -p;
  }
  if (gl === 0) return gw > 0 ? Infinity : null;
  return gw / gl;
}

const pfLabel = (pf: number | null) =>
  pf === null ? "รอเก็บข้อมูล" : pf === Infinity ? "∞" : pf.toFixed(2);

export function computeReadiness(mem: AiMemory, startEquity = 5000): Readiness {
  const view = memoryView(mem);
  const closed = mem.totalClosed;
  const winRate = closed > 0 ? (mem.totalWins / closed) * 100 : 0;
  const series = mem.pnlSeries ?? [];

  // Prefer the exact gross sums when present; fall back to the pnl series.
  const grossWin = mem.grossWin ?? 0;
  const grossLoss = mem.grossLoss ?? 0;
  const pf = grossWin > 0 || grossLoss > 0 ? (grossLoss > 0 ? grossWin / grossLoss : Infinity) : profitFactor(series);

  // Consistency: profit factor of the most-recent half of trades.
  const recentPf =
    series.length >= 40 ? profitFactor(series.slice(Math.floor(series.length / 2))) : null;

  const dd = maxDrawdownPct(series, startEquity);
  const regimes = new Set(view.buckets.filter((b) => b.trades >= MIN_SAMPLES).map((b) => b.regime));
  const tradesRemaining = Math.max(0, GATES.MIN_TRADES - closed);

  const pfPass = pf !== null && pf >= GATES.MIN_PROFIT_FACTOR;
  const recentPass = recentPf !== null && recentPf >= GATES.MIN_RECENT_PF;

  const checks: Check[] = [
    {
      id: "trades",
      label: "จำนวนไม้ที่ปิดแล้ว (Sample size)",
      current: `${closed} ไม้`,
      target: `≥ ${GATES.MIN_TRADES} ไม้`,
      pass: closed >= GATES.MIN_TRADES,
      detail: closed >= GATES.MIN_TRADES ? "ผ่าน" : `ขาดอีก ${tradesRemaining} ไม้`,
    },
    {
      id: "pf",
      label: "Profit Factor (ตัวชี้วัดหลักของกลยุทธ์นี้)",
      current: pfLabel(pf),
      target: `≥ ${GATES.MIN_PROFIT_FACTOR}`,
      pass: pfPass,
      detail: pf === null ? "รอเก็บข้อมูล" : pfPass ? "ผ่าน" : "ต่ำกว่าเป้า — ไม้ชนะยังไม่ใหญ่พอเมื่อเทียบไม้แพ้",
    },
    {
      id: "recent",
      label: "ความสม่ำเสมอ (PF ครึ่งหลังของข้อมูล)",
      current: pfLabel(recentPf),
      target: `≥ ${GATES.MIN_RECENT_PF}`,
      pass: recentPass,
      detail:
        recentPf === null
          ? "ข้อมูลยังไม่พอวัด (ต้อง ≥40 ไม้)"
          : recentPass
            ? "ผ่าน — ยังมี edge ในช่วงล่าสุด ไม่ใช่แค่ช่วงแรกที่เข้าทาง"
            : "ช่วงล่าสุดอ่อนลง — edge อาจมาจากช่วงตลาดเข้าทางตอนแรก",
    },
    {
      id: "net",
      label: "กำไรสุทธิสะสม (Net P&L)",
      current: `${mem.totalPnl >= 0 ? "+" : ""}${mem.totalPnl.toFixed(2)}`,
      target: "> 0",
      pass: mem.totalPnl > 0,
      detail: mem.totalPnl > 0 ? "ผ่าน" : "ยังไม่เป็นบวก",
    },
    {
      id: "winfloor",
      label: "อัตราชนะขั้นต่ำ (พื้น ไม่ใช่เป้า)",
      current: closed > 0 ? `${winRate.toFixed(1)}%` : "—",
      target: `≥ ${GATES.MIN_WIN_RATE_FLOOR}%`,
      pass: closed > 0 && winRate >= GATES.MIN_WIN_RATE_FLOOR,
      detail:
        closed === 0
          ? "ยังไม่มีข้อมูล"
          : winRate >= GATES.MIN_WIN_RATE_FLOOR
            ? "ผ่าน (กลยุทธ์ตามเทรนด์ชนะ <50% ได้ ถ้าไม้ชนะใหญ่)"
            : "ต่ำกว่าพื้น — เสี่ยงไม้แพ้ติดกันยาว",
    },
    {
      id: "drawdown",
      label: "ขาดทุนสูงสุดต่อเนื่อง (Max Drawdown)",
      current: dd === null ? "รอเก็บข้อมูล" : `${dd.toFixed(1)}%`,
      target: `≤ ${GATES.MAX_DRAWDOWN}%`,
      pass: dd !== null && dd <= GATES.MAX_DRAWDOWN,
      detail:
        dd === null ? "รอเก็บข้อมูล" : dd <= GATES.MAX_DRAWDOWN ? "ผ่าน" : `สูงเกินเป้า ${(dd - GATES.MAX_DRAWDOWN).toFixed(1)}%`,
    },
    {
      id: "regimes",
      label: "พิสูจน์ในหลายสภาพตลาด (Regimes)",
      current: `${regimes.size} สภาพ`,
      target: `≥ ${GATES.MIN_REGIMES} สภาพ`,
      pass: regimes.size >= GATES.MIN_REGIMES,
      detail:
        regimes.size >= GATES.MIN_REGIMES
          ? "ผ่าน"
          : `ต้องมีสถิติ (≥${MIN_SAMPLES} ไม้) ในอีก ${GATES.MIN_REGIMES - regimes.size} สภาพตลาด`,
    },
  ];

  const passed = checks.filter((c) => c.pass).length;
  return {
    checks,
    passed,
    total: checks.length,
    ready: passed === checks.length,
    tradesRemaining,
    score: Math.round((passed / checks.length) * 100),
  };
}
