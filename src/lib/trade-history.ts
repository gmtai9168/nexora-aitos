import { AGENT_BY_ID } from "./agents";
import {
  EXIT_META,
  REGIME_META,
  runLab,
  SKIP_META,
  STRATEGY_META,
  type LabConfig,
  type LabResult,
  type LabStrategyKind,
  type LabTrade,
  type RegimeKind,
} from "./backtest-lab";
import { findListing } from "./universe";

/* ------------------------------------------------------------------ *
 * Desks — each is one AI bot running one strategy with its own settings
 * ------------------------------------------------------------------ */

export type Desk = {
  id: string;
  strategy: LabStrategyKind;
  /** Real agent from the 50-bot roster that owns this strategy. */
  botId: string;
  market: "spot" | "futures";
  leverage: number;
  direction: LabConfig["direction"];
  trailing: boolean;
  riskPct: number;
  maxHoldBars: number;
  account: string;
};

export const DESKS: Desk[] = [
  { id: "trend", strategy: "trend", botId: "trend-0", market: "futures", leverage: 10, direction: "both", trailing: true, riskPct: 1, maxHoldBars: 30, account: "MAIN-01" },
  { id: "breakout", strategy: "breakout", botId: "pattern-0", market: "futures", leverage: 5, direction: "both", trailing: false, riskPct: 1, maxHoldBars: 24, account: "MAIN-01" },
  { id: "meanrev", strategy: "meanReversion", botId: "pattern-1", market: "spot", leverage: 1, direction: "long", trailing: false, riskPct: 1.5, maxHoldBars: 18, account: "SPOT-02" },
  { id: "orderflow", strategy: "orderFlow", botId: "smart-1", market: "futures", leverage: 15, direction: "both", trailing: true, riskPct: 0.8, maxHoldBars: 12, account: "HEDGE-03" },
  { id: "funding", strategy: "funding", botId: "futures-0", market: "futures", leverage: 8, direction: "both", trailing: false, riskPct: 1, maxHoldBars: 36, account: "HEDGE-03" },
  { id: "scalp", strategy: "scalping", botId: "pattern-2", market: "futures", leverage: 20, direction: "both", trailing: true, riskPct: 0.5, maxHoldBars: 8, account: "SCALP-04" },
  { id: "ensemble", strategy: "ensemble", botId: "ml-4", market: "futures", leverage: 6, direction: "both", trailing: true, riskPct: 1.2, maxHoldBars: 30, account: "MAIN-01" },
];

export const DESK_BY_ID = new Map(DESKS.map((d) => [d.id, d]));

export const LEDGER_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "DOGEUSDT",
];

/** Every desk shares these, so rows stay comparable across bots. */
export const LEDGER_BASE = {
  interval: "4h",
  bars: 2000,
  capital: 100_000,
  feePct: 0.04,
  fundingPct: 0.01,
  slippagePct: 0.02,
  stopAtr: 1.6,
  targetR: 2.2,
  trailAtr: 1.2,
  maxPositions: 2,
  margin: "isolated" as const,
};

export function deskConfig(desk: Desk, symbol: string): LabConfig {
  return {
    ...LEDGER_BASE,
    symbol,
    strategy: desk.strategy,
    market: desk.market,
    leverage: desk.leverage,
    direction: desk.direction,
    trailing: desk.trailing,
    riskPct: desk.riskPct,
    maxHoldBars: desk.maxHoldBars,
  };
}

/* ------------------------------------------------------------------ *
 * Ledger rows
 * ------------------------------------------------------------------ */

export type Outcome = "win" | "loss" | "breakeven";
export type RowStatus = "closed" | "rejected";

export type LedgerRow = {
  key: string;
  symbol: string;
  display: string;
  color: string;
  deskId: string;
  strategy: LabStrategyKind;
  botId: string;
  botName: string;
  botNameTh: string;
  account: string;
  market: "spot" | "futures";
  exchange: string;
  leverage: number;
  status: RowStatus;
  outcome: Outcome | null;
  /** Present on executed rows; null when the order never made it to market. */
  trade: LabTrade | null;
  /** Present on rejected rows. */
  rejection: { reason: keyof typeof SKIP_META; entryReason: string } | null;
  side: "LONG" | "SHORT";
  openTime: number;
  closeTime: number;
  confidence: number;
  regime: RegimeKind;
  netPnl: number;
};

function outcomeOf(t: LabTrade): Outcome {
  if (Math.abs(t.pnlUsd) < t.notional * 0.0001) return "breakeven";
  return t.pnlUsd > 0 ? "win" : "loss";
}

export type DeskRun = { desk: Desk; symbol: string; result: LabResult };

/** Flattens finished simulations into one ledger, newest last. */
export function buildLedger(runs: DeskRun[]): LedgerRow[] {
  const rows: LedgerRow[] = [];

  for (const { desk, symbol, result } of runs) {
    const listing = findListing(symbol);
    const agent = AGENT_BY_ID.get(desk.botId);
    const exchange = /^[A-Z0-9]+USDT$/.test(symbol) ? "Binance" : "Yahoo Finance";
    const common = {
      symbol,
      display: listing?.display ?? symbol,
      color: listing?.color ?? "#6b8497",
      deskId: desk.id,
      strategy: desk.strategy,
      botId: desk.botId,
      botName: agent?.name ?? desk.id,
      botNameTh: agent?.nameTh ?? desk.id,
      account: desk.account,
      market: desk.market,
      exchange,
      leverage: desk.leverage,
    };

    for (const t of result.trades) {
      rows.push({
        ...common,
        key: `${desk.id}-${symbol}-t${t.id}`,
        status: "closed",
        outcome: outcomeOf(t),
        trade: t,
        rejection: null,
        side: t.side,
        openTime: t.entryTime,
        closeTime: t.exitTime,
        confidence: t.confidence,
        regime: t.regime,
        netPnl: t.pnlUsd,
      });
    }

    for (let i = 0; i < result.skipped.length; i++) {
      const s = result.skipped[i];
      rows.push({
        ...common,
        key: `${desk.id}-${symbol}-r${i}`,
        status: "rejected",
        outcome: null,
        trade: null,
        rejection: { reason: s.reason, entryReason: s.entryReason },
        side: s.side,
        openTime: s.time,
        closeTime: s.time,
        confidence: s.confidence,
        regime: s.regime,
        netPnl: 0,
      });
    }
  }

  return rows.sort((a, b) => a.openTime - b.openTime);
}

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

export type Period = "today" | "7d" | "30d" | "90d" | "1y" | "all" | "custom";

export const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "วันนี้" },
  { id: "7d", label: "7 วัน" },
  { id: "30d", label: "30 วัน" },
  { id: "90d", label: "90 วัน" },
  { id: "1y", label: "1 ปี" },
  { id: "all", label: "ทั้งหมด" },
];

const PERIOD_DAYS: Record<Exclude<Period, "all" | "custom">, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

export type Filters = {
  period: Period;
  /** Unix seconds; used only when period is "custom". */
  fromDate: string;
  toDate: string;
  symbol: string;
  exchange: string;
  market: string;
  side: string;
  deskId: string;
  botId: string;
  status: string;
  outcome: string;
  leverage: string;
  account: string;
  regime: string;
  search: string;
};

export const EMPTY_FILTERS: Filters = {
  period: "all",
  fromDate: "",
  toDate: "",
  symbol: "all",
  exchange: "all",
  market: "all",
  side: "all",
  deskId: "all",
  botId: "all",
  status: "all",
  outcome: "all",
  leverage: "all",
  account: "all",
  regime: "all",
  search: "",
};

/** Resolves the selected period against the ledger's own newest timestamp. */
export function periodWindow(f: Filters, latest: number): { from: number; to: number } {
  if (f.period === "all") return { from: 0, to: Infinity };
  if (f.period === "custom") {
    const from = f.fromDate ? Date.parse(`${f.fromDate}T00:00:00Z`) / 1000 : 0;
    const to = f.toDate ? Date.parse(`${f.toDate}T23:59:59Z`) / 1000 : Infinity;
    return { from: Number.isFinite(from) ? from : 0, to: Number.isFinite(to) ? to : Infinity };
  }
  return { from: latest - PERIOD_DAYS[f.period] * 86400, to: Infinity };
}

export function applyFilters(rows: LedgerRow[], f: Filters, latest: number): LedgerRow[] {
  const { from, to } = periodWindow(f, latest);
  const q = f.search.trim().toUpperCase();

  return rows.filter((r) => {
    if (r.openTime < from || r.openTime > to) return false;
    if (f.symbol !== "all" && r.symbol !== f.symbol) return false;
    if (f.exchange !== "all" && r.exchange !== f.exchange) return false;
    if (f.market !== "all" && r.market !== f.market) return false;
    if (f.side !== "all" && r.side !== f.side) return false;
    if (f.deskId !== "all" && r.deskId !== f.deskId) return false;
    if (f.botId !== "all" && r.botId !== f.botId) return false;
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.outcome !== "all" && r.outcome !== f.outcome) return false;
    if (f.account !== "all" && r.account !== f.account) return false;
    if (f.regime !== "all" && r.regime !== f.regime) return false;
    if (f.leverage !== "all" && String(r.leverage) !== f.leverage) return false;
    if (q && !r.symbol.includes(q) && !r.botName.toUpperCase().includes(q) && !r.display.toUpperCase().includes(q))
      return false;
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Summary
 * ------------------------------------------------------------------ */

export type Summary = {
  total: number;
  executed: number;
  rejected: number;
  netPnl: number;
  grossProfit: number;
  grossLoss: number;
  winRate: number;
  profitFactor: number;
  fees: number;
  funding: number;
  slippage: number;
  avgWin: number;
  avgLoss: number;
  best: LedgerRow | null;
  worst: LedgerRow | null;
  volume: number;
  avgHoldHours: number;
  wins: number;
  losses: number;
  breakeven: number;
};

export function summarise(rows: LedgerRow[]): Summary {
  const closed = rows.filter((r) => r.trade);
  const wins = closed.filter((r) => r.outcome === "win");
  const losses = closed.filter((r) => r.outcome === "loss");
  const grossProfit = wins.reduce((a, r) => a + r.netPnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, r) => a + r.netPnl, 0));

  const sorted = [...closed].sort((a, b) => b.netPnl - a.netPnl);

  return {
    total: rows.length,
    executed: closed.length,
    rejected: rows.length - closed.length,
    netPnl: closed.reduce((a, r) => a + r.netPnl, 0),
    grossProfit,
    grossLoss,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0,
    fees: closed.reduce((a, r) => a + (r.trade?.feeUsd ?? 0), 0),
    funding: closed.reduce((a, r) => a + (r.trade?.fundingUsd ?? 0), 0),
    slippage: closed.reduce((a, r) => a + (r.trade?.slippageUsd ?? 0), 0),
    avgWin: wins.length ? grossProfit / wins.length : 0,
    avgLoss: losses.length ? grossLoss / losses.length : 0,
    best: sorted[0] ?? null,
    worst: sorted.at(-1) ?? null,
    volume: closed.reduce((a, r) => a + (r.trade?.notional ?? 0), 0),
    avgHoldHours: closed.length
      ? closed.reduce((a, r) => a + (r.trade?.holdHours ?? 0), 0) / closed.length
      : 0,
    wins: wins.length,
    losses: losses.length,
    breakeven: closed.filter((r) => r.outcome === "breakeven").length,
  };
}

/* ------------------------------------------------------------------ *
 * Analytics
 * ------------------------------------------------------------------ */

export type Slice = { key: string; label: string; trades: number; pnl: number; winRate: number; color?: string };

function slice(label: string, list: LedgerRow[], key = label, color?: string): Slice {
  const wins = list.filter((r) => r.outcome === "win").length;
  return {
    key,
    label,
    trades: list.length,
    pnl: list.reduce((a, r) => a + r.netPnl, 0),
    winRate: list.length ? (wins / list.length) * 100 : 0,
    color,
  };
}

function groupBy<T extends string>(rows: LedgerRow[], pick: (r: LedgerRow) => T): Map<T, LedgerRow[]> {
  const map = new Map<T, LedgerRow[]>();
  for (const r of rows) {
    const k = pick(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return map;
}

/** Bangkok-local calendar parts — the desk trades on Thai time. */
function bkk(unix: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(new Date(unix * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  };
}

export type Analytics = {
  daily: { date: string; pnl: number; trades: number; cumulative: number }[];
  byHour: Slice[];
  byWeekday: Slice[];
  bySymbol: Slice[];
  byBot: Slice[];
  byStrategy: Slice[];
  bySide: Slice[];
  byRegime: Slice[];
  byExit: Slice[];
  rDistribution: { label: string; count: number; positive: boolean }[];
};

const WEEKDAY_TH = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];

export function analytics(rows: LedgerRow[]): Analytics {
  const closed = rows.filter((r) => r.trade);

  const byDate = groupBy(closed, (r) => bkk(r.closeTime).date);
  let cumulative = 0;
  const daily = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const pnl = list.reduce((a, r) => a + r.netPnl, 0);
      cumulative += pnl;
      return { date, pnl, trades: list.length, cumulative };
    });

  const hours = Array.from({ length: 24 }, () => [] as LedgerRow[]);
  const days = Array.from({ length: 7 }, () => [] as LedgerRow[]);
  for (const r of closed) {
    const p = bkk(r.openTime);
    hours[p.hour].push(r);
    if (p.weekday >= 0) days[p.weekday].push(r);
  }

  const bySymbol = [...groupBy(closed, (r) => r.symbol).entries()]
    .map(([sym, list]) => slice(findListing(sym)?.display ?? sym, list, sym, list[0]?.color))
    .sort((a, b) => b.pnl - a.pnl);

  const byBot = [...groupBy(closed, (r) => r.botId).entries()]
    .map(([id, list]) => slice(AGENT_BY_ID.get(id)?.name ?? id, list, id))
    .sort((a, b) => b.pnl - a.pnl);

  const byStrategy = [...groupBy(closed, (r) => r.strategy).entries()]
    .map(([k, list]) => slice(STRATEGY_META[k].th, list, k, STRATEGY_META[k].color))
    .sort((a, b) => b.pnl - a.pnl);

  const byRegime = [...groupBy(closed, (r) => r.regime).entries()]
    .map(([k, list]) => slice(REGIME_META[k].th, list, k, REGIME_META[k].color))
    .sort((a, b) => b.pnl - a.pnl);

  const byExit = [...groupBy(closed, (r) => r.trade!.exitReason).entries()]
    .map(([k, list]) => slice(EXIT_META[k].th, list, k))
    .sort((a, b) => b.trades - a.trades);

  // R-multiple histogram across nine buckets from −3R to +3R.
  const buckets = new Array(9).fill(0);
  for (const r of closed) {
    const idx = Math.max(0, Math.min(8, Math.round((r.trade?.r ?? 0) * 1.5) + 4));
    buckets[idx]++;
  }

  return {
    daily,
    byHour: hours.map((list, h) => slice(`${String(h).padStart(2, "0")}:00`, list, String(h))),
    byWeekday: days.map((list, d) => slice(WEEKDAY_TH[d], list, String(d))),
    bySymbol,
    byBot,
    byStrategy,
    bySide: [
      slice("Long", closed.filter((r) => r.side === "LONG"), "LONG"),
      slice("Short", closed.filter((r) => r.side === "SHORT"), "SHORT"),
    ],
    byRegime,
    byExit,
    rDistribution: buckets.map((count, i) => ({
      label: `${((i - 4) / 1.5).toFixed(1)}R`,
      count,
      positive: i > 4,
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Post-trade review — every line traces to a field on the trade
 * ------------------------------------------------------------------ */

export type PostTradeReview = {
  verdict: string;
  good: string[];
  bad: string[];
  cause: string;
  entryExit: string[];
  leverage: string;
  strategyFit: string;
};

export function postTradeReview(row: LedgerRow, peers: LedgerRow[]): PostTradeReview | null {
  const t = row.trade;
  if (!t) return null;

  const good: string[] = [];
  const bad: string[] = [];
  const entryExit: string[] = [];
  const win = t.pnlUsd > 0;
  const costs = t.feeUsd + Math.max(t.fundingUsd, 0) + t.slippageUsd;
  const rawPnl = t.grossUsd + t.slippageUsd;

  // What the committee saw at the signal bar.
  if (t.agree.length >= 3) good.push(`มี ${t.agree.length} โมเดลเห็นตรงกันตอนเข้า — สัญญาณไม่ได้มาจากโมเดลเดียว`);
  if (t.disagree.length > 0)
    bad.push(`มี ${t.disagree.length} โมเดลอ่านตรงข้าม (${t.disagree.map((v) => STRATEGY_META[v.kind].th).join(", ")}) แต่ระบบยังเข้า`);

  if (t.stopMoves.length > 0)
    good.push(`ขยับ Stop ตามกำไร ${t.stopMoves.length} ครั้ง จาก ${t.stopMoves[0].from.toFixed(2)} ไป ${t.stopMoves.at(-1)!.to.toFixed(2)}`);

  if (win && t.exitReason === "target") good.push("ปิดที่เป้าหมายตามแผน ไม่ได้ออกก่อนเวลา");
  if (t.mae < 0.5 && win) good.push(`ระหว่างถือติดลบมากสุดเพียง ${t.mae.toFixed(2)}R — เข้าได้จังหวะดี`);

  if (t.exitReason === "liquidation")
    bad.push(`ถูกบังคับปิดที่ Leverage ${t.leverage}x — ราคาสวนเพียง ${(100 / t.leverage).toFixed(1)}% ก็ถึงจุดล้างพอร์ต`);
  if (!win && t.mfe >= 1)
    bad.push(`เคยกำไรถึง ${t.mfe.toFixed(2)}R ก่อนย้อนกลับมาขาดทุน — ไม่ได้ล็อกกำไรระหว่างทาง`);
  if (t.exitReason === "timeout")
    bad.push(`ปิดเพราะครบเวลาถือ ${t.holdBars} แท่ง ไม่ใช่เพราะแผนเข้าเป้าหรือแผนตัดขาดทุน`);
  if (costs > Math.abs(rawPnl) * 0.4 && rawPnl !== 0)
    bad.push(`ต้นทุน ${costs.toFixed(2)} คิดเป็น ${((costs / Math.abs(rawPnl)) * 100).toFixed(0)}% ของกำไรขาดทุนก่อนหักต้นทุน`);
  if (t.confidence < 60)
    bad.push(`AI Confidence ตอนเข้าเพียง ${t.confidence}% — ต่ำกว่าระดับที่ควรลงเงินเต็มขนาด`);

  // Entry / exit advice, evidenced by MFE and MAE.
  if (t.mfe >= t.r + 1 && t.r > 0)
    entryExit.push(`ควรพิจารณาขยาย Take Profit — ราคาวิ่งไปถึง ${t.mfe.toFixed(2)}R แต่ปิดจริงที่ ${t.r.toFixed(2)}R`);
  if (t.mae >= 0.8 && win)
    entryExit.push(`Stop เกือบโดนแตะ (ลึกสุด ${t.mae.toFixed(2)}R) — ไม้นี้รอดแบบเฉียดฉิว ควรเข้าให้ใกล้แนวรับกว่านี้`);
  if (!win && t.mfe < 0.3)
    entryExit.push(`ราคาแทบไม่เคยไปทางที่คาดเลย (สูงสุด ${t.mfe.toFixed(2)}R) — จังหวะเข้าผิดตั้งแต่ต้น ไม่ใช่ที่จุดออก`);
  if (t.exitReason === "timeout" && t.mfe >= 1)
    entryExit.push(`เคยถึง ${t.mfe.toFixed(2)}R แล้วปล่อยจนหมดเวลา — ควรมีกฎปิดเมื่อกำไรถึงระดับหนึ่ง`);

  // Was this regime a good place for this desk to be trading?
  const sameRegime = peers.filter((p) => p.trade && p.regime === row.regime && p.deskId === row.deskId);
  const regimePnl = sameRegime.reduce((a, p) => a + p.netPnl, 0);
  const regimeWin = sameRegime.filter((p) => p.outcome === "win").length;
  const strategyFit =
    sameRegime.length < 3
      ? `ยังมีเพียง ${sameRegime.length} ไม้ของบอทนี้ในสภาวะ "${REGIME_META[row.regime].th}" — ตัวอย่างน้อยเกินกว่าจะสรุป`
      : regimePnl > 0
        ? `บอทนี้ทำเงินได้ในสภาวะ "${REGIME_META[row.regime].th}" (${sameRegime.length} ไม้ · ชนะ ${((regimeWin / sameRegime.length) * 100).toFixed(0)}% · รวม ${regimePnl.toFixed(0)}) — กลยุทธ์ยังเหมาะกับตลาดแบบนี้`
        : `บอทนี้ขาดทุนสะสมในสภาวะ "${REGIME_META[row.regime].th}" (${sameRegime.length} ไม้ · ชนะ ${((regimeWin / sameRegime.length) * 100).toFixed(0)}% · รวม ${regimePnl.toFixed(0)}) — ควรปิดการเทรดในสภาวะนี้`;

  // Leverage advice, from what the loss actually did to the account.
  const marginUsed = t.notional / t.leverage;
  const lossOfMargin = marginUsed ? (Math.abs(Math.min(t.pnlUsd, 0)) / marginUsed) * 100 : 0;
  const leverage =
    t.exitReason === "liquidation"
      ? `ต้องลด Leverage ทันที — ${t.leverage}x ทำให้ไม้เดียวกินมาร์จินหมดก้อน แนะนำไม่เกิน ${Math.max(2, Math.floor(t.leverage / 3))}x ในสภาวะนี้`
      : lossOfMargin > 50
        ? `ไม้นี้กินมาร์จินไป ${lossOfMargin.toFixed(0)}% ที่ ${t.leverage}x — ควรลดเหลือ ${Math.max(2, Math.floor(t.leverage / 2))}x`
        : t.leverage >= 15
          ? `${t.leverage}x ยังรอดในไม้นี้ แต่ระยะห่างถึงจุดล้างพอร์ตมีเพียง ${(100 / t.leverage).toFixed(1)}% — ความผันผวนกระชากเดียวก็พอ`
          : `Leverage ${t.leverage}x เหมาะสมกับไม้นี้ ขาดทุนสูงสุดระหว่างถือคิดเป็น ${t.mae.toFixed(2)}R`;

  const cause = win
    ? `กำไรมาจาก${t.exitReason === "target" ? "การถึงเป้าหมายที่วางไว้" : t.exitReason === "trail" ? "Trailing Stop ที่ล็อกกำไรไว้ได้" : "การปิดตามเงื่อนไขเวลา"} ในสภาวะ${REGIME_META[t.regime].th} หลังหักต้นทุน ${costs.toFixed(2)} แล้วเหลือ ${t.pnlUsd.toFixed(2)}`
    : `ขาดทุนเกิดจาก${EXIT_META[t.exitReason].th}ในสภาวะ${REGIME_META[t.regime].th} ราคาสวนทางไปลึกสุด ${t.mae.toFixed(2)}R และต้นทุนอีก ${costs.toFixed(2)}`;

  return {
    verdict: win
      ? `ไม้นี้ทำกำไร ${t.pnlUsd.toFixed(2)} (${t.r.toFixed(2)}R) ถือ ${t.holdHours.toFixed(1)} ชั่วโมง`
      : `ไม้นี้ขาดทุน ${Math.abs(t.pnlUsd).toFixed(2)} (${t.r.toFixed(2)}R) ถือ ${t.holdHours.toFixed(1)} ชั่วโมง`,
    good,
    bad,
    cause,
    entryExit,
    leverage,
    strategyFit,
  };
}

/* ------------------------------------------------------------------ *
 * Replay timeline
 * ------------------------------------------------------------------ */

export type TimelineStep = { time: number; actor: string; text: string; tone: "info" | "up" | "down" | "warn" };

/** Reconstructs the decision sequence from what the engine recorded. */
export function timeline(row: LedgerRow): TimelineStep[] {
  const steps: TimelineStep[] = [];

  if (row.status === "rejected" && row.rejection) {
    steps.push({ time: row.openTime, actor: row.botName, text: `ให้สัญญาณ ${row.side} — ${row.rejection.entryReason}`, tone: "info" });
    steps.push({
      time: row.openTime,
      actor: "Risk Gatekeeper AI",
      text: `ปฏิเสธคำสั่ง: ${SKIP_META[row.rejection.reason].th}`,
      tone: "down",
    });
    return steps;
  }

  const t = row.trade;
  if (!t) return steps;

  steps.push({ time: t.signalTime, actor: row.botName, text: `ให้สัญญาณ ${t.side} — ${t.entryReason}`, tone: "info" });

  for (const v of t.agree) {
    steps.push({
      time: t.signalTime,
      actor: `${STRATEGY_META[v.kind].th} AI`,
      text: `ยืนยันทิศทางเดียวกัน (ความแรง ${(v.strength * 100).toFixed(0)}%)`,
      tone: "up",
    });
  }
  for (const v of t.disagree) {
    steps.push({
      time: t.signalTime,
      actor: `${STRATEGY_META[v.kind].th} AI`,
      text: `อ่านตรงข้ามเป็น ${v.dir} — เสียงข้างน้อย`,
      tone: "warn",
    });
  }

  steps.push({
    time: t.signalTime,
    actor: "Risk Gatekeeper AI",
    text: `อนุมัติ — ความเสี่ยงต่อไม้ ${((t.notional / t.leverage / t.equityAfter) * 100).toFixed(2)}% ของทุน · Leverage ${t.leverage}x`,
    tone: "up",
  });
  steps.push({
    time: t.entryTime,
    actor: "Smart Execution AI",
    text: `เปิดสถานะที่ราคาเปิดแท่งถัดไป ${t.entry.toFixed(4)} · ขนาด ${t.qty.toFixed(4)} · มูลค่า ${t.notional.toFixed(2)}`,
    tone: "info",
  });
  steps.push({
    time: t.entryTime,
    actor: "Slippage AI",
    text: `Slippage ขาเข้า+ขาออกรวม ${t.slippageUsd.toFixed(4)} · ค่าธรรมเนียม ${t.feeUsd.toFixed(4)}`,
    tone: "warn",
  });
  steps.push({
    time: t.entryTime,
    actor: "Position Sizing AI",
    text: `ตั้ง Stop ${t.stop.toFixed(4)} · Take Profit ${t.target.toFixed(4)}`,
    tone: "info",
  });

  for (const m of t.stopMoves) {
    steps.push({
      time: m.time,
      actor: "Dynamic Leverage AI",
      text: `ย้าย Stop จาก ${m.from.toFixed(4)} ไป ${m.to.toFixed(4)}`,
      tone: "up",
    });
  }

  steps.push({
    time: t.exitTime,
    actor: "Smart Execution AI",
    text: `ปิดสถานะที่ ${t.exit.toFixed(4)} — ${EXIT_META[t.exitReason].th} · สุทธิ ${t.pnlUsd >= 0 ? "+" : ""}${t.pnlUsd.toFixed(2)}`,
    tone: t.pnlUsd >= 0 ? "up" : "down",
  });

  return steps.sort((a, b) => a.time - b.time);
}

/* ------------------------------------------------------------------ *
 * Audit trail
 * ------------------------------------------------------------------ */

export type AuditEntry = { time: number; actor: string; action: string; detail: string };

/**
 * Who issued the order and what changed afterwards. Nothing here is a human
 * action, because no human can place an order on this platform.
 */
export function auditLog(row: LedgerRow): AuditEntry[] {
  const out: AuditEntry[] = [];
  const t = row.trade;

  out.push({
    time: row.openTime,
    actor: `${row.botName} (${row.botId})`,
    action: "SIGNAL",
    detail: t?.entryReason ?? row.rejection?.entryReason ?? "—",
  });

  if (row.status === "rejected" && row.rejection) {
    out.push({
      time: row.openTime,
      actor: "Risk Gatekeeper AI (master-1)",
      action: "REJECT",
      detail: SKIP_META[row.rejection.reason].en,
    });
    return out;
  }

  if (!t) return out;

  out.push({ time: t.signalTime, actor: "Risk Gatekeeper AI (master-1)", action: "APPROVE", detail: `leverage=${t.leverage} notional=${t.notional.toFixed(2)}` });
  out.push({ time: t.entryTime, actor: "Smart Execution AI (exec-0)", action: "SUBMIT", detail: `${t.side} ${t.qty.toFixed(6)} @ ${t.entry.toFixed(6)} · simulated fill` });
  for (const m of t.stopMoves) {
    out.push({ time: m.time, actor: "Dynamic Leverage AI (risk-2)", action: "MODIFY_SL", detail: `${m.from.toFixed(6)} → ${m.to.toFixed(6)}` });
  }
  out.push({ time: t.exitTime, actor: "Smart Execution AI (exec-0)", action: "CLOSE", detail: `${EXIT_META[t.exitReason].en ?? t.exitReason} @ ${t.exit.toFixed(6)} · net ${t.pnlUsd.toFixed(2)}` });

  return out;
}

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

const ISO = (s: number) => new Date(s * 1000).toISOString();

export function ledgerToCsv(rows: LedgerRow[]): string {
  const head = [
    "key", "status", "open_time", "close_time", "symbol", "exchange", "market",
    "account", "bot", "strategy", "side", "leverage", "entry", "exit", "stop",
    "target", "qty", "notional", "gross_pnl", "fee", "funding", "slippage",
    "net_pnl", "r_multiple", "mfe_r", "mae_r", "hold_hours", "ai_confidence",
    "regime", "exit_reason", "outcome", "entry_reason",
  ].join(",");

  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = rows.map((r) => {
    const t = r.trade;
    return [
      r.key, r.status, ISO(r.openTime), t ? ISO(r.closeTime) : "",
      r.symbol, r.exchange, r.market, r.account, esc(r.botName), r.strategy,
      r.side, r.leverage,
      t ? t.entry.toFixed(6) : "", t ? t.exit.toFixed(6) : "",
      t ? t.stop.toFixed(6) : "", t ? t.target.toFixed(6) : "",
      t ? t.qty.toFixed(8) : "", t ? t.notional.toFixed(2) : "",
      t ? t.grossUsd.toFixed(2) : "", t ? t.feeUsd.toFixed(4) : "",
      t ? t.fundingUsd.toFixed(4) : "", t ? t.slippageUsd.toFixed(4) : "",
      t ? t.pnlUsd.toFixed(2) : "0", t ? t.r.toFixed(3) : "",
      t ? t.mfe.toFixed(3) : "", t ? t.mae.toFixed(3) : "",
      t ? t.holdHours.toFixed(2) : "", r.confidence,
      REGIME_META[r.regime].en, t ? EXIT_META[t.exitReason].en : (r.rejection ? SKIP_META[r.rejection.reason].en : ""),
      r.outcome ?? "rejected",
      esc(t?.entryReason ?? r.rejection?.entryReason ?? ""),
    ].join(",");
  });

  return [head, ...body].join("\n");
}

/** Tab-separated with a .xls extension — opens natively in Excel. */
export function ledgerToExcel(rows: LedgerRow[]): string {
  return ledgerToCsv(rows).replace(/,/g, "\t");
}

export type ReportKind = "tax" | "auditor" | "investor";

export const REPORT_META: Record<ReportKind, { th: string; en: string }> = {
  tax: { th: "รายงานภาษี", en: "Tax report" },
  auditor: { th: "รายงานผู้ตรวจสอบ", en: "Auditor report" },
  investor: { th: "รายงานนักลงทุน", en: "Investor report" },
};

/** Plain-text reports built from the filtered rows, ready to save or print. */
export function buildReport(kind: ReportKind, rows: LedgerRow[], s: Summary, range: string): string {
  const head = [
    "NEXORA AITOS — " + REPORT_META[kind].en,
    "=".repeat(60),
    `ช่วงเวลา: ${range}`,
    `จำนวนรายการ: ${s.total} (ส่งคำสั่งสำเร็จ ${s.executed} · ถูกปฏิเสธ ${s.rejected})`,
    "",
    "*** ข้อมูลนี้มาจากการจำลอง (PAPER) บนราคาตลาดจริงย้อนหลัง ***",
    "*** ไม่ใช่คำสั่งซื้อขายที่ส่งไปยังกระดานเทรดจริง จึงใช้ยื่นภาษี",
    "    หรือยื่นต่อผู้ตรวจสอบบัญชีไม่ได้ ***",
    "",
  ];

  if (kind === "tax") {
    return [
      ...head,
      "สรุปเพื่อการคำนวณภาษี",
      "-".repeat(60),
      `กำไรรวมจากไม้ที่ชนะ      ${s.grossProfit.toFixed(2)}`,
      `ขาดทุนรวมจากไม้ที่แพ้     ${s.grossLoss.toFixed(2)}`,
      `ค่าธรรมเนียมรวม          ${s.fees.toFixed(2)}`,
      `Funding รวม             ${s.funding.toFixed(2)}`,
      `Slippage รวม            ${s.slippage.toFixed(2)}`,
      `กำไรสุทธิ                ${s.netPnl.toFixed(2)}`,
      "",
      "รายการทั้งหมดแนบในไฟล์ CSV",
    ].join("\n");
  }

  if (kind === "auditor") {
    const modified = rows.filter((r) => (r.trade?.stopMoves.length ?? 0) > 0).length;
    return [
      ...head,
      "สำหรับผู้ตรวจสอบ",
      "-".repeat(60),
      `ผู้ส่งคำสั่ง: บอท AI เท่านั้น — ไม่มีคำสั่งที่ส่งโดยมนุษย์`,
      `รายการที่ถูกแก้ไขหลังส่ง (ย้าย Stop): ${modified}`,
      `รายการที่ถูก Risk Engine ปฏิเสธ: ${s.rejected}`,
      `บัญชีที่เกี่ยวข้อง: ${[...new Set(rows.map((r) => r.account))].join(", ") || "—"}`,
      `บอทที่เกี่ยวข้อง: ${[...new Set(rows.map((r) => r.botName))].join(", ") || "—"}`,
      "",
      "ทุกแถวมี Audit Log ระบุผู้ส่งคำสั่งและการแก้ไข ดูได้ในแผงรายละเอียดของแต่ละรายการ",
    ].join("\n");
  }

  return [
    ...head,
    "สรุปสำหรับนักลงทุน",
    "-".repeat(60),
    `กำไรสุทธิ            ${s.netPnl >= 0 ? "+" : ""}${s.netPnl.toFixed(2)}`,
    `อัตราชนะ             ${s.winRate.toFixed(2)}%`,
    `Profit Factor       ${s.profitFactor.toFixed(2)}`,
    `กำไรเฉลี่ยต่อไม้ชนะ    ${s.avgWin.toFixed(2)}`,
    `ขาดทุนเฉลี่ยต่อไม้แพ้   ${s.avgLoss.toFixed(2)}`,
    `ปริมาณการเทรดรวม     ${s.volume.toFixed(2)}`,
    `เวลาถือครองเฉลี่ย      ${s.avgHoldHours.toFixed(1)} ชั่วโมง`,
    `ไม้ที่ดีที่สุด          ${s.best ? `${s.best.display} ${s.best.netPnl.toFixed(2)}` : "—"}`,
    `ไม้ที่แย่ที่สุด          ${s.worst ? `${s.worst.display} ${s.worst.netPnl.toFixed(2)}` : "—"}`,
  ].join("\n");
}

export { runLab };
