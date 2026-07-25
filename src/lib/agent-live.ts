/**
 * Live per-agent performance registry.
 *
 * The 50 agents earn a real track record in the trading memory (votes vs. hits
 * → weight). That record lives server-side (KV); this module is the client-side
 * mailbox a provider fills from /api/agents-perf so the pure `telemetry()` /
 * `trustScore()` functions — called all over the dashboard — can show real
 * accuracy and earned weight instead of placeholder values, without every
 * component having to fetch it. When empty (no trades yet, or KV unset),
 * `getAgentLive` returns null and the callers fall back to labelled demo values.
 */

export type AgentPerf = {
  /** Directional votes this agent has been graded on. */
  votes: number;
  correct: number;
  /** correct / votes, 0–1. */
  accuracy: number;
  /** Earned weight Master AI gives its vote (0.4–1.6). */
  weight: number;
};

let LIVE: Record<string, AgentPerf> = {};

export function setAgentLive(map: Record<string, AgentPerf>): void {
  LIVE = map ?? {};
}

/** Real performance for an agent, or null when it has no graded track record. */
export function getAgentLive(id: string): AgentPerf | null {
  const p = LIVE[id];
  return p && p.votes >= AGENT_MIN_SAMPLES ? p : null;
}

/** Whether any agent has a real track record yet (drives site-wide "real vs demo"). */
export function hasLiveAgents(): boolean {
  return Object.values(LIVE).some((p) => p.votes >= AGENT_MIN_SAMPLES);
}

/** Matches ai-memory's AGENT_MIN — the samples before a record is trusted. */
export const AGENT_MIN_SAMPLES = 6;
