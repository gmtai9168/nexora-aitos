import { runCycle } from "@/lib/server/ai-trader";
import { DEFAULT_AI_CONFIG, type AiTraderConfig } from "@/lib/ai-trader";
import { EMPTY_MEMORY, type AiMemory } from "@/lib/ai-memory";

export const maxDuration = 40;

/**
 * Run one autonomous decision cycle. `dryRun: true` computes decisions without
 * sending any order — the safe way to watch what the AI would do first. The
 * caller passes the learning memory in and gets the updated memory back to
 * persist, so results accumulate across cycles.
 */
export async function POST(request: Request) {
  let body: { config?: Partial<AiTraderConfig>; dryRun?: boolean; memory?: AiMemory };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const config: AiTraderConfig = { ...DEFAULT_AI_CONFIG, ...(body.config ?? {}) };
  // Default to dry-run unless the caller explicitly asks to trade for real.
  const dryRun = body.dryRun !== false;
  const memory: AiMemory = body.memory ?? EMPTY_MEMORY;

  const report = await runCycle(config, dryRun, memory);
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
