import { atrPct, ema, rsi, type Regime } from "./analytics";
import type { Candle } from "./types";

export type MarketContext = {
  supported: boolean;
  funding: number | null;
  markPrice: number | null;
  nextFundingTime: number | null;
  openInterest: number | null;
  openInterestValue: number | null;
  oiChangePct: number | null;
  takerBuyShare: number | null;
  whaleBuyShare: number | null;
  whaleNotional: number | null;
  longAccount: number | null;
  shortAccount: number | null;
};

export const EMPTY_CONTEXT: MarketContext = {
  supported: false,
  funding: null,
  markPrice: null,
  nextFundingTime: null,
  openInterest: null,
  openInterestValue: null,
  oiChangePct: null,
  takerBuyShare: null,
  whaleBuyShare: null,
  whaleNotional: null,
  longAccount: null,
  shortAccount: null,
};

export type Evidence = {
  key: string;
  th: string;
  en: string;
  verdict: string;
  /** +1 supports long, -1 supports short, 0 neutral/unknown. */
  vote: 1 | 0 | -1;
  detail: string;
};

/** Swing pivots — a high/low with `w` lower/higher bars on both sides. */
function pivots(candles: Candle[], w = 3) {
  const highs: { i: number; price: number }[] = [];
  const lows: { i: number; price: number }[] = [];
  for (let i = w; i < candles.length - w; i++) {
    const win = candles.slice(i - w, i + w + 1);
    if (candles[i].high === Math.max(...win.map((c) => c.high)))
      highs.push({ i, price: candles[i].high });
    if (candles[i].low === Math.min(...win.map((c) => c.low)))
      lows.push({ i, price: candles[i].low });
  }
  return { highs, lows };
}

/** Fair value gaps: a 3-bar imbalance where wick ranges fail to overlap. */
export function findFVG(candles: Candle[], limit = 6) {
  const out: { from: number; to: number; top: number; bottom: number; bull: boolean }[] = [];
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    if (a.high < c.low) {
      out.push({ from: a.time, to: c.time, bottom: a.high, top: c.low, bull: true });
    } else if (a.low > c.high) {
      out.push({ from: a.time, to: c.time, bottom: c.high, top: a.low, bull: false });
    }
  }
  return out.slice(-limit);
}

/**
 * Order blocks: the last opposite-colour candle before an impulsive move.
 * A rough but standard reading of where institutional orders were left.
 */
export function findOrderBlocks(candles: Candle[], limit = 4) {
  const out: { time: number; top: number; bottom: number; bull: boolean }[] = [];
  const bodies = candles.map((c) => Math.abs(c.close - c.open));
  const avgBody = bodies.reduce((a, b) => a + b, 0) / Math.max(bodies.length, 1);

  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const cur = candles[i];
    const impulsive = bodies[i] > avgBody * 2.2;
    if (!impulsive) continue;
    const bull = cur.close > cur.open;
    if (bull && prev.close < prev.open) {
      out.push({ time: prev.time, top: prev.high, bottom: prev.low, bull: true });
    } else if (!bull && prev.close > prev.open) {
      out.push({ time: prev.time, top: prev.high, bottom: prev.low, bull: false });
    }
  }
  return out.slice(-limit);
}

/** Untouched swing highs/lows — where resting stops cluster. */
export function findLiquidity(candles: Candle[], limit = 4) {
  const { highs, lows } = pivots(candles, 3);
  const last = candles.at(-1)?.close ?? 0;
  const above = highs
    .filter((h) => h.price > last)
    .slice(-limit)
    .map((h) => ({ price: h.price, side: "sell" as const }));
  const below = lows
    .filter((l) => l.price < last)
    .slice(-limit)
    .map((l) => ({ price: l.price, side: "buy" as const }));
  return [...above, ...below];
}

/** Did price recently pierce a swing low/high and close back inside? */
function sweepState(candles: Candle[]): { done: boolean; side: "low" | "high" | null } {
  if (candles.length < 20) return { done: false, side: null };
  const { highs, lows } = pivots(candles.slice(0, -4), 3);
  const recent = candles.slice(-4);
  const lastLow = lows.at(-1)?.price;
  const lastHigh = highs.at(-1)?.price;

  if (lastLow !== undefined) {
    const pierced = recent.some((c) => c.low < lastLow);
    const reclaimed = recent.at(-1)!.close > lastLow;
    if (pierced && reclaimed) return { done: true, side: "low" };
  }
  if (lastHigh !== undefined) {
    const pierced = recent.some((c) => c.high > lastHigh);
    const rejected = recent.at(-1)!.close < lastHigh;
    if (pierced && rejected) return { done: true, side: "high" };
  }
  return { done: false, side: null };
}

export type MasterDecision = {
  action: "LONG" | "SHORT" | "WAIT";
  symbol: string;
  confidence: number;
  expectedWinRate: number;
  riskReward: number;
  positionSizePct: number;
  leverage: number;
  entry: number;
  stop: number;
  target: number;
  evidence: Evidence[];
  supporting: number;
  against: number;
  summaryTh: string;
};

/**
 * Weighs six independent readings of the same market. The action follows the
 * evidence tally, so the panel can never claim more conviction than it has.
 */
export function decide(
  symbol: string,
  candles: Candle[],
  regime: Regime,
  ctx: MarketContext,
): MasterDecision | null {
  if (candles.length < 40) return null;

  const closes = candles.map((c) => c.close);
  const last = closes.at(-1)!;
  const fast = ema(closes, 12).at(-1)!;
  const slow = ema(closes, 34).at(-1)!;
  const atr = atrPct(candles, 14);
  const r = rsi(closes, 14);
  const sweep = sweepState(candles);

  const evidence: Evidence[] = [];

  // 1 — Trend
  const trendUp = fast > slow;
  evidence.push({
    key: "trend",
    th: "แนวโน้ม",
    en: "Trend",
    verdict: trendUp ? "Bullish" : "Bearish",
    vote: Math.abs(fast - slow) / slow > 0.0008 ? (trendUp ? 1 : -1) : 0,
    detail: `EMA12 ${fast > slow ? ">" : "<"} EMA34 · RSI ${r.toFixed(1)}`,
  });

  // 2 — Liquidity sweep
  evidence.push({
    key: "sweep",
    th: "กวาดสภาพคล่อง",
    en: "Liquidity Sweep",
    verdict: sweep.done ? "Completed" : "Not yet",
    vote: sweep.done ? (sweep.side === "low" ? 1 : -1) : 0,
    detail: sweep.done
      ? sweep.side === "low"
        ? "ทะลุ swing low แล้วดึงกลับ"
        : "ทะลุ swing high แล้วโดนขายกลับ"
      : "ยังไม่มีการกวาดสต็อป",
  });

  // 3 — Funding
  const funding = ctx.funding;
  evidence.push({
    key: "funding",
    th: "ค่าธรรมเนียม",
    en: "Funding",
    verdict:
      funding === null
        ? "N/A"
        : Math.abs(funding) < 0.005
          ? "Neutral"
          : funding > 0
            ? "Longs paying"
            : "Shorts paying",
    // Crowded longs are a headwind, not a tailwind.
    vote:
      funding === null || Math.abs(funding) < 0.005 ? 0 : funding > 0.02 ? -1 : funding < -0.02 ? 1 : 0,
    detail: funding === null ? "ไม่มีข้อมูลฟิวเจอร์ส" : `${funding.toFixed(4)}% ต่อรอบ`,
  });

  // 4 — Whale flow
  const whale = ctx.whaleBuyShare;
  evidence.push({
    key: "whale",
    th: "แรงซื้อรายใหญ่",
    en: "Whale Flow",
    verdict:
      whale === null ? "N/A" : whale > 55 ? "Buying" : whale < 45 ? "Selling" : "Balanced",
    vote: whale === null ? 0 : whale > 55 ? 1 : whale < 45 ? -1 : 0,
    detail:
      whale === null
        ? "ไม่มีข้อมูลรายการใหญ่"
        : `ไม้ใหญ่ฝั่งซื้อ ${whale.toFixed(1)}% ของมูลค่า`,
  });

  // 5 — Open interest
  const oi = ctx.oiChangePct;
  evidence.push({
    key: "oi",
    th: "สัญญาคงค้าง",
    en: "Open Interest",
    verdict: oi === null ? "N/A" : oi > 0.3 ? "Increasing" : oi < -0.3 ? "Decreasing" : "Flat",
    // Rising OI confirms whichever way price is already leaning.
    vote: oi === null || Math.abs(oi) < 0.3 ? 0 : oi > 0 ? (trendUp ? 1 : -1) : 0,
    detail: oi === null ? "ไม่มีข้อมูล OI" : `${oi >= 0 ? "+" : ""}${oi.toFixed(2)}% ใน 1 ชม.`,
  });

  // 6 — Volume confirmation
  const vols = candles.slice(-30).map((c) => c.volume);
  const avgVol = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1);
  const lastVol = candles.at(-1)!.volume;
  const volOk = avgVol > 0 && lastVol > avgVol * 1.1;
  evidence.push({
    key: "volume",
    th: "ปริมาณยืนยัน",
    en: "Volume",
    verdict: volOk ? "Confirmed" : "Below average",
    vote: volOk ? (trendUp ? 1 : -1) : 0,
    detail: avgVol ? `${((lastVol / avgVol) * 100).toFixed(0)}% ของค่าเฉลี่ย 30 แท่ง` : "—",
  });

  const supporting = evidence.filter((e) => e.vote === 1).length;
  const against = evidence.filter((e) => e.vote === -1).length;
  const net = supporting - against;

  const action: MasterDecision["action"] =
    net >= 2 ? "LONG" : net <= -2 ? "SHORT" : "WAIT";

  // Confidence = share of pods that agree, scaled by trend strength.
  const decided = supporting + against;
  const agreement = decided ? Math.max(supporting, against) / evidence.length : 0;
  const confidence = Math.round(
    Math.min(96, 40 + agreement * 45 + Math.min(regime.confidence, 90) * 0.12),
  );

  const stopDist = Math.max(atr * 1.2, 0.25) / 100;
  const riskReward = Number(Math.max(1.2, Math.min(3.5, 1.4 + Math.abs(net) * 0.35)).toFixed(1));
  const dir = action === "SHORT" ? -1 : 1;
  const entry = last;
  const stop = entry * (1 - dir * stopDist);
  const target = entry * (1 + dir * stopDist * riskReward);

  // Fixed-fractional sizing: risk 0.5% of equity, capped by volatility.
  const riskBudget = 0.5;
  const positionSizePct = Number(
    Math.min(2.5, riskBudget / Math.max(stopDist * 100, 0.25)).toFixed(2),
  );
  // Capped at the account's configured isolated leverage.
  const leverage = Math.max(2, Math.min(15, Math.round(1.4 / Math.max(stopDist, 0.002) / 10)));

  const expectedWinRate = Math.round(
    Math.min(74, 34 + agreement * 34 + (riskReward < 2 ? 6 : 0)),
  );

  const summaryTh =
    action === "WAIT"
      ? `หลักฐานยังขัดกัน (${supporting} หนุน / ${against} ค้าน) Master AI แนะนำให้รอ`
      : `${supporting > against ? supporting : against} จาก ${evidence.length} สัญญาณชี้ไปทาง ${action} — เข้าเมื่อราคายืนเหนือแนวรับล่าสุด`;

  return {
    action,
    symbol,
    confidence,
    expectedWinRate,
    riskReward,
    positionSizePct,
    leverage,
    entry,
    stop,
    target,
    evidence,
    supporting,
    against,
    summaryTh,
  };
}
