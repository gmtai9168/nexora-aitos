import { runCycle } from "@/lib/server/ai-trader";
import { DEFAULT_AI_CONFIG, type AiTraderConfig } from "@/lib/ai-trader";

export const maxDuration = 40;

/**
 * Run one autonomous decision cycle. `dryRun: true` computes decisions without
 * sending any order — the safe way to watch what the AI would do first.
 */
export async function POST(request: Request) {
  let body: { config?: Partial<AiTraderConfig>; dryRun?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const config: AiTraderConfig = { ...DEFAULT_AI_CONFIG, ...(body.config ?? {}) };
  // Default to dry-run unless the caller explicitly asks to trade for real.
  const dryRun = body.dryRun !== false;

  const report = await runCycle(config, dryRun);
  return Response.json(report, { headers: { "Cache-Control": "no-store" } });
}
