import type { AiMemory } from "./ai-memory";
import type { LabStrategyKind } from "./backtest-lab";
import { TESTNET_SYMBOLS } from "./testnet";

/**
 * Config for the autonomous testnet trader. Shared between the control panel
 * and the cycle engine. Every field here is a safety lever the operator can
 * see and change — nothing about the loop is hidden.
 */
export type AiTraderConfig = {
  strategy: LabStrategyKind;
  interval: string;
  symbols: string[];
  /** Share of available balance committed as margin per new position. */
  riskPct: number;
  leverage: number;
  maxPositions: number;
  /** Minimum AI confidence (0–100) required to open. */
  minConfidence: number;
  /** Close a position once its return on margin reaches ±these. */
  takeProfitPct: number;
  stopLossPct: number;
  /** Run the deep-confluence layer (funding, OI, flow, sentiment, higher TF). */
  deepMode: boolean;
  /** Read the news flow (LLM when ANTHROPIC_API_KEY is set, else keyword) as a factor. */
  newsMode: boolean;
  /** Skip opening when the news layer flags an imminent high-impact event. */
  newsLockout: boolean;
  /** Skip opening around scheduled high-impact events (expiry, CPI, FOMC). Free. */
  macroLockout: boolean;
  /** On-chain exchange-flow factor — dormant until a paid provider key is set. */
  onchainMode: boolean;
};

export const DEFAULT_AI_CONFIG: AiTraderConfig = {
  strategy: "ensemble",
  interval: "5m",
  symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"],
  riskPct: 2,
  leverage: 5,
  maxPositions: 3,
  minConfidence: 62,
  takeProfitPct: 30,
  stopLossPct: 15,
  deepMode: true,
  // On by default in the FREE keyword tier: while ANTHROPIC_API_KEY is unset,
  // headlines are read with keyword scoring only — no LLM call, zero cost.
  // ⚠ The moment ANTHROPIC_API_KEY is set, this auto-upgrades to the paid AI
  // tier (per-read cost). Turn the panel toggle off first if that's unwanted.
  newsMode: true,
  newsLockout: true,
  // Free scheduled-event lockout (options expiry always; CPI/FOMC when FINNHUB_TOKEN set).
  macroLockout: true,
  // Dormant scaffold — needs GLASSNODE_API_KEY / NANSEN_API_KEY at real-money launch.
  onchainMode: false,
};

/** Hard ceilings the engine clamps the config to, whatever the UI sends. */
export const AI_LIMITS = {
  maxLeverage: 20,
  maxPositionsCeiling: 5,
  maxRiskPct: 10,
};

export type CycleAction =
  | "opened"
  | "closed_tp"
  | "closed_sl"
  | "hold"
  | "no_signal"
  | "low_confidence"
  | "learned_avoid"
  | "news_lockout"
  | "macro_lockout"
  | "blocked_risk"
  | "max_positions"
  | "already_open"
  | "error";

export const ACTION_META: Record<CycleAction, { th: string; tone: "up" | "down" | "warn" | "neutral" }> = {
  opened: { th: "เปิดสถานะใหม่", tone: "up" },
  closed_tp: { th: "ปิดทำกำไร", tone: "up" },
  closed_sl: { th: "ปิดตัดขาดทุน", tone: "down" },
  hold: { th: "ถือต่อ", tone: "neutral" },
  no_signal: { th: "ไม่มีสัญญาณ", tone: "neutral" },
  low_confidence: { th: "ความมั่นใจต่ำ ข้าม", tone: "warn" },
  learned_avoid: { th: "เลี่ยงจากบทเรียนเดิม", tone: "warn" },
  news_lockout: { th: "ล็อกจากข่าวแรง", tone: "warn" },
  macro_lockout: { th: "ล็อกช่วงเหตุการณ์สำคัญ", tone: "warn" },
  blocked_risk: { th: "Risk Engine ปฏิเสธ", tone: "down" },
  max_positions: { th: "เต็มเพดานสถานะ", tone: "warn" },
  already_open: { th: "มีสถานะอยู่แล้ว", tone: "neutral" },
  error: { th: "ผิดพลาด", tone: "down" },
};

export type Decision = {
  symbol: string;
  action: CycleAction;
  side?: "LONG" | "SHORT";
  confidence?: number;
  detail: string;
  price?: number;
  qty?: number;
  pnlPct?: number;
  orderId?: number;
  /** The bucket's learning score at decision time, when it influenced the call. */
  learnScore?: number;
  /** Deep-confluence confidence adjustment, when the layer ran. */
  deepAdj?: number;
  /** Factors the deep layer weighed, for the decision log. */
  deepFactors?: { label: string; agree: boolean | null; note: string }[];
};

export type CycleReport = {
  ok: boolean;
  ranAt: number;
  dryRun: boolean;
  balance: number | null;
  openPositions: number;
  opened: number;
  closed: number;
  decisions: Decision[];
  message: string;
  /** Learning memory after this cycle — the client persists it and sends it back. */
  memory: AiMemory;
  /** Where the memory came from this cycle: central KV or the client copy. */
  memorySource?: "kv" | "local";
};

export function sanitizeConfig(c: AiTraderConfig): AiTraderConfig {
  return {
    ...c,
    leverage: Math.max(1, Math.min(AI_LIMITS.maxLeverage, Math.round(c.leverage))),
    maxPositions: Math.max(1, Math.min(AI_LIMITS.maxPositionsCeiling, Math.round(c.maxPositions))),
    riskPct: Math.max(0.5, Math.min(AI_LIMITS.maxRiskPct, c.riskPct)),
    minConfidence: Math.max(50, Math.min(95, c.minConfidence)),
    symbols: c.symbols.filter((s) => TESTNET_SYMBOLS.includes(s)),
  };
}
