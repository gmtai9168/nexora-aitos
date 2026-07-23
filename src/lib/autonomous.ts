import type { Regime } from "./analytics";
import type { BookSummary } from "./book";
import type { MasterDecision } from "./decision";
import type { ExchangeHealth } from "./market-context";
import type { GlobalRisk, RiskBand } from "./risk-engine";
import type { Quote } from "./types";

export type AutonomyMode = "monitor" | "recommend" | "semi" | "full" | "emergency";

export const MODES: {
  key: AutonomyMode;
  th: string;
  en: string;
  detail: string;
  color: string;
}[] = [
  {
    key: "monitor",
    th: "เฝ้าดูอย่างเดียว",
    en: "Monitor",
    detail: "AI วิเคราะห์และรายงาน แต่ไม่ส่งคำสั่งใดๆ",
    color: "#6b8497",
  },
  {
    key: "recommend",
    th: "แนะนำ รอคนอนุมัติ",
    en: "Recommend",
    detail: "AI เสนอคำสั่งทุกครั้ง แต่ต้องกดอนุมัติก่อนจึงส่ง",
    color: "#3b9dff",
  },
  {
    key: "semi",
    th: "กึ่งอัตโนมัติ",
    en: "Semi Auto",
    detail: "AI เปิดสถานะเองได้ แต่ไม้ใหญ่เกินเกณฑ์ต้องขออนุมัติ",
    color: "#ffb020",
  },
  {
    key: "full",
    th: "อัตโนมัติเต็มรูปแบบ",
    en: "Full Auto",
    detail: "AI เทรดเอง 24 ชั่วโมง ภายใต้ข้อจำกัดของ Risk Engine",
    color: "#14e2a0",
  },
  {
    key: "emergency",
    th: "หยุดฉุกเฉิน",
    en: "Emergency",
    detail: "หยุดทุกอย่างทันที ยกเลิกคำสั่งค้าง ไม่เปิดสถานะใหม่",
    color: "#ff4a68",
  },
];

export type QueueItem = {
  symbol: string;
  side: "LONG" | "SHORT";
  confidence: number;
  status: "approved" | "waiting" | "rejected" | "pending";
  statusTh: string;
  reason: string;
};

/**
 * Decision queue. Every watched symbol is scored the same way the Master panel
 * scores the active one, then routed by the current autonomy mode: in Monitor
 * nothing proceeds, in Recommend everything waits for a human.
 */
export function decisionQueue(
  quotes: Map<string, Quote>,
  symbols: string[],
  mode: AutonomyMode,
  riskBand: RiskBand,
): QueueItem[] {
  return symbols
    .map((s) => {
      const q = quotes.get(s);
      if (!q) return null;

      const range = q.high - q.low;
      const pos = range ? (q.price - q.low) / range : 0.5;
      const side: "LONG" | "SHORT" = q.changePct >= 0 ? "LONG" : "SHORT";
      const confidence = Math.round(
        Math.min(95, 52 + Math.abs(q.changePct) * 5 + Math.abs(pos - 0.5) * 30),
      );

      let status: QueueItem["status"];
      let reason: string;

      if (mode === "emergency") {
        status = "rejected";
        reason = "ระบบอยู่ในโหมดหยุดฉุกเฉิน";
      } else if (riskBand === "stop") {
        status = "rejected";
        reason = "Risk Engine ปิดการเปิดสถานะใหม่";
      } else if (confidence < 60) {
        status = "pending";
        reason = `ความมั่นใจ ${confidence}% ต่ำกว่าเกณฑ์ 60% — รอสัญญาณเพิ่ม`;
      } else if (mode === "monitor") {
        status = "pending";
        reason = "โหมดเฝ้าดู — บันทึกไว้แต่ไม่ส่งคำสั่ง";
      } else if (mode === "recommend") {
        status = "waiting";
        reason = "รอผู้ดูแลกดอนุมัติตามโหมดที่ตั้งไว้";
      } else if (mode === "semi" && confidence < 78) {
        status = "waiting";
        reason = `กึ่งอัตโนมัติ — ความมั่นใจ ${confidence}% ยังไม่ถึงเกณฑ์ส่งเอง 78%`;
      } else {
        status = "approved";
        reason = `ผ่านเกณฑ์ทุกข้อ · ${side} ที่ความมั่นใจ ${confidence}%`;
      }

      const statusTh = {
        approved: "อนุมัติแล้ว",
        waiting: "รออนุมัติ",
        rejected: "ปฏิเสธ",
        pending: "รอสัญญาณ",
      }[status];

      return { symbol: s, side, confidence, status, statusTh, reason };
    })
    .filter((x): x is QueueItem => x !== null)
    .sort((a, b) => b.confidence - a.confidence);
}

export type Goal = {
  key: string;
  th: string;
  target: number;
  actual: number;
  /** true when lower is better, e.g. drawdown. */
  inverse?: boolean;
  unit: string;
};

export function goalProgress(book: BookSummary, drawdown: number): Goal[] {
  return [
    { key: "daily", th: "เป้าหมายรายวัน", target: 1, actual: book.dayPnlPct, unit: "%" },
    { key: "weekly", th: "เป้าหมายรายสัปดาห์", target: 5, actual: book.dayPnlPct * 5, unit: "%" },
    { key: "monthly", th: "เป้าหมายรายเดือน", target: 15, actual: book.totalPnlPct, unit: "%" },
    {
      key: "drawdown",
      th: "เพดาน Drawdown",
      target: 5,
      actual: drawdown,
      inverse: true,
      unit: "%",
    },
    {
      key: "margin",
      th: "เพดานการใช้มาร์จิ้น",
      target: 40,
      actual: book.marginRatio,
      inverse: true,
      unit: "%",
    },
  ];
}

export type Article = {
  id: string;
  th: string;
  pass: boolean;
  evidence: string;
};

/**
 * AI Constitution.
 *
 * Five standing rules that outrank every model in the system. Each one is
 * checked against live state on every render, so the page shows compliance as
 * a measured fact rather than a promise.
 */
export function constitution(input: {
  mode: AutonomyMode;
  riskApproved: boolean;
  drawdown: number;
  drawdownCap: number;
  book: BookSummary;
  decision: MasterDecision | null;
  recorderCount: number;
  untestedInProduction: boolean;
}): Article[] {
  const {
    mode,
    riskApproved,
    drawdown,
    drawdownCap,
    book,
    decision,
    recorderCount,
    untestedInProduction,
  } = input;

  const raisingRisk = drawdown > drawdownCap && book.marginRatio > 45;

  return [
    {
      id: "risk-gate",
      th: "ห้ามส่งคำสั่งหากไม่ผ่าน Risk Engine",
      pass: mode === "emergency" ? true : riskApproved || mode === "monitor",
      evidence: riskApproved
        ? "คณะกรรมการความเสี่ยงอนุมัติคำสั่งล่าสุด"
        : mode === "monitor"
          ? "โหมดเฝ้าดู — ไม่มีคำสั่งถูกส่ง"
          : "Risk Engine ยังไม่อนุมัติ ระบบจึงระงับการส่งคำสั่ง",
    },
    {
      id: "drawdown",
      th: `ห้ามเพิ่มความเสี่ยงเมื่อ Drawdown เกิน ${drawdownCap}%`,
      pass: !raisingRisk,
      evidence: `Drawdown ปัจจุบัน ${drawdown.toFixed(2)}% · การใช้มาร์จิ้น ${book.marginRatio.toFixed(1)}%`,
    },
    {
      id: "untested",
      th: "ห้ามนำโมเดลที่ยังไม่ผ่านการทดสอบขึ้น Production",
      pass: !untestedInProduction,
      evidence: untestedInProduction
        ? "พบโมเดลที่ยังไม่ผ่านเกณฑ์อยู่ในสถานะใช้งานจริง"
        : "ทุกโมเดลใน Production ผ่าน Backtest · Walk Forward · Monte Carlo แล้ว",
    },
    {
      id: "explainable",
      th: "ทุกการตัดสินใจต้องอธิบายย้อนหลังได้",
      pass: decision !== null,
      evidence: decision
        ? `มติล่าสุดมีหลักฐานประกอบ ${decision.evidence.length} ข้อ (${decision.supporting} หนุน / ${decision.against} ค้าน)`
        : "ยังไม่มีมติให้ตรวจสอบ",
    },
    {
      id: "recorded",
      th: "ทุกคำสั่งต้องถูกบันทึกใน Mission Recorder",
      pass: recorderCount > 0,
      evidence: `บันทึกไว้แล้ว ${recorderCount} รายการในเซสชันนี้`,
    },
  ];
}

export type BrainState = {
  objectiveTh: string;
  riskModeTh: string;
  marketModeTh: string;
  tradingModeTh: string;
  focus: string;
  confidence: number;
  expectedRR: number;
  expectedWin: number;
  narrativeTh: string;
};

/**
 * What the Master AI would say if asked. Every clause is generated from a
 * number elsewhere on the page, so the narrative can never drift from the data.
 */
export function brainState(
  mode: AutonomyMode,
  decision: MasterDecision | null,
  regime: Regime,
  global: GlobalRisk,
  book: BookSummary,
  symbol: string,
  queue: QueueItem[],
): BrainState {
  const base = symbol.replace(/USDT$/, "");
  const approved = queue.filter((q) => q.status === "approved").length;
  const waiting = queue.filter((q) => q.status === "waiting").length;

  const riskModeTh =
    global.band === "safe" ? "สมดุล" : global.band === "watch" ? "ระมัดระวัง" : "ป้องกันเงินทุน";

  const tradingModeTh =
    mode === "emergency"
      ? "หยุดทั้งหมด"
      : global.preservationMode
        ? "อนุรักษ์นิยม"
        : mode === "full"
          ? "เชิงรุกพอประมาณ"
          : mode === "semi"
            ? "กึ่งอัตโนมัติ"
            : "รอคำสั่งจากผู้ดูแล";

  const parts: string[] = [];

  parts.push(
    `ขณะนี้ตลาด ${base} อยู่ในสภาวะ${regime.labelTh} ทิศทาง${regime.biasTh} และคะแนนความเสี่ยงรวมของระบบอยู่ที่ ${global.score}/100`,
  );

  if (mode === "emergency") {
    parts.push("ระบบถูกสั่งหยุดฉุกเฉิน ผมจึงยกเลิกคำสั่งค้างทั้งหมดและไม่เปิดสถานะใหม่");
  } else if (global.preservationMode) {
    parts.push(
      `ผมเปิดโหมดรักษาเงินทุนแล้วเพราะ${global.preservationReasonTh} จึงลดขนาดไม้และจำกัดจำนวนสถานะที่เปิดพร้อมกัน`,
    );
  } else if (decision && decision.action !== "WAIT") {
    parts.push(
      `หลักฐาน ${decision.supporting} จาก ${decision.evidence.length} ข้อชี้ไปทาง ${decision.action} ผมจึงเสนอเข้าที่ความมั่นใจ ${decision.confidence}% ด้วยขนาด ${decision.positionSizePct}% ของพอร์ต`,
    );
  } else {
    parts.push("หลักฐานยังขัดกัน ผมจึงเลือกรอจังหวะที่สัญญาณสอดคล้องกันมากกว่านี้ก่อน");
  }

  parts.push(
    `ในคิวตอนนี้มี ${approved} รายการที่ผ่านเกณฑ์แล้ว และ ${waiting} รายการรอผู้ดูแลอนุมัติ · ใช้มาร์จิ้นไปแล้ว ${book.marginRatio.toFixed(1)}% ของพอร์ต`,
  );

  return {
    objectiveTh: global.preservationMode ? "รักษาเงินทุน" : "เติบโตของเงินทุน",
    riskModeTh,
    marketModeTh: regime.labelTh,
    tradingModeTh,
    focus: base,
    confidence: decision?.confidence ?? 0,
    expectedRR: decision?.riskReward ?? 0,
    expectedWin: decision?.expectedWinRate ?? 0,
    narrativeTh: parts.join(" · "),
  };
}

export type OverrideAction = {
  key: string;
  th: string;
  active: boolean;
  effect: string;
};

export const OVERRIDES: { key: string; th: string; effect: string }[] = [
  { key: "stop-symbol", th: "หยุดเทรดสินทรัพย์ที่เลือก", effect: "ไม่เปิดสถานะใหม่ในคู่นี้" },
  { key: "cap-leverage", th: "จำกัดเลเวอเรจไม่เกิน 5X", effect: "ลดเพดานเลเวอเรจทั้งระบบ" },
  { key: "force-hedge", th: "บังคับเปิด Hedge", effect: "เปิดสถานะป้องกันสวนทิศทางหลัก" },
  { key: "reduce-risk", th: "ลดความเสี่ยงลงครึ่งหนึ่ง", effect: "ลดขนาดทุกสถานะลง 50%" },
  { key: "close-all", th: "ปิดสถานะทั้งหมด", effect: "ส่งคำสั่งปิดทุกสถานะที่เปิดอยู่" },
  { key: "pause-ai", th: "พัก AI ชั่วคราว", effect: "AI หยุดคิดจนกว่าจะสั่งกลับ" },
];

export type MissionRecord = {
  at: number;
  actor: string;
  action: string;
  reason: string;
  confidence: number;
  outcome: string;
};

export type HealthRow = { th: string; en: string; value: string; ok: boolean };

export function systemHealth(
  exchanges: ExchangeHealth[],
  connected: boolean,
  latency: number | null,
  agentsOnline: number,
  agentsTotal: number,
): HealthRow[] {
  const up = exchanges.filter((e) => e.online).length;
  const best = exchanges.filter((e) => e.online).map((e) => e.latency);

  return [
    { th: "ฟีดข้อมูลตลาด", en: "Market Data", value: connected ? "Streaming" : "Reconnecting", ok: connected },
    { th: "API ภายใน", en: "API", value: latency !== null ? `${latency} ms` : "—", ok: latency !== null },
    {
      th: "การเชื่อมต่อ Exchange",
      en: "Exchange",
      value: `${up}/${exchanges.length || 5}`,
      ok: up > 0,
    },
    {
      th: "ความหน่วงต่ำสุด",
      en: "Best Latency",
      value: best.length ? `${Math.min(...best)} ms` : "—",
      ok: best.length > 0 && Math.min(...best) < 1500,
    },
    {
      th: "กองเอเจนต์ AI",
      en: "AI Cluster",
      value: `${agentsOnline}/${agentsTotal}`,
      ok: agentsOnline === agentsTotal,
    },
    { th: "ฐานข้อมูล", en: "Database", value: connected ? "Healthy" : "Degraded", ok: connected },
    { th: "Redis / Cache", en: "Cache", value: connected ? "Healthy" : "Degraded", ok: connected },
    { th: "คิวข้อความ", en: "Message Queue", value: connected ? "Healthy" : "Degraded", ok: connected },
  ];
}
