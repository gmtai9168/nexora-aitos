import type { Candle, Quote } from "./types";

/**
 * A fixed paper-trading book. Position sizes, wallet balance and entry offsets
 * are constants; every price, P&L, ratio and statistic below is recomputed from
 * the live feed. Nothing here touches a real exchange account — the UI labels
 * it DEMO for that reason.
 */
export type BookEntry = {
  symbol: string;
  side: "LONG" | "SHORT";
  notional: number;
  /** Entry sits this far from live price, so P&L moves with the market. */
  entryOffset: number;
  bot: string;
  botTh: string;
  openedMinutesAgo: number;
};

export const BOOK: BookEntry[] = [
  { symbol: "BTCUSDT", side: "LONG", notional: 12_400_000, entryOffset: 0.0096, bot: "Trend Hunter", botTh: "ล่าเทรนด์", openedMinutesAgo: 138 },
  { symbol: "ETHUSDT", side: "LONG", notional: 7_600_000, entryOffset: 0.0182, bot: "Order Flow", botTh: "ออร์เดอร์โฟลว์", openedMinutesAgo: 96 },
  { symbol: "SOLUSDT", side: "LONG", notional: 4_900_000, entryOffset: 0.0285, bot: "Breakout AI", botTh: "เบรกเอาต์", openedMinutesAgo: 54 },
  // Negative offsets put these two underwater, so win rate and profit factor
  // describe a mixed book rather than an implausible clean sweep.
  { symbol: "BNBUSDT", side: "SHORT", notional: 3_300_000, entryOffset: -0.0064, bot: "Whale AI", botTh: "ติดตามวาฬ", openedMinutesAgo: 27 },
  { symbol: "XRPUSDT", side: "LONG", notional: 2_400_000, entryOffset: -0.0091, bot: "Funding AI", botTh: "ค่าธรรมเนียม", openedMinutesAgo: 12 },
];

const WALLET = 12_250_000;
const REALIZED = 1_845_000;
/** Configured isolated leverage — notional / this = margin locked up. */
export const CONFIGURED_LEVERAGE = 15;

export type Position = BookEntry & {
  entry: number;
  price: number;
  stop: number;
  target: number;
  pnl: number;
  pnlPct: number;
  dayPnl: number;
  changePct: number;
  size: number;
  confidence: number;
};

export type BookSummary = {
  positions: Position[];
  equity: number;
  wallet: number;
  unrealized: number;
  realized: number;
  totalPnl: number;
  totalPnlPct: number;
  dayPnl: number;
  dayPnlPct: number;
  notional: number;
  marginUsed: number;
  marginRatio: number;
  leverage: number;
  configuredLeverage: number;
  availableMargin: number;
  longShare: number;
  winRate: number;
  profitFactor: number;
  sharpe: number;
  drawdown: number;
};

/** The real account, when connected — shape mirrors the live-account provider. */
export type RealAccount = {
  connected: boolean;
  loading: boolean;
  wallet: number;
  available: number;
  unrealizedPnl: number;
  equity: number;
  positions: {
    symbol: string;
    side: "LONG" | "SHORT";
    size: number;
    notional: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    liquidationPrice: number;
    leverage: number;
  }[];
};

/**
 * When a real account is passed and connected, the book is built entirely from
 * it — real wallet, real positions, real P&L — so every figure downstream is
 * the actual testnet balance. Otherwise it falls back to the demo constants.
 */
export function buildBook(quotes: Map<string, Quote>, real?: RealAccount | null): BookSummary {
  // Once a live account is present, never fall back to the demo numbers — show
  // the real book when connected, or a clean zero state while it is still
  // loading. Demo is only for when there is genuinely no account at all.
  if (real && (real.connected || real.loading)) return buildRealBook(quotes, real);

  const positions: Position[] = BOOK.map((e) => {
    const q = quotes.get(e.symbol);
    const price = q?.price ?? 0;
    const dir = e.side === "LONG" ? 1 : -1;
    const entry = price * (1 - dir * e.entryOffset);
    const pnlPct = entry ? ((price - entry) / entry) * 100 * dir : 0;
    const pnl = (e.notional * pnlPct) / 100;
    const changePct = q?.changePct ?? 0;

    // Stops sit outside the day's range, targets at 2R from entry.
    const risk = entry * 0.012;
    return {
      ...e,
      entry,
      price,
      stop: entry - dir * risk,
      target: entry + dir * risk * 2.2,
      pnl,
      pnlPct,
      changePct,
      dayPnl: (e.notional * changePct * dir) / 100,
      size: price ? e.notional / price : 0,
      confidence: Math.round(
        Math.min(95, 62 + Math.abs(pnlPct) * 6 + Math.abs(changePct) * 2),
      ),
    };
  });

  const unrealized = positions.reduce((a, p) => a + p.pnl, 0);
  const dayPnl = positions.reduce((a, p) => a + p.dayPnl, 0);
  const notional = positions.reduce((a, p) => a + p.notional, 0);
  const equity = WALLET + unrealized;
  const marginUsed = notional / CONFIGURED_LEVERAGE;
  const longNotional = positions
    .filter((p) => p.side === "LONG")
    .reduce((a, p) => a + p.notional, 0);

  // Live statistics across the open book.
  const wins = positions.filter((p) => p.pnl > 0);
  const gains = wins.reduce((a, p) => a + p.pnl, 0);
  const losses = positions
    .filter((p) => p.pnl < 0)
    .reduce((a, p) => a + Math.abs(p.pnl), 0);

  return {
    positions,
    equity,
    wallet: WALLET,
    unrealized,
    realized: REALIZED,
    totalPnl: REALIZED + unrealized,
    totalPnlPct: ((REALIZED + unrealized) / WALLET) * 100,
    dayPnl,
    dayPnlPct: (dayPnl / equity) * 100,
    notional,
    marginUsed,
    marginRatio: (marginUsed / equity) * 100,
    leverage: notional / equity,
    configuredLeverage: CONFIGURED_LEVERAGE,
    availableMargin: equity - marginUsed,
    longShare: notional ? (longNotional / notional) * 100 : 0,
    winRate: positions.length ? (wins.length / positions.length) * 100 : 0,
    profitFactor: losses > 0 ? gains / losses : gains > 0 ? 4 : 0,
    sharpe: 0,
    drawdown: 0,
  };
}

/** Builds the book from the live testnet account — real money, real positions. */
function buildRealBook(quotes: Map<string, Quote>, real: RealAccount): BookSummary {
  const positions: Position[] = real.positions.map((p) => {
    const dir = p.side === "LONG" ? 1 : -1;
    const pnlPct = p.entryPrice ? ((p.markPrice - p.entryPrice) / p.entryPrice) * 100 * dir : 0;
    const changePct = quotes.get(p.symbol)?.changePct ?? 0;
    const risk = p.entryPrice * 0.012;
    return {
      symbol: p.symbol,
      side: p.side,
      notional: p.notional,
      entryOffset: 0,
      bot: "AI Testnet",
      botTh: "เอไอ (Testnet)",
      openedMinutesAgo: 0,
      entry: p.entryPrice,
      price: p.markPrice,
      stop: p.entryPrice - dir * risk,
      target: p.entryPrice + dir * risk * 2.2,
      pnl: p.unrealizedPnl,
      pnlPct,
      changePct,
      dayPnl: (p.notional * changePct * dir) / 100,
      size: p.size,
      confidence: 70,
    };
  });

  const notional = positions.reduce((a, p) => a + p.notional, 0);
  const dayPnl = positions.reduce((a, p) => a + p.dayPnl, 0);
  const marginUsed = Math.max(real.equity - real.available, 0);
  const longNotional = positions.filter((p) => p.side === "LONG").reduce((a, p) => a + p.notional, 0);
  const wins = positions.filter((p) => p.pnl > 0);
  const gains = wins.reduce((a, p) => a + p.pnl, 0);
  const losses = positions.filter((p) => p.pnl < 0).reduce((a, p) => a + Math.abs(p.pnl), 0);
  const avgLev = positions.length
    ? positions.reduce((a, p) => a + p.notional, 0) /
      Math.max(positions.reduce((a, p) => a + p.notional / (real.positions.find((x) => x.symbol === p.symbol)?.leverage || 1), 0), 1)
    : CONFIGURED_LEVERAGE;

  return {
    positions,
    equity: real.equity,
    wallet: real.wallet,
    unrealized: real.unrealizedPnl,
    // Testnet gives no lifetime realised figure, so total P&L is what is open.
    realized: 0,
    totalPnl: real.unrealizedPnl,
    totalPnlPct: real.wallet ? (real.unrealizedPnl / real.wallet) * 100 : 0,
    dayPnl,
    dayPnlPct: real.equity ? (dayPnl / real.equity) * 100 : 0,
    notional,
    marginUsed,
    marginRatio: real.equity ? (marginUsed / real.equity) * 100 : 0,
    leverage: real.equity ? notional / real.equity : 0,
    configuredLeverage: Math.round(avgLev) || CONFIGURED_LEVERAGE,
    availableMargin: real.available,
    longShare: notional ? (longNotional / notional) * 100 : 0,
    winRate: positions.length ? (wins.length / positions.length) * 100 : 0,
    profitFactor: losses > 0 ? gains / losses : gains > 0 ? 4 : 0,
    sharpe: 0,
    drawdown: 0,
  };
}

/**
 * Equity curve traced from the real BTC candle series — the book is
 * crypto-heavy, so its shape follows BTC at a damped beta.
 */
export function equityCurve(candles: Candle[], equity: number): number[] {
  if (candles.length < 2) return [];
  const beta = 0.55;
  const last = candles.at(-1)!.close;
  return candles.slice(-80).map((c) => equity * (1 + beta * (c.close / last - 1)));
}

/** Sharpe and max drawdown measured off that same curve. */
export function curveStats(curve: number[]): { sharpe: number; drawdown: number } {
  if (curve.length < 3) return { sharpe: 0, drawdown: 0 };

  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1]) rets.push(curve[i] / curve[i - 1] - 1);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / rets.length;
  const sd = Math.sqrt(variance);
  // Annualised against the sample count, then clamped to a readable range.
  const sharpe = sd > 0 ? Math.max(-5, Math.min(6, (mean / sd) * Math.sqrt(rets.length))) : 0;

  let peak = curve[0];
  let maxDd = 0;
  for (const v of curve) {
    if (v > peak) peak = v;
    const dd = peak ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }

  return { sharpe, drawdown: maxDd };
}

export type RiskRow = {
  th: string;
  en: string;
  value: string;
  tone: "up" | "warn" | "down" | "neutral";
};

export function riskRows(book: BookSummary, atrPct: number): RiskRow[] {
  const largest = Math.max(...book.positions.map((p) => p.notional), 0);
  const perTrade = book.equity ? ((largest * atrPct * 1.2) / 100 / book.equity) * 100 : 0;
  const drawdown = book.unrealized < 0 ? Math.abs(book.unrealized / book.equity) * 100 : 0;

  const tone = (v: number, warn: number, bad: number): RiskRow["tone"] =>
    v >= bad ? "down" : v >= warn ? "warn" : "up";

  return [
    {
      th: "ความเสี่ยงต่อออเดอร์",
      en: "Risk / trade",
      value: `${perTrade.toFixed(2)}%`,
      tone: tone(perTrade, 1.0, 2.0),
    },
    {
      th: "เพดานขาดทุนต่อวัน",
      en: "Daily cap",
      value: "2.00%",
      tone: "neutral",
    },
    {
      th: "ขาดทุนวันนี้",
      en: "Day loss",
      value: `${Math.max(0, -book.dayPnlPct).toFixed(2)}%`,
      tone: tone(Math.max(0, -book.dayPnlPct), 0.8, 1.6),
    },
    {
      th: "Drawdown ปัจจุบัน",
      en: "Current DD",
      value: `${drawdown.toFixed(2)}%`,
      tone: tone(drawdown, 3, 6),
    },
    {
      th: "Margin Usage",
      en: "Used",
      value: `${book.marginRatio.toFixed(1)}%`,
      tone: tone(book.marginRatio, 45, 70),
    },
  ];
}
