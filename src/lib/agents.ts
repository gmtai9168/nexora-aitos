export type AgentStatus =
  | "online"
  | "thinking"
  | "voting"
  | "executing"
  | "learning"
  | "waiting"
  | "paused"
  | "offline";

export type Agent = {
  id: string;
  name: string;
  nameTh: string;
  group: string;
  /** Pair this agent specialises in, when it has one. */
  symbol?: string;
};

export type AgentGroup = {
  key: string;
  th: string;
  en: string;
  count: number;
  color: string;
  /** Position in the Exchange → … → Exchange pipeline. */
  stage: number;
};

/** Ten pods, 50 agents — the split comes straight from the platform spec. */
export const GROUPS: AgentGroup[] = [
  { key: "data", th: "ข้อมูล", en: "Data Intelligence", count: 5, color: "#3b9dff", stage: 1 },
  { key: "trend", th: "เทรนด์", en: "Trend AI", count: 6, color: "#10e08a", stage: 2 },
  { key: "smart", th: "เงินใหญ่", en: "Smart Money", count: 6, color: "#a78bfa", stage: 3 },
  { key: "futures", th: "ฟิวเจอร์ส", en: "Futures", count: 6, color: "#22d3ee", stage: 3 },
  { key: "pattern", th: "รูปแบบเทรด", en: "Pattern", count: 6, color: "#f472b6", stage: 3 },
  { key: "ml", th: "แมชชีนเลิร์นนิง", en: "Machine Learning", count: 5, color: "#facc15", stage: 4 },
  { key: "risk", th: "ความเสี่ยง", en: "Risk", count: 5, color: "#fb7185", stage: 5 },
  { key: "learn", th: "เรียนรู้ด้วยตนเอง", en: "Self Learning", count: 4, color: "#5eead4", stage: 6 },
  { key: "master", th: "มาสเตอร์", en: "Master AI", count: 3, color: "#00d4ff", stage: 7 },
  { key: "exec", th: "ส่งคำสั่ง", en: "Execution", count: 4, color: "#ffb020", stage: 8 },
];

export const TOTAL_AGENTS = GROUPS.reduce((a, g) => a + g.count, 0);

export const GROUP_BY_KEY = new Map(GROUPS.map((g) => [g.key, g]));

/** [English name, Thai name, optional specialised pair] */
const NAMES: Record<string, [string, string, string?][]> = {
  data: [
    ["Market Data AI", "ข้อมูลราคาตลาด"],
    ["OrderBook AI", "สมุดคำสั่งซื้อขาย"],
    ["News AI", "ข่าวสาร"],
    ["On-chain AI", "ข้อมูลออนเชน"],
    ["Data Quality AI", "คุณภาพข้อมูล"],
  ],
  trend: [
    ["Macro Trend AI", "เทรนด์ภาพใหญ่", "BTCUSDT"],
    ["Micro Trend AI", "เทรนด์ระยะสั้น", "ETHUSDT"],
    ["Momentum AI", "โมเมนตัม", "SOLUSDT"],
    ["Cycle AI", "วัฏจักรราคา"],
    ["Volatility AI", "ความผันผวน"],
    ["Market Regime AI", "สภาวะตลาด"],
  ],
  smart: [
    ["Liquidity AI", "สภาพคล่อง"],
    ["Order Flow AI", "ออร์เดอร์โฟลว์", "ETHUSDT"],
    ["Whale AI", "ติดตามวาฬ", "BTCUSDT"],
    ["Footprint AI", "ฟุตพรินต์"],
    ["Delta AI", "เดลตาแรงซื้อขาย"],
    ["Market Maker AI", "ผู้ดูแลสภาพคล่อง"],
  ],
  futures: [
    ["Funding AI", "ค่าธรรมเนียมสัญญา", "BNBUSDT"],
    ["Open Interest AI", "สัญญาคงค้าง"],
    ["Long Short Ratio AI", "สัดส่วนล็อง/ช็อต"],
    ["Basis AI", "ส่วนต่างสปอต-ฟิวเจอร์ส"],
    ["Liquidation AI", "การบังคับปิดสถานะ"],
    ["Premium AI", "พรีเมียมสัญญา"],
  ],
  pattern: [
    ["Breakout AI", "เบรกเอาต์", "XRPUSDT"],
    ["Mean Reversion AI", "กลับค่าเฉลี่ย"],
    ["Scalping AI", "สแกลป์"],
    ["Swing AI", "สวิง"],
    ["Grid AI", "กริด"],
    ["Arbitrage AI", "อาร์บิทราจ"],
  ],
  ml: [
    ["Transformer AI", "ทรานส์ฟอร์มเมอร์"],
    ["LSTM AI", "แอลเอสทีเอ็ม"],
    ["XGBoost AI", "เอ็กซ์จีบูสต์"],
    ["Reinforcement Learning AI", "เรียนรู้แบบเสริมกำลัง"],
    ["Neural Ensemble AI", "รวมโมเดลนิวรอล"],
  ],
  risk: [
    ["Position Sizing AI", "กำหนดขนาดไม้"],
    ["Portfolio Risk AI", "ความเสี่ยงพอร์ต"],
    ["Dynamic Leverage AI", "ปรับเลเวอเรจ"],
    ["Correlation AI", "ความสัมพันธ์สินทรัพย์"],
    ["Exposure Control AI", "คุมความเสี่ยงรวม"],
  ],
  learn: [
    ["Performance AI", "วิเคราะห์ผลงาน"],
    ["Strategy Optimizer AI", "ปรับกลยุทธ์"],
    ["Model Selector AI", "เลือกโมเดล"],
    ["Auto Retraining AI", "ฝึกโมเดลอัตโนมัติ"],
  ],
  master: [
    ["Master Decision AI", "ตัดสินใจสูงสุด"],
    ["Risk Gatekeeper AI", "ประตูความเสี่ยง"],
    ["Safety Guardian AI", "ผู้พิทักษ์ความปลอดภัย"],
  ],
  exec: [
    ["Smart Execution AI", "ส่งคำสั่งอัจฉริยะ"],
    ["Slippage AI", "คุมสลิปเพจ"],
    ["Order Optimizer AI", "ปรับคำสั่ง"],
    ["Latency Controller AI", "คุมความหน่วง"],
  ],
};

export const AGENTS: Agent[] = GROUPS.flatMap((g) =>
  Array.from({ length: g.count }, (_, i) => {
    const [name, nameTh, symbol] = NAMES[g.key][i];
    return { id: `${g.key}-${i}`, name, nameTh, group: g.key, symbol };
  }),
);

export const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]));

export const STATUS_META: Record<
  AgentStatus,
  { color: string; th: string; en: string }
> = {
  online: { color: "#10e08a", th: "ออนไลน์", en: "Online" },
  thinking: { color: "#ffc53d", th: "กำลังคิด", en: "Thinking" },
  voting: { color: "#3b9dff", th: "กำลังโหวต", en: "Voting" },
  executing: { color: "#ffb020", th: "กำลังส่งคำสั่ง", en: "Executing" },
  learning: { color: "#a78bfa", th: "กำลังเรียนรู้", en: "Learning" },
  waiting: { color: "#ff8f3d", th: "รอคิว", en: "Waiting" },
  paused: { color: "#6b8497", th: "หยุดชั่วคราว", en: "Paused" },
  offline: { color: "#ff4a68", th: "ออฟไลน์", en: "Offline" },
};

/** Stable 32-bit hash so every agent's simulated telemetry never jitters. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function spread(seed: number, min: number, max: number) {
  return min + seed * (max - min);
}

/**
 * Fleet state.
 *
 * Real inputs decide the shape: a dead feed takes everyone offline, volatility
 * decides how many pods are mid-thought, and each pod idles in the state that
 * matches its job. `tick` only rotates *which* agents are busy.
 */
export function fleetStatus(
  connected: boolean,
  volatility: number,
  tick: number,
  paused: Set<string> = new Set(),
): Map<string, AgentStatus> {
  const out = new Map<string, AgentStatus>();

  AGENTS.forEach((a, i) => {
    if (paused.has(a.id)) {
      out.set(a.id, "paused");
      return;
    }
    if (!connected) {
      out.set(a.id, "offline");
      return;
    }

    const busy = Math.min(0.5, 0.16 + volatility * 0.2);
    const phase = ((i * 7 + tick) % 23) / 23;

    if (phase < busy) {
      // Each pod's "busy" state is the one its role implies.
      const active: Record<string, AgentStatus> = {
        master: "voting",
        exec: "executing",
        learn: "learning",
        risk: "voting",
      };
      out.set(a.id, active[a.group] ?? "thinking");
    } else if (phase > 0.94) {
      out.set(a.id, "waiting");
    } else {
      out.set(a.id, "online");
    }
  });

  return out;
}

export type Telemetry = {
  version: string;
  accuracy: number;
  winRate: number;
  avgHoldingMin: number;
  decisionsToday: number;
  tradesToday: number;
  profitPct: number;
  cpu: number;
  ram: number;
  latency: number;
  gpu: number;
  lastTrainedDays: number;
  stability: number;
  dataQuality: number;
  maxDrawdown: number;
  exchanges: string[];
};

const VENUES = ["Binance", "Bybit", "OKX", "Bitget", "Hyperliquid"];

/**
 * Per-agent operational metrics.
 *
 * SIMULATED — a browser cannot read a model's CPU or accuracy. Values are a
 * stable function of the agent id, so they behave like a real fleet (never
 * jumping between renders) without pretending to be measured. The one live
 * input is `marketMove`: agents tied to a pair inherit that pair's real 24h
 * move, so the performance ranking tracks the actual market.
 */
export function telemetry(agent: Agent, marketMove: number | null): Telemetry {
  const s = hash(agent.id);
  const s2 = hash(agent.id + "b");
  const s3 = hash(agent.id + "c");

  const accuracy = spread(s, 68, 94);
  const stability = spread(s2, 72, 98);
  const lastTrainedDays = Math.round(spread(s3, 0, 21));

  return {
    version: `${1 + Math.floor(s * 3)}.${Math.floor(s2 * 10)}.${Math.floor(s3 * 10)}`,
    accuracy,
    winRate: spread(s2, 54, 78),
    avgHoldingMin: Math.round(spread(s3, 4, 220)),
    decisionsToday: Math.round(spread(s, 40, 320)),
    tradesToday: Math.round(spread(s2, 3, 60)),
    profitPct: marketMove ?? spread(s3, -2.5, 6),
    cpu: Math.round(spread(s2, 3, 34)),
    ram: Math.round(spread(s3, 180, 1400)),
    latency: Math.round(spread(s, 6, 48)),
    gpu: Math.round(spread(s3, 0, 55)),
    lastTrainedDays,
    stability,
    dataQuality: spread(s, 80, 99),
    maxDrawdown: spread(s3, 1.2, 12),
    // Binance is always wired up; the rest vary by agent.
    exchanges: [
      "Binance",
      ...VENUES.slice(1).filter((_, i) => hash(agent.id + i) > 0.5),
    ].slice(0, 3),
  };
}

export type TrustScore = {
  score: number;
  grade: "A+" | "A" | "B" | "C" | "D";
  parts: { key: string; th: string; value: number; weight: number }[];
};

/**
 * Trust Score — the weight Master AI should give this agent right now.
 *
 * Six inputs: historical accuracy, realised return, max drawdown (inverted),
 * model stability, freshness of the last retrain, and the quality of the data
 * it consumed. A model that has not been retrained in weeks loses weight even
 * if its accuracy still looks good.
 */
export function trustScore(t: Telemetry): TrustScore {
  const ret = Math.max(0, Math.min(100, 50 + t.profitPct * 8));
  const dd = Math.max(0, 100 - t.maxDrawdown * 7);
  const fresh = Math.max(0, 100 - t.lastTrainedDays * 4.5);

  const parts = [
    { key: "accuracy", th: "ความแม่นยำย้อนหลัง", value: t.accuracy, weight: 0.26 },
    { key: "return", th: "ผลตอบแทนจริง", value: ret, weight: 0.24 },
    { key: "drawdown", th: "Max Drawdown", value: dd, weight: 0.18 },
    { key: "stability", th: "ความเสถียรของโมเดล", value: t.stability, weight: 0.14 },
    { key: "fresh", th: "ความสดของโมเดล", value: fresh, weight: 0.1 },
    { key: "data", th: "คุณภาพข้อมูล", value: t.dataQuality, weight: 0.08 },
  ];

  const score = Math.round(parts.reduce((a, p) => a + p.value * p.weight, 0));
  const grade: TrustScore["grade"] =
    score >= 88 ? "A+" : score >= 78 ? "A" : score >= 66 ? "B" : score >= 54 ? "C" : "D";

  return { score, grade, parts };
}
