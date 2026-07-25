import { ema } from "../analytics";
import { klines } from "./binance-testnet";

/**
 * Deep-analysis layer: the broader, real market context behind a trade.
 *
 * The technical signal only reads price. This adds the data the platform
 * already tracks but the trader ignored — futures funding, open-interest
 * trend, aggressive taker flow, crowd positioning, market sentiment, and
 * higher-timeframe trend. Each factor either confirms or contradicts the
 * signal's direction, and the net becomes a bounded confidence adjustment.
 *
 * It is honest about weight: no single factor here is a money-printer, so the
 * whole layer moves confidence by at most ~±35 points and never overrides a
 * missing technical signal. It makes decisions broader, not magically right.
 */

const FAPI = "https://fapi.binance.com";

async function j<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Market-wide sentiment — fetched once per cycle
 * ------------------------------------------------------------------ */

export async function fearGreed(): Promise<number | null> {
  const d = await j<{ data: { value: string }[] }>("https://api.alternative.me/fng/?limit=1");
  const v = d?.data?.[0]?.value;
  return v ? Number(v) : null;
}

/* ------------------------------------------------------------------ *
 * Per-symbol futures microstructure (real mainnet data)
 * ------------------------------------------------------------------ */

type Premium = { lastFundingRate: string; markPrice?: string; indexPrice?: string };
type OiPoint = { sumOpenInterest: string };
type Ratio = { longShortRatio?: string; buySellRatio?: string; longAccount?: string };

type Depth = { bids: [string, string][]; asks: [string, string][] };

export type MarketDepth = {
  funding: number | null; // %
  oiChangePct: number | null; // over the window
  takerBuyShare: number | null; // %
  longShare: number | null; // % of accounts long
  /** Resting-order pressure near mid: + = bids heavier (buy wall), − = asks. */
  obImbalance: number | null; // %
  /** Perp premium/discount vs index, %: + = perp rich. */
  basis: number | null;
  /** Best bid/ask spread in basis points — a market-maker/liquidity read. */
  spreadBps: number | null;
};

/** #2 Order-book imbalance from the live futures depth (free, real-time). */
function imbalance(d: Depth | null): number | null {
  if (!d || !d.bids?.length || !d.asks?.length) return null;
  const notional = (rows: [string, string][]) => rows.reduce((s, [p, q]) => s + Number(p) * Number(q), 0);
  const bid = notional(d.bids);
  const ask = notional(d.asks);
  const tot = bid + ask;
  return tot ? ((bid - ask) / tot) * 100 : null;
}

export async function marketDepth(symbol: string): Promise<MarketDepth> {
  const [prem, oi, lsr, taker, book] = await Promise.all([
    j<Premium>(`${FAPI}/fapi/v1/premiumIndex?symbol=${symbol}`),
    j<OiPoint[]>(`${FAPI}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=13`),
    j<Ratio[]>(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`),
    j<Ratio[]>(`${FAPI}/futures/data/takerlongshortRatio?symbol=${symbol}&period=5m&limit=1`),
    j<Depth>(`${FAPI}/fapi/v1/depth?symbol=${symbol}&limit=100`),
  ]);

  let oiChangePct: number | null = null;
  if (oi && oi.length >= 2) {
    const now = Number(oi.at(-1)!.sumOpenInterest);
    const then = Number(oi[0].sumOpenInterest);
    oiChangePct = then ? ((now - then) / then) * 100 : null;
  }

  let takerBuyShare: number | null = null;
  const bsr = taker?.[0]?.buySellRatio ? Number(taker[0].buySellRatio) : null;
  if (bsr && bsr > 0) takerBuyShare = (bsr / (1 + bsr)) * 100;

  let basis: number | null = null;
  const mark = prem?.markPrice ? Number(prem.markPrice) : null;
  const index = prem?.indexPrice ? Number(prem.indexPrice) : null;
  if (mark && index) basis = ((mark - index) / index) * 100;

  let spreadBps: number | null = null;
  if (book?.bids?.[0] && book?.asks?.[0]) {
    const bid = Number(book.bids[0][0]);
    const ask = Number(book.asks[0][0]);
    const mid = (bid + ask) / 2;
    if (mid > 0) spreadBps = ((ask - bid) / mid) * 10000;
  }

  return {
    funding: prem ? Number(prem.lastFundingRate) * 100 : null,
    oiChangePct,
    takerBuyShare,
    longShare: lsr?.[0]?.longAccount ? Number(lsr[0].longAccount) * 100 : null,
    obImbalance: imbalance(book),
    basis,
    spreadBps,
  };
}

/* ------------------------------------------------------------------ *
 * Whale / aggressive-trade flow — recent large market trades.
 * ------------------------------------------------------------------ */

type AggTrade = { q: string; p: string; m: boolean }; // qty, price, isBuyerMaker

export type WhaleFlow = {
  /** Share of large-trade notional that was aggressive buying, %. */
  buyShare: number | null;
  /** Net taker delta over the window, in quote notional. */
  delta: number | null;
};

/** Large-trade buy/sell pressure from the last ~1000 aggregated trades. */
export async function whaleFlow(symbol: string): Promise<WhaleFlow> {
  const trades = await j<AggTrade[]>(`${FAPI}/fapi/v1/aggTrades?symbol=${symbol}&limit=1000`);
  if (!trades || trades.length < 20) return { buyShare: null, delta: null };

  const notional = trades.map((t) => ({ n: Number(t.p) * Number(t.q), buy: !t.m }));
  // "Large" = top quartile by notional — the closest free proxy for whale prints.
  const sorted = [...notional].map((x) => x.n).sort((a, b) => a - b);
  const cut = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  let bigBuy = 0, bigSell = 0, delta = 0;
  for (const t of notional) {
    delta += t.buy ? t.n : -t.n;
    if (t.n >= cut) {
      if (t.buy) bigBuy += t.n;
      else bigSell += t.n;
    }
  }
  const tot = bigBuy + bigSell;
  return { buyShare: tot ? (bigBuy / tot) * 100 : null, delta };
}

/* ------------------------------------------------------------------ *
 * #3 Implied volatility — Deribit DVOL (free, no key). BTC/ETH only.
 * ------------------------------------------------------------------ */

/** Annualized implied-vol index (~40–60 typical BTC); null for assets without DVOL. */
export async function impliedVol(symbol: string): Promise<number | null> {
  const cur = symbol.startsWith("BTC") ? "BTC" : symbol.startsWith("ETH") ? "ETH" : null;
  if (!cur) return null;
  const now = Date.now();
  const d = await j<{ result?: { data?: number[][] } }>(
    `https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=${cur}&start_timestamp=${now - 6 * 3600 * 1000}&end_timestamp=${now}&resolution=3600`,
  );
  const rows = d?.result?.data;
  if (!rows || rows.length === 0) return null;
  const close = rows.at(-1)![4]; // [ts, open, high, low, close]
  return Number.isFinite(close) ? close : null;
}

/* ------------------------------------------------------------------ *
 * Higher-timeframe trend, from the same feed we execute on
 * ------------------------------------------------------------------ */

const HIGHER_TF: Record<string, string> = {
  "1m": "15m",
  "5m": "1h",
  "15m": "4h",
  "1h": "4h",
  "4h": "1d",
};

/** +1 uptrend, −1 downtrend, 0 flat on the timeframe above `interval`. */
export async function higherTrend(symbol: string, interval: string): Promise<number> {
  const tf = HIGHER_TF[interval] ?? "1h";
  const kl = await klines(symbol, tf, 120);
  if (!kl.ok || kl.data.length < 40) return 0;
  const closes = kl.data.map((c) => c.close);
  const fast = ema(closes, 12).at(-1)!;
  const slow = ema(closes, 34).at(-1)!;
  if (!slow) return 0;
  const slope = ((fast - slow) / slow) * 100;
  return slope > 0.1 ? 1 : slope < -0.1 ? -1 : 0;
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

export type DeepFactor = { label: string; agree: boolean | null; note: string };

export type DeepResult = {
  /** Confidence adjustment in points, bounded to about ±35. */
  adj: number;
  factors: DeepFactor[];
  /** Short human summary of the strongest agreeing/disagreeing forces. */
  summary: string;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function scoreDeep(
  dir: "LONG" | "SHORT",
  depth: MarketDepth,
  fng: number | null,
  hiTrend: number,
  iv: number | null = null,
): DeepResult {
  const long = dir === "LONG";
  const factors: DeepFactor[] = [];
  let adj = 0;

  // Higher-timeframe trend — the heaviest factor: don't fight the bigger trend.
  if (hiTrend !== 0) {
    const agree = (hiTrend > 0) === long;
    const w = agree ? 12 : -22;
    adj += w;
    factors.push({
      label: "เทรนด์ไทม์เฟรมใหญ่",
      agree,
      note: agree ? "ไปทางเดียวกับเทรนด์ใหญ่" : "สวนเทรนด์ใหญ่ (เสี่ยง)",
    });
  }

  // Order-book imbalance — resting buy/sell walls near mid right now.
  if (depth.obImbalance !== null && Math.abs(depth.obImbalance) > 12) {
    const bidHeavy = depth.obImbalance > 0;
    const aligned = bidHeavy === long;
    adj += clamp((long ? depth.obImbalance : -depth.obImbalance) * 0.25, -8, 8);
    factors.push({
      label: "สมดุลคำสั่งในบุ๊ก",
      agree: aligned,
      note: `${bidHeavy ? "กำแพงซื้อ" : "กำแพงขาย"}หนากว่า ${Math.abs(depth.obImbalance).toFixed(0)}%`,
    });
  }

  // Implied volatility (DVOL) — how big a move the options market is pricing.
  // High IV makes a short-timeframe entry riskier both ways; a small caution.
  if (iv !== null) {
    if (iv >= 70) {
      adj -= 4;
      factors.push({ label: "ความผันผวนคาดการณ์", agree: false, note: `สูง (DVOL ${iv.toFixed(0)}) — ตลาดคาดเหวี่ยงแรง` });
    } else if (iv <= 35) {
      adj += 2;
      factors.push({ label: "ความผันผวนคาดการณ์", agree: true, note: `ต่ำ (DVOL ${iv.toFixed(0)}) — ตลาดค่อนข้างนิ่ง` });
    }
  }

  // Aggressive taker flow — who is hitting the book right now.
  if (depth.takerBuyShare !== null) {
    const buyBias = depth.takerBuyShare - 50; // + = buyers aggressive
    const aligned = long ? buyBias : -buyBias;
    adj += clamp(aligned * 0.5, -10, 10);
    factors.push({
      label: "แรงเคาะซื้อ/ขาย",
      agree: aligned > 3 ? true : aligned < -3 ? false : null,
      note: `ฝั่งซื้อ ${depth.takerBuyShare.toFixed(0)}%`,
    });
  }

  // Open interest — rising OI in the trade's direction means fresh conviction.
  if (depth.oiChangePct !== null && Math.abs(depth.oiChangePct) > 1) {
    const rising = depth.oiChangePct > 0;
    // Fresh money confirms only when flow agrees; otherwise it is neutral.
    const flowAgrees = depth.takerBuyShare !== null && (long ? depth.takerBuyShare > 50 : depth.takerBuyShare < 50);
    if (rising && flowAgrees) {
      adj += 5;
      factors.push({ label: "สัญญาคงค้าง (OI)", agree: true, note: `เพิ่ม ${depth.oiChangePct.toFixed(1)}% พร้อมแรงหนุน` });
    } else if (!rising) {
      factors.push({ label: "สัญญาคงค้าง (OI)", agree: null, note: `ลด ${depth.oiChangePct.toFixed(1)}% (สถานะถูกปิด)` });
    }
  }

  // Crowded positioning — an over-one-sided crowd is a contrarian caution.
  if (depth.longShare !== null && (depth.longShare > 62 || depth.longShare < 38)) {
    const crowdedLong = depth.longShare > 50;
    const against = crowdedLong === long; // entering with an already-crowded side
    adj += against ? -6 : 4;
    factors.push({
      label: "ฝูงชนในตลาด",
      agree: !against,
      note: `บัญชีฝั่งซื้อ ${depth.longShare.toFixed(0)}%${against ? " — แออัดฝั่งเดียวกับเรา" : ""}`,
    });
  }

  // Funding at an extreme — the crowded side pays, a mild contrarian nudge.
  if (depth.funding !== null && Math.abs(depth.funding) > 0.03) {
    const longsPay = depth.funding > 0;
    const against = longsPay === long;
    adj += against ? -4 : 3;
    factors.push({
      label: "Funding Rate",
      agree: !against,
      note: `${depth.funding.toFixed(4)}%${against ? " — ฝั่งเราเป็นคนจ่าย" : ""}`,
    });
  }

  // Sentiment extreme — contrarian at the tails only.
  if (fng !== null && (fng <= 25 || fng >= 75)) {
    const greed = fng >= 75;
    const favoursLong = !greed; // extreme fear favours longs, greed favours shorts
    const agree = favoursLong === long;
    adj += agree ? 4 : -4;
    factors.push({
      label: "อารมณ์ตลาด",
      agree,
      note: `ดัชนี ${fng} (${greed ? "โลภสุด" : "กลัวสุด"})`,
    });
  }

  adj = clamp(adj, -35, 35);

  const agreed = factors.filter((f) => f.agree === true);
  const against = factors.filter((f) => f.agree === false);
  const summary =
    factors.length === 0
      ? "ไม่มีข้อมูลเชิงลึกเพิ่มเติมในรอบนี้"
      : `${agreed.length} ปัจจัยหนุน · ${against.length} ปัจจัยค้าน → ปรับความมั่นใจ ${adj >= 0 ? "+" : ""}${adj.toFixed(0)}`;

  return { adj, factors, summary };
}
