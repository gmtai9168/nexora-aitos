import { DEFAULT_AI_CONFIG, type AiTraderConfig } from "@/lib/ai-trader";
import { type AiMemory } from "@/lib/ai-memory";
import { cycleWithMemory, clearMemory } from "@/lib/server/ai-orchestrator";
import { kvConfigured } from "@/lib/server/kv";

export const maxDuration = 40;

/**
 * Run one autonomous decision cycle from the browser.
 *
 * Memory is read from and written to KV when configured, else the client copy
 * is used. `dryRun: true` computes decisions and mutates nothing. `reset: true`
 * wipes the central memory so learning restarts everywhere.
 */
export async function POST(request: Request) {
  let body: { config?: Partial<AiTraderConfig>; dryRun?: boolean; memory?: AiMemory; reset?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.reset) {
    await clearMemory();
    return Response.json({ ok: true, reset: true, memorySource: kvConfigured() ? "kv" : "local" }, { headers: { "Cache-Control": "no-store" } });
  }

  const config: AiTraderConfig = { ...DEFAULT_AI_CONFIG, ...(body.config ?? {}) };
  const dryRun = body.dryRun !== false;

  const report = await cycleWithMemory(config, dryRun, body.memory);
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
