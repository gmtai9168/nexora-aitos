import type { Regime } from "./analytics";
import type { BookSummary } from "./book";
import type { MasterDecision, MarketContext } from "./decision";
import type { ExchangeHealth } from "./market-context";
import type { BlackSwan, GlobalRisk, MarketRisk } from "./risk-engine";
import type { Quote } from "./types";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export type Threat = {
  key: string;
  th: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  impactPct: number;
  response: string;
  detail: string;
};

const sevOf = (v: number): Threat["severity"] =>
  v >= 75 ? "CRITICAL" : v >= 50 ? "HIGH" : v >= 25 ? "MEDIUM" : "LOW";

/**
 * Threat board. Each row is a live market condition scored for how much of the
 * book it could move, paired with the defence the system would actually run.
 */
export function threats(
  market: MarketRisk[],
  ctx: MarketContext,
  regime: Regime,
  swans: BlackSwan[],
  exchanges: ExchangeHealth[],
): Threat[] {
  const m = (k: string) => market.find((x) => x.key === k)?.score ?? 40;
  const down = exchanges.filter((e) => !e.online).length;
  const whale = ctx.whaleBuyShare;

  const rows: Threat[] = [
    {
      key: "manipulation",
      th: "ความผิดปกติของสมุดคำสั่ง",
      impactPct: clamp(m("liquidity") * 0.6 + regime.atr * 10),
      response: "เฝ้าติดตาม",
      detail: market.find((x) => x.key === "liquidity")?.verdict ?? "",
      severity: "LOW",
    },
    {
      key: "whale",
      th: "การเคลื่อนไหวของรายใหญ่",
      impactPct: whale === null ? 30 : clamp(Math.abs(whale - 50) * 2.2),
      response: whale !== null && whale < 45 ? "ป้องกันความเสี่ยง" : "ติดตาม",
      detail:
        whale === null ? "ไม่มีข้อมูล" : `ไม้ใหญ่ฝั่งซื้อ ${whale.toFixed(1)}%`,
      severity: "LOW",
    },
    {
      key: "news",
      th: "ผลกระทบจากข่าว",
      impactPct: m("news"),
      response: "ลดขนาดสถานะ",
      detail: market.find((x) => x.key === "news")?.verdict ?? "",
      severity: "LOW",
    },
    {
      key: "volatility",
      th: "ความผันผวนพุ่ง",
      impactPct: clamp(regime.atr * 34),
      response: regime.atr > 2 ? "ลดเลเวอเรจ" : "วิเคราะห์",
      detail: `ATR ${regime.atr.toFixed(2)}% · ${regime.volatilityTh}`,
      severity: "LOW",
    },
    {
      key: "liquidity",
      th: "สภาพคล่องหาย",
      impactPct: clamp(m("liquidity")),
      response: "จำกัดขนาดคำสั่ง",
      detail: market.find((x) => x.key === "liquidity")?.verdict ?? "",
      severity: "LOW",
    },
    {
      key: "venue",
      th: "ช่องทางซื้อขายขัดข้อง",
      impactPct: clamp(down * 30),
      response: down > 0 ? "สลับ venue" : "เฝ้าติดตาม",
      detail: down
        ? `เชื่อมต่อไม่ได้ ${down} แห่ง`
        : "ทุกแห่งตอบสนองปกติ",
      severity: "LOW",
    },
    {
      key: "swan",
      th: "เหตุการณ์ผิดปกติ (Black Swan)",
      impactPct: clamp(swans.filter((s) => s.triggered).length * 32),
      response: swans.some((s) => s.triggered) ? "เปิด WAR MODE" : "เฝ้าระวัง",
      detail: swans.filter((s) => s.triggered).map((s) => s.th).join(", ") || "ไม่พบสัญญาณ",
      severity: "LOW",
    },
  ];

  return rows
    .map((r) => ({ ...r, severity: sevOf(r.impactPct) }))
    .sort((a, b) => b.impactPct - a.impactPct);
}

export type DefenceLine = { key: string; th: string; en: string; score: number };

/** Five defensive capabilities, each measured from the live book. */
export function defenceLine(
  book: BookSummary,
  global: GlobalRisk,
  maxCorrelation: number | null,
  regime: Regime,
): { rows: DefenceLine[]; overall: number } {
  const biggest = book.notional
    ? Math.max(...book.positions.map((p) => p.notional)) / book.notional
    : 1;
  const longShare = book.longShare / 100;
  const balance = 1 - Math.abs(longShare - 0.5) * 2;

  const rows: DefenceLine[] = [
    {
      key: "diversification",
      th: "การกระจายกลยุทธ์",
      en: "Strategy Diversification",
      score: clamp(100 - (biggest - 1 / Math.max(book.positions.length, 1)) * 190),
    },
    {
      key: "hedge",
      th: "การป้องกันความเสี่ยง",
      en: "Risk Hedging",
      score: clamp(balance * 100),
    },
    {
      key: "capital",
      th: "การปกป้องเงินทุน",
      en: "Capital Protection",
      score: clamp(100 - book.marginRatio * 1.6),
    },
    {
      key: "correlation",
      th: "การคุมสหสัมพันธ์",
      en: "Correlation Control",
      score: maxCorrelation === null ? 60 : clamp(100 - maxCorrelation * 85),
    },
    {
      key: "adaptation",
      th: "การปรับตัวตามตลาด",
      en: "Market Adaptation",
      score: clamp(regime.confidence),
    },
  ];

  const overall = rows.reduce((a, r) => a + r.score, 0) / rows.length;
  return { rows, overall: Math.round(overall * (global.preservationMode ? 0.9 : 1)) };
}

export type CrisisScenario = {
  key: string;
  th: string;
  shockPct: number;
  liquidityHit: number;
  detailTh: string;
};

export const CRISIS_SCENARIOS: CrisisScenario[] = [
  { key: "crash20", th: "Bitcoin ร่วง 20%", shockPct: -20, liquidityHit: 0.35, detailTh: "ตลาดคริปโตร่วงพร้อมกันทั้งกระดาน" },
  { key: "flash", th: "Flash Crash 15% ใน 1 ชั่วโมง", shockPct: -15, liquidityHit: 0.6, detailTh: "สภาพคล่องหายชั่วขณะ สลิปเพจสูงมาก" },
  { key: "venue", th: "Exchange หลักหยุดให้บริการ", shockPct: -6, liquidityHit: 0.75, detailTh: "ไม่สามารถปิดสถานะได้ตามราคาที่ต้องการ" },
  { key: "depeg", th: "Stablecoin สูญเสียการตรึงค่า", shockPct: -12, liquidityHit: 0.8, detailTh: "มูลค่าหลักประกันลดลงและถอนเงินไม่ได้ชั่วคราว" },
  { key: "etf", th: "ETF ถูกปฏิเสธ / ข่าวกำกับดูแลเชิงลบ", shockPct: -10, liquidityHit: 0.3, detailTh: "แรงขายจากสถาบันเข้ามาพร้อมกัน" },
  { key: "rate", th: "ดอกเบี้ยขึ้นฉับพลัน", shockPct: -8, liquidityHit: 0.25, detailTh: "สินทรัพย์เสี่ยงถูกขายทั่วโลก ดอลลาร์แข็ง" },
];

export type CrisisResult = {
  scenario: CrisisScenario;
  pnl: number;
  equity: number;
  equityPct: number;
  marginRatio: number;
  liquidation: boolean;
  liquidityCover: number;
  playbookTh: string[];
  survives: boolean;
};

/**
 * Crisis simulator. Applies both a price shock and a liquidity shock, then
 * checks whether the remaining cash can still cover an orderly exit — the part
 * a plain stress test usually misses.
 */
export function simulateCrisis(book: BookSummary, s: CrisisScenario): CrisisResult {
  const pnl = book.positions.reduce((a, p) => {
    const dir = p.side === "LONG" ? 1 : -1;
    return a + (p.notional * s.shockPct * dir) / 100;
  }, 0);

  const equity = book.equity + pnl;
  const marginRatio = equity > 0 ? (book.marginUsed / equity) * 100 : 999;
  const liquidation = marginRatio > 80 || equity <= book.marginUsed * 0.5;

  // Exiting into a thin book costs more than the quoted spread.
  const exitCost = book.notional * 0.001 * (1 + s.liquidityHit * 8);
  const cashAfter = Math.max(0, equity - book.marginUsed);
  const liquidityCover = exitCost > 0 ? cashAfter / exitCost : 99;

  const playbookTh: string[] = [];
  if (liquidation) {
    playbookTh.push("ปิดสถานะที่เสี่ยงสูงทันทีก่อนถึงระดับบังคับปิด");
  }
  if (marginRatio > 45) {
    playbookTh.push(`ลดขนาดสถานะลงจนมาร์จิ้นกลับต่ำกว่า 45% (ขณะนี้ ${marginRatio.toFixed(0)}%)`);
  }
  if (liquidityCover < 2) {
    playbookTh.push("เพิ่มเงินสดสำรองก่อน เพราะสภาพคล่องไม่พอสำหรับการปิดสถานะแบบเป็นระเบียบ");
  }
  playbookTh.push(
    s.liquidityHit > 0.5
      ? "ใช้คำสั่ง Limit แบบทยอยแทน Market เพื่อลดสลิปเพจ"
      : "เปิดสถานะป้องกันความเสี่ยงสวนทิศทางหลักบางส่วน",
  );
  playbookTh.push("เปิด WAR MODE และแจ้งเตือนผู้บริหารทันที");

  return {
    scenario: s,
    pnl,
    equity,
    equityPct: book.equity ? (pnl / book.equity) * 100 : 0,
    marginRatio,
    liquidation,
    liquidityCover,
    playbookTh,
    survives: !liquidation && liquidityCover >= 1,
  };
}

export type Dialogue = { ai: string; color: string; textTh: string };

/**
 * The AIs talking to each other. Every line quotes a number the system
 * actually measured, so the conversation doubles as an audit trail.
 */
export function aiDialogue(
  regime: Regime,
  ctx: MarketContext,
  global: GlobalRisk,
  decision: MasterDecision | null,
  symbol: string,
): Dialogue[] {
  const base = symbol.replace(/USDT$/, "");

  return [
    {
      ai: "Trend AI",
      color: "#10e08a",
      textTh: `แนวโน้มหลักของ ${base} เป็น${regime.biasTh} · RSI ${regime.rsi.toFixed(1)} · สภาวะ${regime.labelTh}`,
    },
    {
      ai: "Whale AI",
      color: "#a78bfa",
      textTh:
        ctx.whaleBuyShare === null
          ? "ยังไม่มีข้อมูลไม้ใหญ่ในรอบนี้"
          : ctx.whaleBuyShare > 55
            ? `พบการสะสมของรายใหญ่ · ไม้ใหญ่ฝั่งซื้อ ${ctx.whaleBuyShare.toFixed(1)}%`
            : `รายใหญ่เอียงไปฝั่งขาย · ฝั่งซื้อเหลือ ${ctx.whaleBuyShare.toFixed(1)}%`,
    },
    {
      ai: "Futures AI",
      color: "#22d3ee",
      textTh:
        ctx.funding === null
          ? "ไม่มีข้อมูลสัญญาฟิวเจอร์ส"
          : `ค่าธรรมเนียม ${ctx.funding.toFixed(4)}% · สัญญาคงค้าง ${ctx.oiChangePct === null ? "ไม่ทราบ" : `${ctx.oiChangePct >= 0 ? "+" : ""}${ctx.oiChangePct.toFixed(2)}% ใน 1 ชม.`}`,
    },
    {
      ai: "Risk AI",
      color: "#fb7185",
      textTh: `คะแนนความเสี่ยงรวม ${global.score}/100 · ${global.preservationMode ? "แนะนำเข้าโหมดรักษาเงินทุน" : "ยังอยู่ในกรอบที่รับได้"}`,
    },
    {
      ai: "Master AI",
      color: "#00d4ff",
      textTh: decision
        ? decision.action === "WAIT"
          ? `หลักฐาน ${decision.supporting} หนุน / ${decision.against} ค้าน ยังไม่พอ ผมขอรอ`
          : `อนุมัติ ${decision.action} ที่ความมั่นใจ ${decision.confidence}% ขนาด ${decision.positionSizePct}% ของพอร์ต`
        : "รอข้อมูลครบก่อนสรุป",
    },
  ];
}

export type Incident = {
  key: string;
  th: string;
  severity: "info" | "warn" | "critical";
  detail: string;
  active: boolean;
};

/** Incident log — only conditions the platform can actually observe. */
export function incidents(
  exchanges: ExchangeHealth[],
  regime: Regime,
  ctx: MarketContext,
  connected: boolean,
  latency: number | null,
): Incident[] {
  const down = exchanges.filter((e) => !e.online);
  const slow = exchanges.filter((e) => e.online && e.latency > 1200);

  return [
    {
      key: "feed",
      th: "ฟีดข้อมูลตลาดขาดการเชื่อมต่อ",
      severity: "critical",
      detail: connected ? "ฟีดทำงานปกติ" : "ไม่สามารถดึงราคาได้",
      active: !connected,
    },
    {
      key: "venue",
      th: "Exchange เชื่อมต่อไม่ได้",
      severity: "critical",
      detail: down.length ? down.map((d) => d.name).join(", ") : "ทุกแห่งปกติ",
      active: down.length > 0,
    },
    {
      key: "latency",
      th: "ความหน่วงสูงผิดปกติ",
      severity: "warn",
      detail: slow.length
        ? `${slow.map((s) => `${s.name} ${s.latency}ms`).join(" · ")}`
        : latency !== null
          ? `API ภายใน ${latency} ms`
          : "ไม่มีข้อมูล",
      active: slow.length > 0 || (latency !== null && latency > 1500),
    },
    {
      key: "funding",
      th: "ค่าธรรมเนียมสัญญาผิดปกติ",
      severity: "warn",
      detail:
        ctx.funding === null
          ? "ไม่มีข้อมูล"
          : `${ctx.funding.toFixed(4)}% · เกณฑ์เตือน 0.05%`,
      active: ctx.funding !== null && Math.abs(ctx.funding) > 0.05,
    },
    {
      key: "volatility",
      th: "ความผันผวนพุ่งเกินเกณฑ์",
      severity: "warn",
      detail: `ATR ${regime.atr.toFixed(2)}% · เกณฑ์เตือน 2%`,
      active: regime.atr > 2,
    },
    {
      key: "oi",
      th: "สัญญาคงค้างเปลี่ยนแปลงรุนแรง",
      severity: "info",
      detail:
        ctx.oiChangePct === null
          ? "ไม่มีข้อมูล"
          : `${ctx.oiChangePct >= 0 ? "+" : ""}${ctx.oiChangePct.toFixed(2)}% ใน 1 ชม.`,
      active: ctx.oiChangePct !== null && Math.abs(ctx.oiChangePct) > 3,
    },
  ];
}

export type MissionObjective = {
  primaryTh: string;
  secondaryTh: string;
  avoidTh: string;
  targetTh: string;
  reasonTh: string;
};

export function missionObjective(
  global: GlobalRisk,
  regime: Regime,
  book: BookSummary,
  warMode: boolean,
): MissionObjective {
  if (warMode) {
    return {
      primaryTh: "รักษาเงินทุนเป็นอันดับแรก",
      secondaryTh: "ลดความเสี่ยงลงจนกว่าสถานการณ์จะคลี่คลาย",
      avoidTh: "เปิดสถานะใหม่ทุกประเภท",
      targetTh: "จำกัดการขาดทุนไม่เกิน 1% ของพอร์ต",
      reasonTh: `WAR MODE ทำงานอยู่ · ${global.preservationReasonTh}`,
    };
  }

  const defensive = global.band !== "safe" || global.preservationMode;

  return {
    primaryTh: defensive ? "ปกป้องเงินทุน" : "เติบโตของเงินทุน",
    secondaryTh: defensive ? "เลือกเฉพาะสัญญาณคุณภาพสูง" : `เทรดตาม${regime.labelTh}`,
    avoidTh:
      regime.volatility === "High"
        ? "ช่วงที่ความผันผวนพุ่งและข่าวสำคัญ"
        : "คู่ที่มีสหสัมพันธ์สูงกับสถานะเดิม",
    targetTh: defensive ? "รักษาผลตอบแทนให้เป็นบวก" : "เป้าหมายรายวัน 1% ของพอร์ต",
    reasonTh: `คะแนนความเสี่ยงรวม ${global.score}/100 · ใช้มาร์จิ้น ${book.marginRatio.toFixed(1)}% · สภาวะตลาด${regime.labelTh}`,
  };
}

export type Tactic = { th: string; reasonTh: string; stance: "เปลี่ยน" | "ลด" | "เพิ่ม" | "คงไว้" };

export function tactics(
  global: GlobalRisk,
  regime: Regime,
  book: BookSummary,
  threatRows: Threat[],
  warMode: boolean,
): Tactic[] {
  const out: Tactic[] = [];
  const worst = threatRows[0];

  if (warMode || global.preservationMode) {
    out.push({
      th: "เปลี่ยนไปใช้กลยุทธ์เชิงรับ",
      reasonTh: global.preservationReasonTh,
      stance: "เปลี่ยน",
    });
  }

  if (regime.atr > 1.5) {
    out.push({
      th: "ลดเลเวอเรจลงตามความผันผวน",
      reasonTh: `ATR ${regime.atr.toFixed(2)}% สูงกว่าเกณฑ์ 1.5%`,
      stance: "ลด",
    });
  }

  if (book.marginRatio > 40) {
    out.push({
      th: "เพิ่มสัดส่วนเงินสด",
      reasonTh: `ใช้มาร์จิ้นไปแล้ว ${book.marginRatio.toFixed(1)}%`,
      stance: "เพิ่ม",
    });
  }

  if (worst && worst.impactPct > 50) {
    out.push({
      th: `รับมือภัยคุกคาม: ${worst.th}`,
      reasonTh: `${worst.detail} · ระดับ ${worst.severity}`,
      stance: "เปลี่ยน",
    });
  }

  if (Math.abs(book.longShare - 50) > 30) {
    out.push({
      th: "เปิดสถานะป้องกันความเสี่ยงให้สมดุล",
      reasonTh: `พอร์ตเอียงไปฝั่ง ${book.longShare > 50 ? "Long" : "Short"} ที่ ${book.longShare.toFixed(0)}%`,
      stance: "เพิ่ม",
    });
  }

  if (out.length === 0) {
    out.push({
      th: "คงยุทธวิธีเดิม",
      reasonTh: `ทุกตัวชี้วัดอยู่ในกรอบ · คะแนนความเสี่ยง ${global.score}/100`,
      stance: "คงไว้",
    });
  }

  return out;
}

export type WarModeAction = { th: string; done: boolean };

export function warModeActions(active: boolean, book: BookSummary): WarModeAction[] {
  return [
    { th: "ลดเลเวอเรจลงเหลือไม่เกิน 5X", done: active },
    { th: `เพิ่มเงินสดสำรอง (ปัจจุบันใช้มาร์จิ้น ${book.marginRatio.toFixed(1)}%)`, done: active },
    { th: "เปิดสถานะป้องกันความเสี่ยง", done: active },
    { th: "จำกัดจำนวนสถานะพร้อมกันเหลือ 2 รายการ", done: active },
    { th: "เพิ่มความถี่การตรวจสอบความเสี่ยง", done: active },
    { th: "แจ้งเตือนผู้บริหารทันที", done: active },
  ];
}

/** Aggregate the world into one line per asset class for the status strip. */
export function worldStatus(quotes: Map<string, Quote>) {
  const list = [...quotes.values()];
  const avg = list.length ? list.reduce((a, q) => a + q.changePct, 0) / list.length : 0;
  const up = list.filter((q) => q.changePct > 0).length;

  return {
    cryptoBias: avg,
    breadth: list.length ? (up / list.length) * 100 : 0,
    total: list.length,
  };
}
