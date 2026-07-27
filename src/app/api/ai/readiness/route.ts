import { NextResponse } from "next/server";
import { getMemory, getControl } from "@/lib/server/ai-orchestrator";
import { computeReadiness } from "@/lib/readiness";

export const runtime = "nodejs";

/**
 * Go-Live readiness computed from the AI's real testnet track record.
 * Read-only and public — it only exposes aggregate stats, no secrets.
 */
export async function GET() {
  const [mem, control] = await Promise.all([getMemory(), getControl()]);

  // Derive the original deposit so drawdown % is measured from the right base.
  const latestBalance = control.log.find((l) => l.balance != null)?.balance ?? null;
  const startEquity =
    latestBalance != null ? Math.max(1, latestBalance - mem.totalPnl) : 5000;

  const readiness = computeReadiness(mem, startEquity);

  return NextResponse.json(
    {
      readiness,
      stats: {
        totalClosed: mem.totalClosed,
        totalWins: mem.totalWins,
        totalPnl: mem.totalPnl,
        balance: latestBalance,
        armed: control.enabled,
        symbols: control.config.symbols,
        updatedAt: mem.updatedAt,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
