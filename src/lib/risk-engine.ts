import type { Regime } from "./analytics";
import type { BookSummary } from "./book";
import type { MarketContext } from "./decision";
import type { ExchangeHealth } from "./market-context";
import type { Quote } from "./types";

const clamp = (v: number) => Math.max(0, Math.min(100, v));

export type RiskBand = "safe" | "watch" | "reduce" | "stop";

export function bandOf(score: number): RiskBand {
  if (score <= 30) return "safe";
  if (score <= 60) return "watch";
  if (score <= 80) return "reduce";
  return "stop";
}

export const BAND_META: Record<RiskBand, { th: string; en: string; color: string }> = {
  safe: { th: "ปลอดภัย", en: "LOW RISK", color: "#14e2a0" },
  watch: { th: "เริ่มเสี่ยง", en: "ELEVATED", color: "#ffb020" },
  reduce: { th: "ควรลดสถานะ", en: "HIGH RISK", color: "#ff8f3d" },
  stop: { th: "ควรหยุดเทรด", en: "CRITICAL", color: "#ff4a68" },
};

export type MarketRisk = {
  key: string;
  th: string;
  en: string;
  score: number;
  verdict: string;
};

/** Eight readings of market conditions, each from a live feed. */
export function marketRisk(
  regime: Regime,
  ctx: MarketContext,
  quote: Quote | undefined,
  exchanges: ExchangeHealth[],
  newsNegative: number,
  fearGreed: number | null,
): MarketRisk[] {
  const down = exchanges.filter((e) => !e.online).length;
  const slow = exchanges.filter((e) => e.online && e.latency > 1500).length;

  return [
    {
      key: "volatility",
      th: "ความผันผวน",
      en: "Volatility",
      score: clamp(regime.atr * 34),
      verdict: `ATR ${regime.atr.toFixed(2)}% · ${regime.volatilityTh}`,
    },
    {
      key: "funding",
      th: "ค่าธรรมเนียมสัญญา",
      en: "Funding",
      score: ctx.funding === null ? 40 : clamp(Math.abs(ctx.funding) * 850),
      verdict:
        ctx.funding === null
          ? "ไม่มีข้อมูล"
          : Math.abs(ctx.funding) < 0.005
            ? "เป็นกลาง"
            : ctx.funding > 0
              ? "ฝั่ง Long แออัด"
              : "ฝั่ง Short แออัด",
    },
    {
      key: "liquidity",
      th: "สภาพคล่อง",
      en: "Liquidity",
      score: quote ? clamp(70 - Math.log10(Math.max(quote.quoteVolume, 1)) * 6) : 50,
      verdict: quote && quote.quoteVolume > 1e8 ? "หนาแน่นดี" : "บางกว่าปกติ",
    },
    {
      key: "oi",
      th: "สัญญาคงค้าง",
      en: "Open Interest",
      score: ctx.oiChangePct === null ? 40 : clamp(50 + ctx.oiChangePct * 14),
      verdict:
        ctx.oiChangePct === null
          ? "ไม่มีข้อมูล"
          : ctx.oiChangePct > 0.3
            ? "เพิ่มขึ้น — เงินไหลเข้า"
            : ctx.oiChangePct < -0.3
              ? "ลดลง — กำลังปิดสถานะ"
              : "ทรงตัว",
    },
    {
      key: "news",
      th: "ข่าว",
      en: "News",
      score: clamp(20 + newsNegative * 15),
      verdict: newsNegative ? `ข่าวเชิงลบ ${newsNegative} รายการ` : "ไม่มีข่าวลบเด่น",
    },
    {
      key: "macro",
      th: "มหภาค",
      en: "Macro",
      score: fearGreed === null ? 45 : clamp(100 - fearGreed),
      verdict: fearGreed === null ? "ไม่มีข้อมูล" : `Fear & Greed ${fearGreed}`,
    },
    {
      key: "exchange",
      th: "ความเสี่ยง Exchange",
      en: "Exchange",
      score: clamp(down * 24 + slow * 12),
      verdict: down ? `เชื่อมต่อไม่ได้ ${down} แห่ง` : slow ? `หน่วงสูง ${slow} แห่ง` : "ทุกแห่งปกติ",
    },
    {
      key: "flow",
      th: "แรงซื้อรายใหญ่",
      en: "Whale Flow",
      score:
        ctx.whaleBuyShare === null ? 45 : clamp(100 - ctx.whaleBuyShare * 1.4),
      verdict:
        ctx.whaleBuyShare === null
          ? "ไม่มีข้อมูล"
          : ctx.whaleBuyShare > 55
            ? "รายใหญ่ฝั่งซื้อ"
            : ctx.whaleBuyShare < 45
              ? "รายใหญ่ฝั่งขาย"
              : "สมดุล",
    },
  ];
}

export type PositionRisk = {
  symbol: string;
  side: "LONG" | "SHORT";
  notional: number;
  liqPrice: number;
  liqDistancePct: number;
  score: number;
  level: "ต่ำ" | "ปานกลาง" | "สูง";
  recommendation: string;
};

/**
 * Per-position risk. Liquidation price comes from the configured leverage and
 * the entry, and the distance to it is the single most useful number here.
 */
export function positionRisk(book: BookSummary, regime: Regime): PositionRisk[] {
  return book.positions.map((p) => {
    const dir = p.side === "LONG" ? 1 : -1;
    // Maintenance margin ~0.5% on top of the initial margin band.
    const liqPrice = p.entry * (1 - dir * (1 / book.configuredLeverage - 0.005));
    const liqDistancePct = p.price ? (Math.abs(p.price - liqPrice) / p.price) * 100 : 0;

    const concentration = book.notional ? (p.notional / book.notional) * 100 : 0;
    const score = clamp(
      (1 / Math.max(liqDistancePct, 0.5)) * 220 +
        regime.atr * 9 +
        Math.max(0, concentration - 25) * 0.9 +
        Math.max(0, -p.pnlPct) * 4,
    );

    const level = score >= 67 ? "สูง" : score >= 34 ? "ปานกลาง" : "ต่ำ";
    const recommendation =
      score >= 67
        ? "ปิดบางส่วน 30%"
        : score >= 34
          ? "ลดขนาดหรือขยับ Stop"
          : p.pnlPct > 2
            ? "ทยอยทำกำไร"
            : "ถือต่อ";

    return {
      symbol: p.symbol,
      side: p.side,
      notional: p.notional,
      liqPrice,
      liqDistancePct,
      score,
      level,
      recommendation,
    };
  });
}

export type BlackSwan = {
  key: string;
  th: string;
  triggered: boolean;
  detail: string;
};

/**
 * Black-swan watch. Every check reads a live feed — the stablecoin peg comes
 * from the real USDC/USDT book, not a placeholder.
 */
export function blackSwan(
  regime: Regime,
  ctx: MarketContext,
  quotes: Map<string, Quote>,
  exchanges: ExchangeHealth[],
  usdcPeg: number | null,
): BlackSwan[] {
  const btc = quotes.get("BTCUSDT");
  const worstMove = Math.min(...[...quotes.values()].map((q) => q.changePct), 0);
  const down = exchanges.filter((e) => !e.online);

  return [
    {
      key: "flash",
      th: "Flash Crash",
      triggered: worstMove < -12 || (btc?.changePct ?? 0) < -8,
      detail:
        worstMove < -12
          ? `มีสินทรัพย์ร่วง ${worstMove.toFixed(1)}% ใน 24 ชม.`
          : `ร่วงแรงสุด ${worstMove.toFixed(1)}% — ยังไม่ถึงเกณฑ์ -12%`,
    },
    {
      key: "exchange",
      th: "Exchange ล่ม",
      triggered: down.length >= 2,
      detail: down.length
        ? `เชื่อมต่อไม่ได้: ${down.map((d) => d.name).join(", ")}`
        : "ทุก exchange ตอบสนองปกติ",
    },
    {
      key: "depeg",
      th: "Stablecoin หลุดตรึง",
      triggered: usdcPeg !== null && Math.abs(usdcPeg - 1) > 0.005,
      detail:
        usdcPeg === null
          ? "ไม่มีข้อมูลราคา USDC/USDT"
          : `USDC/USDT = ${usdcPeg.toFixed(4)} (เบี่ยง ${((usdcPeg - 1) * 100).toFixed(2)}%)`,
    },
    {
      key: "volatility",
      th: "ความผันผวนผิดปกติ",
      triggered: regime.atr > 3,
      detail: `ATR ${regime.atr.toFixed(2)}% — เกณฑ์เตือนที่ 3%`,
    },
    {
      key: "funding",
      th: "Funding พุ่งผิดปกติ",
      triggered: ctx.funding !== null && Math.abs(ctx.funding) > 0.05,
      detail:
        ctx.funding === null
          ? "ไม่มีข้อมูล"
          : `${ctx.funding.toFixed(4)}% — เกณฑ์เตือนที่ 0.05%`,
    },
    {
      key: "dump",
      th: "รายใหญ่เทขาย",
      triggered: ctx.whaleBuyShare !== null && ctx.whaleBuyShare < 25,
      detail:
        ctx.whaleBuyShare === null
          ? "ไม่มีข้อมูล"
          : `ไม้ใหญ่ฝั่งซื้อเหลือ ${ctx.whaleBuyShare.toFixed(1)}% — เกณฑ์ 25%`,
    },
  ];
}

export type CommitteeVote = {
  id: string;
  name: string;
  th: string;
  vote: "APPROVE" | "REDUCE" | "REJECT";
  score: number;
  reason: string;
};

/**
 * Risk Committee. Ten specialists each read one input and vote. The order can
 * only proceed on a clear majority — a single REJECT from the guardian blocks
 * it outright, mirroring how a real risk desk operates.
 */
export function committee(
  book: BookSummary,
  market: MarketRisk[],
  positions: PositionRisk[],
  maxCorrelation: number | null,
  swans: BlackSwan[],
  drawdown: number,
): { votes: CommitteeVote[]; verdict: "APPROVED" | "REDUCED" | "BLOCKED"; summaryTh: string } {
  const m = (k: string) => market.find((x) => x.key === k)?.score ?? 50;
  const worstPos = Math.max(...positions.map((p) => p.score), 0);
  const swanHit = swans.filter((s) => s.triggered);

  const grade = (score: number): CommitteeVote["vote"] =>
    score >= 70 ? "REJECT" : score >= 45 ? "REDUCE" : "APPROVE";

  const raw: [string, string, string, number, string][] = [
    ["exposure", "Exposure AI", "ความเสี่ยงรวม", clamp(book.marginRatio * 1.7), `Margin ${book.marginRatio.toFixed(1)}%`],
    ["margin", "Margin AI", "มาร์จิ้น", clamp(book.leverage * 18), `Leverage ${book.leverage.toFixed(2)}x`],
    ["correlation", "Correlation AI", "สหสัมพันธ์", maxCorrelation === null ? 45 : clamp(maxCorrelation * 92), maxCorrelation === null ? "ไม่มีข้อมูล" : `สูงสุด ${maxCorrelation.toFixed(2)}`],
    ["volatility", "Volatility AI", "ความผันผวน", m("volatility"), market.find((x) => x.key === "volatility")?.verdict ?? ""],
    ["funding", "Funding AI", "ค่าธรรมเนียม", m("funding"), market.find((x) => x.key === "funding")?.verdict ?? ""],
    ["news", "News Risk AI", "ข่าว", m("news"), market.find((x) => x.key === "news")?.verdict ?? ""],
    ["macro", "Macro Risk AI", "มหภาค", m("macro"), market.find((x) => x.key === "macro")?.verdict ?? ""],
    ["exchange", "Exchange Risk AI", "ตลาดซื้อขาย", m("exchange"), market.find((x) => x.key === "exchange")?.verdict ?? ""],
    ["swan", "Black Swan AI", "เหตุการณ์ผิดปกติ", swanHit.length ? 85 : 15, swanHit.length ? `พบ ${swanHit.length} สัญญาณ` : "ไม่พบสัญญาณผิดปกติ"],
    ["guardian", "Guardian AI", "ผู้พิทักษ์", clamp(Math.max(worstPos * 0.6, drawdown * 9)), `Drawdown ${drawdown.toFixed(2)}% · สถานะเสี่ยงสุด ${worstPos.toFixed(0)}`],
  ];

  const votes: CommitteeVote[] = raw.map(([id, name, th, score, reason]) => ({
    id,
    name,
    th,
    score,
    reason,
    vote: grade(score),
  }));

  const rejects = votes.filter((v) => v.vote === "REJECT");
  const reduces = votes.filter((v) => v.vote === "REDUCE");
  const guardian = votes.find((v) => v.id === "guardian")!;

  const verdict: "APPROVED" | "REDUCED" | "BLOCKED" =
    rejects.length >= 2 || guardian.vote === "REJECT"
      ? "BLOCKED"
      : rejects.length === 1 || reduces.length >= 3
        ? "REDUCED"
        : "APPROVED";

  const summaryTh =
    verdict === "BLOCKED"
      ? `ปฏิเสธคำสั่ง — ${rejects.map((r) => r.name).join(", ")} ลงมติคัดค้าน`
      : verdict === "REDUCED"
        ? `อนุมัติแบบลดขนาด — มี ${reduces.length} เสียงขอให้ลดความเสี่ยง`
        : `อนุมัติ — ทั้ง ${votes.length} เสียงอยู่ในเกณฑ์ที่ยอมรับได้`;

  return { votes, verdict, summaryTh };
}

export type DynamicLeverage = {
  suggested: number;
  min: number;
  max: number;
  reasonTh: string;
};

/** Leverage the engine would actually allow right now, given conditions. */
export function dynamicLeverage(
  regime: Regime,
  market: MarketRisk[],
  swans: BlackSwan[],
  cap: number,
): DynamicLeverage {
  const swanHit = swans.some((s) => s.triggered);
  const newsRisk = market.find((x) => x.key === "news")?.score ?? 20;

  let suggested = cap;
  let reasonTh = "ตลาดปกติ — ใช้เพดานที่ตั้งไว้ได้เต็มที่";

  if (swanHit) {
    suggested = 0;
    reasonTh = "พบสัญญาณเหตุการณ์ผิดปกติ — หยุดเปิดสถานะใหม่";
  } else if (regime.atr > 2) {
    suggested = Math.max(3, Math.round(cap * 0.33));
    reasonTh = `ความผันผวนสูง (ATR ${regime.atr.toFixed(2)}%) — ลดเลเวอเรจลงหนึ่งในสาม`;
  } else if (newsRisk > 55) {
    suggested = Math.max(5, Math.round(cap * 0.45));
    reasonTh = "มีข่าวเชิงลบหลายรายการ — ลดเลเวอเรจระหว่างรอความชัดเจน";
  } else if (regime.atr > 1.1) {
    suggested = Math.max(5, Math.round(cap * 0.6));
    reasonTh = "ความผันผวนปานกลาง — ใช้เลเวอเรจไม่เต็มเพดาน";
  }

  return { suggested, min: 3, max: cap, reasonTh };
}

export type GlobalRisk = {
  score: number;
  band: RiskBand;
  parts: { th: string; en: string; value: number; weight: number }[];
  preservationMode: boolean;
  preservationReasonTh: string;
};

/**
 * The single number the whole page hangs off, plus Capital Preservation Mode —
 * when conditions turn hostile the engine stops trying to trade and starts
 * protecting capital instead.
 */
export function globalRisk(
  book: BookSummary,
  market: MarketRisk[],
  positions: PositionRisk[],
  maxCorrelation: number | null,
  swans: BlackSwan[],
  drawdown: number,
): GlobalRisk {
  const avgMarket = market.reduce((a, m) => a + m.score, 0) / Math.max(market.length, 1);
  const worstPos = Math.max(...positions.map((p) => p.score), 0);
  const swanHit = swans.filter((s) => s.triggered).length;

  const parts = [
    { th: "ความเสี่ยงตลาด", en: "Market", value: avgMarket, weight: 0.26 },
    { th: "ความเสี่ยงพอร์ต", en: "Portfolio", value: clamp(book.marginRatio * 1.7), weight: 0.2 },
    { th: "สถานะที่เสี่ยงสุด", en: "Position", value: worstPos, weight: 0.16 },
    { th: "สหสัมพันธ์", en: "Correlation", value: maxCorrelation === null ? 45 : clamp(maxCorrelation * 92), weight: 0.14 },
    { th: "Drawdown", en: "Drawdown", value: clamp(drawdown * 9), weight: 0.12 },
    { th: "เลเวอเรจ", en: "Leverage", value: clamp(book.leverage * 18), weight: 0.12 },
  ];

  const base = parts.reduce((a, p) => a + p.value * p.weight, 0);
  // A confirmed black-swan signal cannot be averaged away.
  const score = Math.round(clamp(swanHit ? Math.max(base, 72 + swanHit * 6) : base));

  const preservation =
    score > 60 || swanHit > 0 || drawdown > 6 || book.dayPnlPct < -2;

  const preservationReasonTh = swanHit
    ? "ตรวจพบสัญญาณเหตุการณ์ผิดปกติ"
    : drawdown > 6
      ? `Drawdown ${drawdown.toFixed(1)}% เกินเกณฑ์ 6%`
      : book.dayPnlPct < -2
        ? `ขาดทุนวันนี้ ${book.dayPnlPct.toFixed(2)}% เกินเพดาน 2%`
        : score > 60
          ? `คะแนนความเสี่ยงรวม ${score} เกิน 60`
          : "เงื่อนไขปกติ — ระบบเทรดตามกลยุทธ์ได้";

  return {
    score,
    band: bandOf(score),
    parts,
    preservationMode: preservation,
    preservationReasonTh,
  };
}

export type RiskRecommendation = {
  id: string;
  th: string;
  reason: string;
  severity: "info" | "warn" | "critical";
};

export function riskRecommendations(
  global: GlobalRisk,
  positions: PositionRisk[],
  lev: DynamicLeverage,
  book: BookSummary,
  maxCorrelation: number | null,
  swans: BlackSwan[],
): RiskRecommendation[] {
  const out: RiskRecommendation[] = [];

  for (const p of positions.filter((x) => x.score >= 60).slice(0, 2)) {
    out.push({
      id: `pos-${p.symbol}`,
      th: `${p.recommendation} · ${p.symbol.replace("USDT", "")}`,
      reason: `คะแนนเสี่ยง ${p.score.toFixed(0)} · ห่างจุดบังคับปิด ${p.liqDistancePct.toFixed(1)}%`,
      severity: p.score >= 75 ? "critical" : "warn",
    });
  }

  if (lev.suggested < lev.max) {
    out.push({
      id: "lev",
      th:
        lev.suggested === 0
          ? "หยุดเปิดสถานะใหม่ทั้งหมด"
          : `ลดเลเวอเรจจาก ${lev.max}X เหลือ ${lev.suggested}X`,
      reason: lev.reasonTh,
      severity: lev.suggested === 0 ? "critical" : "warn",
    });
  }

  if (maxCorrelation !== null && maxCorrelation > 0.85) {
    out.push({
      id: "corr",
      th: "ยังไม่ควรเปิดสถานะเพิ่มในคู่ที่สัมพันธ์กันสูง",
      reason: `ค่าสหสัมพันธ์สูงสุดในพอร์ตอยู่ที่ ${maxCorrelation.toFixed(2)}`,
      severity: "warn",
    });
  }

  if (book.marginRatio > 40) {
    out.push({
      id: "margin",
      th: "เพิ่มสัดส่วนเงินสดอีกอย่างน้อย 5%",
      reason: `ใช้มาร์จิ้นไปแล้ว ${book.marginRatio.toFixed(1)}%`,
      severity: "warn",
    });
  }

  for (const s of swans.filter((x) => x.triggered)) {
    out.push({
      id: `swan-${s.key}`,
      th: `เฝ้าระวังเหตุการณ์: ${s.th}`,
      reason: s.detail,
      severity: "critical",
    });
  }

  if (out.length === 0) {
    out.push({
      id: "ok",
      th: "ไม่ต้องปรับความเสี่ยงเพิ่มเติม",
      reason: `คะแนนรวม ${global.score}/100 อยู่ในโซน${BAND_META[global.band].th}`,
      severity: "info",
    });
  }

  return out;
}
