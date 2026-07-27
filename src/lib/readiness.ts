import { memoryView, MIN_SAMPLES, type AiMemory } from "./ai-memory";

/**
 * Go-Live readiness — turns the AI's real (testnet) track record into a plain
 * pass/fail checklist so it's obvious whether the strategy has earned the right
 * to risk real money, and exactly what is still missing. Deliberately strict:
 * these gates exist to prevent deploying an unproven, leveraged bot.
 */

export const GATES = {
  MIN_TRADES: 300, // enough samples for the win-rate to mean something
  MIN_WIN_RATE: 52, // %
  MIN_PROFIT_FACTOR: 1.5, // gross win / gross loss
  MAX_DRAWDOWN: 20, // % peak-to-trough on the equity curve
  MIN_REGIMES: 3, // proven across different market conditions
  MIN_SYMBOLS: 3, // not a one-coin fluke
} as const;

export type Check = {
  id: string;
  label: string;
  /** Current value as a display string ("48%", "24 ไม้", "รอเก็บข้อมูล"). */
  current: string;
  target: string;
  pass: boolean;
  /** How far from passing, in Thai. */
  detail: string;
};

export type Readiness = {
  checks: Check[];
  passed: number;
  total: number;
  ready: boolean;
  tradesRemaining: number;
  /** 0..100 progress toward go-live. */
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

export function computeReadiness(mem: AiMemory, startEquity = 5000): Readiness {
  const view = memoryView(mem);
  const closed = mem.totalClosed;
  const winRate = closed > 0 ? (mem.totalWins / closed) * 100 : 0;

  const grossWin = mem.grossWin ?? 0;
  const grossLoss = mem.grossLoss ?? 0;
  const series = mem.pnlSeries ?? [];
  const pfHasData = grossWin > 0 || grossLoss > 0;
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;

  const dd = maxDrawdownPct(series, startEquity);

  const provenBuckets = view.buckets.filter((b) => b.trades >= MIN_SAMPLES);
  const regimes = new Set(provenBuckets.map((b) => b.regime));
  const symbols = new Set(view.buckets.filter((b) => b.trades >= 1).map((b) => b.symbol));

  const tradesRemaining = Math.max(0, GATES.MIN_TRADES - closed);

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
      id: "winrate",
      label: "อัตราชนะ (Win rate)",
      current: closed > 0 ? `${winRate.toFixed(1)}%` : "—",
      target: `≥ ${GATES.MIN_WIN_RATE}%`,
      pass: closed > 0 && winRate >= GATES.MIN_WIN_RATE,
      detail:
        closed === 0
          ? "ยังไม่มีข้อมูล"
          : winRate >= GATES.MIN_WIN_RATE
            ? "ผ่าน"
            : `ต่ำกว่าเป้า ${(GATES.MIN_WIN_RATE - winRate).toFixed(1)}%`,
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
      id: "pf",
      label: "Profit Factor (กำไรรวม ÷ ขาดทุนรวม)",
      current: !pfHasData ? "รอเก็บข้อมูล" : profitFactor === Infinity ? "∞" : profitFactor.toFixed(2),
      target: `≥ ${GATES.MIN_PROFIT_FACTOR}`,
      pass: pfHasData && profitFactor >= GATES.MIN_PROFIT_FACTOR,
      detail: !pfHasData
        ? "เริ่มเก็บรอบนี้ — รอไม้ใหม่ปิดเพิ่ม"
        : profitFactor >= GATES.MIN_PROFIT_FACTOR
          ? "ผ่าน"
          : "ต่ำกว่าเป้า",
    },
    {
      id: "drawdown",
      label: "ขาดทุนสูงสุดต่อเนื่อง (Max Drawdown)",
      current: dd === null ? "รอเก็บข้อมูล" : `${dd.toFixed(1)}%`,
      target: `≤ ${GATES.MAX_DRAWDOWN}%`,
      pass: dd !== null && dd <= GATES.MAX_DRAWDOWN,
      detail:
        dd === null
          ? "เริ่มเก็บรอบนี้ — รอไม้ใหม่ปิดเพิ่ม"
          : dd <= GATES.MAX_DRAWDOWN
            ? "ผ่าน"
            : `สูงเกินเป้า ${(dd - GATES.MAX_DRAWDOWN).toFixed(1)}%`,
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
    {
      id: "symbols",
      label: "กระจายหลายเหรียญ (Symbols)",
      current: `${symbols.size} เหรียญ`,
      target: `≥ ${GATES.MIN_SYMBOLS} เหรียญ`,
      pass: symbols.size >= GATES.MIN_SYMBOLS,
      detail: symbols.size >= GATES.MIN_SYMBOLS ? "ผ่าน" : `ขาดอีก ${GATES.MIN_SYMBOLS - symbols.size} เหรียญ`,
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
