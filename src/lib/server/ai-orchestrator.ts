import { EMPTY_MEMORY, type AiMemory } from "../ai-memory";
import { DEFAULT_AI_CONFIG, type AiTraderConfig, type CycleReport } from "../ai-trader";
import { runCycle } from "./ai-trader";
import { kvConfigured, kvGetJson, kvSetJson } from "./kv";

/**
 * Server-side orchestration for the autonomous trader.
 *
 * The learning memory, the run config, and the armed/disarmed switch all live
 * in KV, so a scheduler (Vercel Cron or an external ping) can drive the trader
 * with no browser open. `enabled` in KV is the authoritative kill switch — the
 * cron does nothing while it is false, however often it is called.
 */

const MEMORY_KEY = "nexora:ai-memory:v1";
const ENABLED_KEY = "nexora:ai-enabled";
const CONFIG_KEY = "nexora:ai-config";
const LOG_KEY = "nexora:ai-log";

/** One cycle wrapped in KV memory: read → decide/trade → write back. */
export async function cycleWithMemory(
  config: AiTraderConfig,
  dryRun: boolean,
  clientMemory?: AiMemory,
): Promise<CycleReport & { memorySource: "kv" | "local" }> {
  const usingKv = kvConfigured();
  let memory: AiMemory = clientMemory ?? EMPTY_MEMORY;

  if (usingKv) {
    const stored = await kvGetJson<AiMemory>(MEMORY_KEY);
    if (stored && stored.totalClosed >= (clientMemory?.totalClosed ?? 0)) {
      memory = stored;
    }
  }

  const report = await runCycle(config, dryRun, memory);

  if (usingKv && !dryRun) {
    await kvSetJson(MEMORY_KEY, report.memory);
  }

  return { ...report, memorySource: usingKv ? "kv" : "local" };
}

export async function clearMemory(): Promise<void> {
  if (kvConfigured()) await kvSetJson(MEMORY_KEY, EMPTY_MEMORY);
}

/* ------------------------------------------------------------------ *
 * Control state — armed flag + config + a short run log
 * ------------------------------------------------------------------ */

export type LogEntry = {
  at: number;
  opened: number;
  closed: number;
  openPositions: number;
  balance: number | null;
  message: string;
};

export type ControlState = {
  enabled: boolean;
  config: AiTraderConfig;
  log: LogEntry[];
  kv: boolean;
};

export async function getControl(): Promise<ControlState> {
  const kv = kvConfigured();
  if (!kv) return { enabled: false, config: DEFAULT_AI_CONFIG, log: [], kv: false };

  const [enabled, config, log] = await Promise.all([
    kvGetJson<boolean>(ENABLED_KEY),
    kvGetJson<AiTraderConfig>(CONFIG_KEY),
    kvGetJson<LogEntry[]>(LOG_KEY),
  ]);

  return {
    enabled: enabled === true,
    config: { ...DEFAULT_AI_CONFIG, ...(config ?? {}) },
    log: log ?? [],
    kv: true,
  };
}

export async function setControl(patch: { enabled?: boolean; config?: AiTraderConfig }): Promise<boolean> {
  if (!kvConfigured()) return false;
  const writes: Promise<boolean>[] = [];
  if (patch.enabled !== undefined) writes.push(kvSetJson(ENABLED_KEY, patch.enabled));
  if (patch.config !== undefined) writes.push(kvSetJson(CONFIG_KEY, patch.config));
  const results = await Promise.all(writes);
  return results.every(Boolean);
}

async function appendLog(entry: LogEntry): Promise<void> {
  if (!kvConfigured()) return;
  const log = (await kvGetJson<LogEntry[]>(LOG_KEY)) ?? [];
  await kvSetJson(LOG_KEY, [entry, ...log].slice(0, 30));
}

/**
 * The scheduled tick. Runs a live cycle only when armed, and records what it
 * did so the operator can see the AI's activity while they were away.
 */
export async function runScheduledCycle(): Promise<{ ran: boolean; reason?: string; report?: CycleReport }> {
  const state = await getControl();
  if (!state.kv) return { ran: false, reason: "no_kv" };
  if (!state.enabled) return { ran: false, reason: "disarmed" };

  const report = await cycleWithMemory(state.config, false);
  if (!report.ok) return { ran: false, reason: report.message, report };

  await appendLog({
    at: report.ranAt,
    opened: report.opened,
    closed: report.closed,
    openPositions: report.openPositions,
    balance: report.balance,
    message: report.message,
  });

  return { ran: true, report };
}
