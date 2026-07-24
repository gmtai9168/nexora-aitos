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
