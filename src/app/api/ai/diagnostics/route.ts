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

  return NextResponse.json(
    {
      totalClosed: mem.totalClosed,
      overallWinRate: view.overallWinRate,
      totalPnl: mem.totalPnl,
      bySymbol: rank(bySymbol),
      byRegime: rank(byRegime),
      worstBuckets: [...view.buckets].sort((a, b) => a.pnlSum - b.pnlSum).slice(0, 8),
      bestBuckets: [...view.buckets].sort((a, b) => b.pnlSum - a.pnlSum).slice(0, 8),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
