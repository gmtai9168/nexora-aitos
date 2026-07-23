import { AGENTS, GROUP_BY_KEY, telemetry, trustScore } from "./agents";
import { atrPct, ema, rsi, type Regime } from "./analytics";
import type { MarketContext, MasterDecision } from "./decision";
import type { Candle, Quote } from "./types";

export type OnChain = {
  hasChainData: boolean;
  hashRate: number | null;
  hashTrendPct: number | null;
  difficulty: number | null;
  txCount24h: number | null;
  blocksMined24h: number | null;
  minutesBetweenBlocks: number | null;
  circulatingSupply: number | null;
  onChainVolumeUsd: number | null;
  exchangeVolumeUsd: number | null;
  fearGreed: number | null;
  fearGreedPrev: number | null;
  fearGreedLabel: string | null;
  fearGreedSeries: number[];
};

export const EMPTY_ONCHAIN: OnChain = {
  hasChainData: false,
  hashRate: null,
  hashTrendPct: null,
  difficulty: null,
  txCount24h: null,
  blocksMined24h: null,
  minutesBetweenBlocks: null,
  circulatingSupply: null,
  onChainVolumeUsd: null,
  exchangeVolumeUsd: null,
  fearGreed: null,
  fearGreedPrev: null,
  fearGreedLabel: null,
  fearGreedSeries: [],
};

export type Correlation = {
  symbol: string;
  label: string;
  th: string;
  value: number | null;
  samples: number;
};

export type SubScore = {
  key: string;
  th: string;
  en: string;
  value: number;
  detail: string;
  /** false when the input feed is missing and the score fell back to neutral. */
  live: boolean;
};

export type CoinScore = {
  total: number;
  verdict: "VERY STRONG BUY" | "STRONG BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG SELL";
  verdictTh: string;
  parts: SubScore[];
  summaryTh: string;
};

const clamp = (v: number) => Math.max(0, Math.min(100, v));

/**
 * Nine independent readings of one asset, each on a 0-100 scale where 50 is
 * neutral. Anything with no feed returns 50 and is flagged `live: false`, so a
 * missing data source can never masquerade as a bullish signal.
 */
export function scoreCoin(
  candles: Candle[],
  regime: Regime,
  ctx: MarketContext,
  onchain: OnChain,
  correlations: Correlation[],
  newsBalance: { positive: number; negative: number; total: number },
  quote: Quote | undefined,
): CoinScore {
  const closes = candles.map((c) => c.close);
  const hasCandles = candles.length >= 40;

  // 1 — Trend
  const fast = hasCandles ? ema(closes, 12).at(-1)! : 0;
  const slow = hasCandles ? ema(closes, 34).at(-1)! : 0;
  const slope = slow ? ((fast - slow) / slow) * 100 : 0;
  const trend = hasCandles ? clamp(50 + slope * 42) : 50;

  // 2 — Momentum: RSI distance from 50 plus position inside the day range.
  const r = hasCandles ? rsi(closes, 14) : 50;
  const range = quote && quote.high > quote.low ? (quote.price - quote.low) / (quote.high - quote.low) : 0.5;
  const momentum = hasCandles ? clamp((r - 50) * 1.4 + 50 * 0.4 + range * 60) : 50;

  // 3 — Liquidity: steadier volume means a book you can actually trade in.
  const vols = candles.slice(-30).map((c) => c.volume);
  const avgVol = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1);
  const variance = vols.reduce((a, v) => a + (v - avgVol) ** 2, 0) / Math.max(vols.length, 1);
  const cv = avgVol ? Math.sqrt(variance) / avgVol : 1;
  const liquidity = hasCandles ? clamp(100 - cv * 44) : 50;

  // 4 — Whale flow
  const whale = ctx.whaleBuyShare === null ? 50 : clamp((ctx.whaleBuyShare - 50) * 3 + 50);

  // 5 — Funding: crowded longs are a negative, not a positive.
  const funding = ctx.funding === null ? 50 : clamp(50 - ctx.funding * 700);

  // 6 — Risk: calm markets score high.
  const atr = hasCandles ? atrPct(candles, 14) : 0;
  const risk = hasCandles ? clamp(100 - atr * 32) : 50;

  // 7 — News sentiment
  const news = newsBalance.total
    ? clamp(50 + ((newsBalance.positive - newsBalance.negative) / newsBalance.total) * 55)
    : 50;

  // 8 — Macro: Fear & Greed plus how tightly the asset tracks equities.
  const fg = onchain.fearGreed;
  const nasdaq = correlations.find((c) => c.label === "NASDAQ")?.value ?? null;
  const macro =
    fg === null
      ? 50
      : clamp(fg * 0.75 + 25 - (nasdaq !== null ? Math.max(0, nasdaq) * 12 : 0));

  // 9 — Ensemble: the model layer weighting everything above.
  const ml = clamp(
    trend * 0.26 + momentum * 0.18 + whale * 0.16 + liquidity * 0.12 + funding * 0.12 + risk * 0.1 + news * 0.06,
  );

  const parts: SubScore[] = [
    { key: "trend", th: "แนวโน้ม", en: "Trend", value: trend, detail: `EMA12/34 ${slope >= 0 ? "+" : ""}${slope.toFixed(3)}%`, live: hasCandles },
    { key: "momentum", th: "โมเมนตัม", en: "Momentum", value: momentum, detail: `RSI ${r.toFixed(1)} · ในกรอบวัน ${(range * 100).toFixed(0)}%`, live: hasCandles },
    { key: "liquidity", th: "สภาพคล่อง", en: "Liquidity", value: liquidity, detail: `ความสม่ำเสมอของวอลุ่ม ${(100 - cv * 44).toFixed(0)}`, live: hasCandles },
    { key: "whale", th: "แรงซื้อรายใหญ่", en: "Whale", value: whale, detail: ctx.whaleBuyShare === null ? "ไม่มีข้อมูลไม้ใหญ่" : `ฝั่งซื้อ ${ctx.whaleBuyShare.toFixed(1)}%`, live: ctx.whaleBuyShare !== null },
    { key: "funding", th: "ค่าธรรมเนียม", en: "Funding", value: funding, detail: ctx.funding === null ? "ไม่มีข้อมูลฟิวเจอร์ส" : `${ctx.funding.toFixed(4)}% ต่อรอบ`, live: ctx.funding !== null },
    { key: "risk", th: "ความเสี่ยง", en: "Risk", value: risk, detail: `ATR ${atr.toFixed(2)}% · ${regime.volatilityTh}`, live: hasCandles },
    { key: "news", th: "ข่าว", en: "News", value: news, detail: newsBalance.total ? `บวก ${newsBalance.positive} / ลบ ${newsBalance.negative}` : "ยังไม่มีข่าว", live: newsBalance.total > 0 },
    { key: "macro", th: "มหภาค", en: "Macro", value: macro, detail: fg === null ? "ไม่มีดัชนีความกลัว" : `Fear & Greed ${fg} (${onchain.fearGreedLabel ?? "-"})`, live: fg !== null },
    { key: "ml", th: "แมชชีนเลิร์นนิง", en: "Machine Learning", value: ml, detail: "ถ่วงน้ำหนักสัญญาณทั้งหมด", live: hasCandles },
  ];

  // Weighted composite — the headline AI Score.
  const weights: Record<string, number> = {
    trend: 0.2,
    momentum: 0.14,
    liquidity: 0.1,
    whale: 0.13,
    funding: 0.09,
    risk: 0.09,
    news: 0.06,
    macro: 0.07,
    ml: 0.12,
  };
  const total = Math.round(parts.reduce((a, p) => a + p.value * weights[p.key], 0));

  const verdict: CoinScore["verdict"] =
    total >= 85 ? "VERY STRONG BUY"
    : total >= 72 ? "STRONG BUY"
    : total >= 60 ? "BUY"
    : total >= 45 ? "NEUTRAL"
    : total >= 32 ? "SELL"
    : "STRONG SELL";

  const verdictTh = {
    "VERY STRONG BUY": "น่าซื้อมาก",
    "STRONG BUY": "น่าซื้อ",
    BUY: "ซื้อได้",
    NEUTRAL: "เป็นกลาง",
    SELL: "ควรขาย",
    "STRONG SELL": "ควรขายมาก",
  }[verdict];

  const top = [...parts].sort((a, b) => b.value - a.value)[0];
  const bottom = [...parts].sort((a, b) => a.value - b.value)[0];
  const dead = parts.filter((p) => !p.live).length;

  const summaryTh = [
    `${regime.labelTh} · ${regime.biasTh} — คะแนนรวม ${total}/100 (${verdictTh})`,
    `จุดแข็งที่สุดคือ${top.th} (${top.value.toFixed(0)}) จุดอ่อนที่สุดคือ${bottom.th} (${bottom.value.toFixed(0)})`,
    ctx.oiChangePct !== null
      ? `สัญญาคงค้าง ${ctx.oiChangePct >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(ctx.oiChangePct).toFixed(2)}% ใน 1 ชั่วโมง`
      : "",
    dead > 0 ? `หมายเหตุ: มี ${dead} สัญญาณที่ไม่มีข้อมูล จึงใช้ค่ากลาง 50` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return { total, verdict, verdictTh, parts, summaryTh };
}

export type Consensus = {
  long: number;
  short: number;
  neutral: number;
  agreementPct: number;
  headline: string;
  split: boolean;
  byGroup: { key: string; th: string; color: string; long: number; short: number; neutral: number }[];
};

/** Which sub-score each pod actually reads before it votes. */
const POD_SIGNAL: Record<string, string> = {
  data: "liquidity",
  trend: "trend",
  smart: "whale",
  futures: "funding",
  pattern: "momentum",
  ml: "ml",
  risk: "risk",
  learn: "ml",
  master: "ml",
  exec: "liquidity",
};

/**
 * Consensus Engine — polls all 50 agents instead of reporting only the Master
 * verdict. Each agent votes on the sub-score its pod owns, shifted by its own
 * Trust Score so a well-performing model leans in harder than a shaky one.
 */
export function consensus(score: CoinScore, quotes: Map<string, Quote>): Consensus {
  const byKey = new Map(score.parts.map((p) => [p.key, p.value]));
  const groups = new Map<string, { long: number; short: number; neutral: number }>();

  let long = 0;
  let short = 0;
  let neutral = 0;

  for (const agent of AGENTS) {
    const signal = byKey.get(POD_SIGNAL[agent.group] ?? "ml") ?? 50;
    const move = agent.symbol ? (quotes.get(agent.symbol)?.changePct ?? null) : null;
    const trust = trustScore(telemetry(agent, move)).score;

    // A high-trust agent needs less of a push to commit either way.
    const bias = (trust - 70) * 0.12;
    const vote = signal + bias;

    const bucket = groups.get(agent.group) ?? { long: 0, short: 0, neutral: 0 };
    if (vote >= 56) {
      long++;
      bucket.long++;
    } else if (vote <= 44) {
      short++;
      bucket.short++;
    } else {
      neutral++;
      bucket.neutral++;
    }
    groups.set(agent.group, bucket);
  }

  const total = AGENTS.length;
  const winner = Math.max(long, short);
  const agreementPct = Math.round((winner / total) * 100);
  const split = Math.abs(long - short) <= 4;

  const headline = split
    ? `เสียงแตก ${long} ต่อ ${short} — ระบบยังไม่มีข้อสรุปร่วม`
    : long > short
      ? `${long} จาก ${total} AI สนับสนุน LONG`
      : `${short} จาก ${total} AI สนับสนุน SHORT`;

  return {
    long,
    short,
    neutral,
    agreementPct,
    headline,
    split,
    byGroup: [...groups.entries()].map(([key, v]) => ({
      key,
      th: GROUP_BY_KEY.get(key)?.th ?? key,
      color: GROUP_BY_KEY.get(key)?.color ?? "#6b8497",
      ...v,
    })),
  };
}

export type EntryPlan = {
  direction: "LONG" | "SHORT" | "WAIT";
  entry: number;
  stop: number;
  targets: { label: string; price: number; rr: number }[];
  riskPct: number;
  leverage: number;
  holdingHours: number;
  winRate: number;
  rr: number;
  confidence: number;
};

/** Turns the Master decision into a laddered plan with three take-profits. */
export function entryPlan(decision: MasterDecision | null): EntryPlan | null {
  if (!decision) return null;

  const dir = decision.action === "SHORT" ? -1 : 1;
  const riskDist = Math.abs(decision.entry - decision.stop);

  return {
    direction: decision.action,
    entry: decision.entry,
    stop: decision.stop,
    targets: [1, 2, 3].map((n) => {
      const rr = Number((decision.riskReward * (n / 2 + 0.25)).toFixed(2));
      return {
        label: `TP${n}`,
        price: decision.entry + dir * riskDist * rr,
        rr,
      };
    }),
    riskPct: decision.positionSizePct,
    leverage: decision.leverage,
    holdingHours: Math.max(1, Math.round(decision.riskReward * 1.2)),
    winRate: decision.expectedWinRate,
    rr: decision.riskReward,
    confidence: decision.confidence,
  };
}

export type RiskRow = {
  th: string;
  en: string;
  level: number;
  note: string;
};

/** Nine risk dimensions, each 0-100 where higher means more dangerous. */
export function riskAnalysis(
  regime: Regime,
  ctx: MarketContext,
  correlations: Correlation[],
  onchain: OnChain,
  exchangesDown: number,
  newsNegative: number,
): RiskRow[] {
  const nasdaq = correlations.find((c) => c.label === "NASDAQ")?.value;
  const spreadRisk = ctx.takerBuyShare === null ? 40 : Math.abs(ctx.takerBuyShare - 50) * 1.6;

  return [
    { th: "ความผันผวน", en: "Volatility", level: clamp(regime.atr * 34), note: `ATR ${regime.atr.toFixed(2)}%` },
    { th: "Drawdown", en: "Drawdown", level: clamp(regime.atr * 26 + 12), note: "ประเมินจาก ATR" },
    { th: "Slippage", en: "Slippage", level: clamp(spreadRisk), note: ctx.takerBuyShare === null ? "ไม่มีข้อมูล" : `แรงซื้อ ${ctx.takerBuyShare.toFixed(0)}%` },
    { th: "ความสัมพันธ์สินทรัพย์", en: "Correlation", level: clamp(Math.abs(nasdaq ?? 0) * 100), note: nasdaq == null ? "ไม่มีข้อมูล" : `NASDAQ ${nasdaq.toFixed(2)}` },
    { th: "Funding", en: "Funding", level: ctx.funding === null ? 40 : clamp(Math.abs(ctx.funding) * 900), note: ctx.funding === null ? "ไม่มีข้อมูล" : `${ctx.funding.toFixed(4)}%` },
    { th: "ข่าว", en: "News", level: clamp(newsNegative * 16 + 20), note: `ข่าวลบ ${newsNegative} รายการ` },
    { th: "มหภาค", en: "Macro", level: onchain.fearGreed === null ? 45 : clamp(100 - onchain.fearGreed), note: onchain.fearGreed === null ? "ไม่มีข้อมูล" : `Fear & Greed ${onchain.fearGreed}` },
    { th: "สภาพคล่อง", en: "Liquidity", level: clamp(60 - (ctx.openInterest ? 25 : 0)), note: ctx.openInterest ? "OI ปกติ" : "ไม่มีข้อมูล OI" },
    { th: "Exchange", en: "Exchange", level: clamp(exchangesDown * 26), note: exchangesDown ? `เชื่อมต่อไม่ได้ ${exchangesDown} แห่ง` : "ทุกแห่งปกติ" },
  ];
}
