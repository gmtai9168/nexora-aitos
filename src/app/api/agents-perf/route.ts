import { agentWeight, type AiMemory } from "@/lib/ai-memory";
import { AGENTS } from "@/lib/agents";
import { kvConfigured, kvGetJson } from "@/lib/server/kv";

export const maxDuration = 15;

/**
 * Real per-agent track record from the central trading memory (KV): how many
 * directional votes each agent has been graded on, its hit-rate, and the weight
 * Master AI now gives it. The dashboard reads this so every agent card's
 * accuracy/trust reflects proven performance rather than a placeholder.
 */
export async function GET() {
  const mem = (await kvGetJson<AiMemory>("nexora:ai-memory:v1")) ?? null;
  const stats = mem?.agents ?? {};

  const perf: Record<string, { votes: number; correct: number; accuracy: number; weight: number }> = {};
  for (const a of AGENTS) {
    const s = stats[a.id];
    const votes = s?.votes ?? 0;
    const correct = s?.correct ?? 0;
    perf[a.id] = {
      votes,
      correct,
      accuracy: votes ? correct / votes : 0,
      weight: mem ? agentWeight(mem, a.id) : 1,
    };
  }

  return Response.json(
    {
      configured: kvConfigured(),
      totalClosed: mem?.totalClosed ?? 0,
      overallWinRate: mem && mem.totalClosed ? (mem.totalWins / mem.totalClosed) * 100 : 0,
      perf,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
