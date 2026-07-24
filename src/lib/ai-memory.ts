/**
 * The AI's memory of its own results.
 *
 * Every closed testnet trade is recorded against the bucket it belongs to —
 * strategy × symbol × market regime. Future cycles read those buckets: a
 * combination that has lost repeatedly is avoided, and when position slots are
 * scarce the slots go to the combinations with the best track record. This is
 * the self-improvement — decisions are shaped by what actually paid off before.
 *
 * The memory is held by the client (localStorage) and passed through the cycle
 * each run, so it survives reloads and accumulates over a session.
 */

export type Bucket = {
  trades: number;
  wins: number;
  pnlSum: number;
  lastAt: number;
};

export type OpenContext = {
  strategy: string;
  regime: string;
  confidence: number;
  entryPrice: number;
  openedAt: number;
  /** Last unrealised P&L seen while open — the fallback outcome on an external close. */
  lastPnl: number;
};

export type AiMemory = {
  /** key = `${strategy}|${symbol}|${regime}` */
  stats: Record<string, Bucket>;
  /** key = symbol — context of positions the AI currently holds. */
  open: Record<string, OpenContext>;
  totalClosed: number;
  totalWins: number;
  totalPnl: number;
  updatedAt: number;
};

export const EMPTY_MEMORY: AiMemory = {
  stats: {},
  open: {},
  totalClosed: 0,
  totalWins: 0,
  totalPnl: 0,
  updatedAt: 0,
};

/** Enough closed trades in a bucket before its record is trusted to gate. */
export const MIN_SAMPLES = 4;

export function bucketKey(strategy: string, symbol: string, regime: string): string {
  return `${strategy}|${symbol}|${regime}`;
}

/** A −100…+100 read on a bucket; 0 when there is not enough data yet. */
export function learningScore(b: Bucket | undefined): number {
  if (!b || b.trades < MIN_SAMPLES) return 0;
  const winRate = (b.wins / b.trades) * 100;
  const avg = b.pnlSum / b.trades;
  // Win-rate leads; average P&L nudges it and breaks ties between similar rates.
  const score = (winRate - 50) * 2 + Math.max(-30, Math.min(30, avg * 4));
  return Math.max(-100, Math.min(100, score));
}

/** Has this bucket lost often enough that the AI should sit it out? */
export function shouldAvoid(b: Bucket | undefined): boolean {
  if (!b || b.trades < MIN_SAMPLES) return false;
  const winRate = (b.wins / b.trades) * 100;
  return winRate < 40 && b.pnlSum < 0;
}

/** Returns a new memory with one closed trade folded into its bucket. */
export function recordOutcome(mem: AiMemory, key: string, pnl: number, at: number): AiMemory {
  const prev = mem.stats[key] ?? { trades: 0, wins: 0, pnlSum: 0, lastAt: 0 };
  const win = pnl > 0 ? 1 : 0;
  return {
    ...mem,
    stats: {
      ...mem.stats,
      [key]: {
        trades: prev.trades + 1,
        wins: prev.wins + win,
        pnlSum: prev.pnlSum + pnl,
        lastAt: at,
      },
    },
    totalClosed: mem.totalClosed + 1,
    totalWins: mem.totalWins + win,
    totalPnl: mem.totalPnl + pnl,
    updatedAt: at,
  };
}

export type BucketView = {
  key: string;
  strategy: string;
  symbol: string;
  regime: string;
  trades: number;
  winRate: number;
  pnlSum: number;
  score: number;
};

/** Buckets sorted best-to-worst for display, plus a headline verdict. */
export function memoryView(mem: AiMemory): {
  buckets: BucketView[];
  best: BucketView | null;
  worst: BucketView | null;
  overallWinRate: number;
} {
  const buckets: BucketView[] = Object.entries(mem.stats).map(([key, b]) => {
    const [strategy, symbol, regime] = key.split("|");
    return {
      key,
      strategy,
      symbol,
      regime,
      trades: b.trades,
      winRate: b.trades ? (b.wins / b.trades) * 100 : 0,
      pnlSum: b.pnlSum,
      score: learningScore(b),
    };
  });

  const ranked = [...buckets].filter((b) => b.trades >= MIN_SAMPLES).sort((a, b) => b.score - a.score);

  return {
    buckets: buckets.sort((a, b) => b.trades - a.trades),
    best: ranked[0] ?? null,
    worst: ranked.at(-1) ?? null,
    overallWinRate: mem.totalClosed ? (mem.totalWins / mem.totalClosed) * 100 : 0,
  };
}
