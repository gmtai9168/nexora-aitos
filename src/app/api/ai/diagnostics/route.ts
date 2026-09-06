import { NextResponse } from "next/server";
import { getMemory } from "@/lib/server/ai-orchestrator";
import { memoryView } from "@/lib/ai-memory";

export const runtime = "nodejs";

/** Read-only breakdown of the AI's learned results, to find where it loses. */
export async function GET() {
  const mem = await getMemory();
  const view = memoryView(mem);

  // Aggregate per symbol and per regime across all buckets.
  const bySymbol: Record<string, { trades: number; wins: number; pnl: number }> = {};
  const byRegime: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const b of view.buckets) {
    const s = (bySymbol[b.symbol] ??= { trades: 0, wins: 0, pnl: 0 });
    s.trades += b.trades;
    s.wins += Math.round((b.winRate / 100) * b.trades);
    s.pnl += b.pnlSum;
    const r = (byRegime[b.regime] ??= { trades: 0, wins: 0, pnl: 0 });
    r.trades += b.trades;
    r.wins += Math.round((b.winRate / 100) * b.trades);
    r.pnl += b.pnlSum;
  }

  const rank = (m: Record<string, { trades: number; wins: number; pnl: number }>) =>
    Object.entries(m)
      .map(([k, v]) => ({ k, ...v, winRate: v.trades ? (v.wins / v.trades) * 100 : 0 }))
      .sort((a, b) => a.pnl - b.pnl);

  // Time-window analysis of the per-trade P&L series (oldest → newest) so we can
  // see whether the recent edge decay is fewer/smaller winners or bigger losers.
  const series = mem.pnlSeries ?? [];
  const seg = (arr: number[]) => {
    const wins = arr.filter((p) => p > 0);
    const losses = arr.filter((p) => p <= 0);
    const gw = wins.reduce((a, b) => a + b, 0);
    const gl = -losses.reduce((a, b) => a + b, 0);
    return {
      trades: arr.length,
      winRate: arr.length ? (wins.length / arr.length) * 100 : 0,
      avgWin: wins.length ? gw / wins.length : 0,
      avgLoss: losses.length ? gl / losses.length : 0,
      pf: gl > 0 ? gw / gl : gw > 0 ? Infinity : 0,
      sum: arr.reduce((a, b) => a + b, 0),
    };
  };
  const q = Math.max(1, Math.floor(series.length / 4));
  const quarters = series.length >= 8
    ? [0, 1, 2, 3].map((i) => seg(series.slice(i * q, i === 3 ? undefined : (i + 1) * q)))
    : [];
  const mid = Math.floor(series.length / 2);

  return NextResponse.json(
    {
      totalClosed: mem.totalClosed,
      overallWinRate: view.overallWinRate,
      totalPnl: mem.totalPnl,
      bySymbol: rank(bySymbol),
      byRegime: rank(byRegime),
      worstBuckets: [...view.buckets].sort((a, b) => a.pnlSum - b.pnlSum).slice(0, 8),
      bestBuckets: [...view.buckets].sort((a, b) => b.pnlSum - a.pnlSum).slice(0, 8),
      timeline: {
        seriesLen: series.length,
        early: seg(series.slice(0, mid)),
        recent: seg(series.slice(mid)),
        quarters, // oldest → newest
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
