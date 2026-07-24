import { runCycle } from "@/lib/server/ai-trader";
import { DEFAULT_AI_CONFIG, type AiTraderConfig } from "@/lib/ai-trader";
import { EMPTY_MEMORY, type AiMemory } from "@/lib/ai-memory";
import { kvConfigured, kvGetJson, kvSetJson } from "@/lib/server/kv";

export const maxDuration = 40;

/** Central key for the shared learning memory. */
const MEMORY_KEY = "nexora:ai-memory:v1";

/**
 * Run one autonomous decision cycle.
 *
 * Memory lives centrally in Vercel KV when configured — the cycle reads it,
 * updates it, and writes it back, so it is durable and shared across devices.
 * On the first run with an empty store, any memory the client still holds in
 * localStorage seeds the store, so nothing learned so far is lost. Without KV
 * it falls back to the client-passed memory, exactly as before.
 *
 * `dryRun: true` computes decisions and never mutates the memory or the book.
 */
export async function POST(request: Request) {
  let body: { config?: Partial<AiTraderConfig>; dryRun?: boolean; memory?: AiMemory; reset?: boolean };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  // A reset clears the central memory too, not just the browser copy.
  if (body.reset) {
    if (kvConfigured()) await kvSetJson(MEMORY_KEY, EMPTY_MEMORY);
    return Response.json({ ok: true, reset: true, memorySource: kvConfigured() ? "kv" : "local" }, { headers: { "Cache-Control": "no-store" } });
  }

  const config: AiTraderConfig = { ...DEFAULT_AI_CONFIG, ...(body.config ?? {}) };
  const dryRun = body.dryRun !== false;
  const usingKv = kvConfigured();

  // Decide the memory to run against: KV wins; else the client's copy.
  let memory: AiMemory = body.memory ?? EMPTY_MEMORY;
  if (usingKv) {
    const stored = await kvGetJson<AiMemory>(MEMORY_KEY);
    if (stored && stored.totalClosed >= (body.memory?.totalClosed ?? 0)) {
      memory = stored; // central store is ahead — it is the source of truth
    }
    // else: store is empty or behind the client — keep the client copy so a
    // localStorage history migrates into KV on the next write.
  }

  const report = await runCycle(config, dryRun, memory);

  if (usingKv && !dryRun) {
    await kvSetJson(MEMORY_KEY, report.memory);
  }

  return Response.json(
    { ...report, memorySource: usingKv ? "kv" : "local" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
