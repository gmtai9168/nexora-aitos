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
  /** Direction taken, for crediting the council on close. */
  dir?: "LONG" | "SHORT";
  /** The directional council votes at entry, for per-agent outcome attribution. */
  votes?: { id: string; vote: number }[];
};

/** Per-agent track record — how the council earns (or loses) its weight. */
export type AgentStat = { votes: number; correct: number };

export type AiMemory = {
  /** key = `${strategy}|${symbol}|${regime}` */
  stats: Record<string, Bucket>;
  /** key = symbol — context of positions the AI currently holds. */
  open: Record<string, OpenContext>;
  /** key = agent id — running vote/hit counts that set each agent's weight. */
  agents?: Record<string, AgentStat>;
  /** Recent close directions × outcome (+1 long-paid / -1 short-paid), for the RL agent. */
  recent?: number[];
  totalClosed: number;
  totalWins: number;
  totalPnl: number;
  /** Sum of winning P&L (gross profit) — for Profit Factor. Accumulates going forward. */
  grossWin?: number;
  /** Sum of |losing P&L| (gross loss) — for Profit Factor. */
  grossLoss?: number;
  /** Rolling per-trade P&L series (last 500) — for the equity curve / max drawdown. */
  pnlSeries?: number[];
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
    grossWin: (mem.grossWin ?? 0) + (pnl > 0 ? pnl : 0),
    grossLoss: (mem.grossLoss ?? 0) + (pnl < 0 ? -pnl : 0),
    pnlSeries: [...(mem.pnlSeries ?? []), pnl].slice(-500),
    updatedAt: at,
  };
}

/** Minimum agent samples before its weight moves off the neutral 1.0. */
const AGENT_MIN = 6;

/**
 * The weight Master AI gives an agent's vote — its earned influence.
 * 1.0 until it has a track record, then scaled 0.4…1.6 by hit-rate.
 */
export function agentWeight(mem: AiMemory, id: string): number {
  const a = mem.agents?.[id];
  if (!a || a.votes < AGENT_MIN) return 1;
  const acc = a.correct / a.votes; // 0..1
  return Math.max(0.4, Math.min(1.6, 0.5 + acc));
}

/** Which direction has been paying lately (−1..1), the RL agent's input. */
export function recentBias(mem: AiMemory): number {
  const r = mem.recent ?? [];
  if (r.length === 0) return 0;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

/**
 * Fold one closed trade into the council's memory: credit each agent whose
 * vote agreed (or disagreed) with the outcome, and record the paying direction.
 */
export function recordCouncilOutcome(
  mem: AiMemory,
  votes: { id: string; vote: number }[],
  dir: "LONG" | "SHORT",
  win: boolean,
): AiMemory {
  const agents = { ...(mem.agents ?? {}) };
  const longWin = dir === "LONG";
  for (const v of votes) {
    if (Math.abs(v.vote) < 0.12) continue; // only agents that took a side
    const prev = agents[v.id] ?? { votes: 0, correct: 0 };
    const agreedWithTrade = v.vote > 0 === longWin;
    const correct = agreedWithTrade === win; // right when it backed a winner or faded a loser
    agents[v.id] = { votes: prev.votes + 1, correct: prev.correct + (correct ? 1 : 0) };
  }
  const paidDir = (longWin === win ? 1 : -1); // +1 = longs paid, -1 = shorts paid
  const recent = [...(mem.recent ?? []), paidDir].slice(-12);
  return { ...mem, agents, recent };
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
