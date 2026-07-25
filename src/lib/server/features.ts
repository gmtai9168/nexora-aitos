import {
  adx,
  atrPct,
  bollingerPctB,
  detectRegime,
  ema,
  emaStack,
  macdHist,
  roc,
  rsi,
} from "../analytics";
import type { Features } from "../council";
import type { Candle } from "../types";
import { higherTrend, impliedVol, marketDepth, whaleFlow } from "./confluence";

/**
 * Builds the real feature bundle the council votes on. Candle-derived
 * indicators are computed locally; the live futures microstructure, implied
 * vol, higher-timeframe trend, and whale flow are fetched concurrently. News,
 * sentiment, learning bias, and account posture are passed in by the caller so
 * they aren't re-fetched per symbol.
 */
export async function buildFeatures(p: {
  symbol: string;
  candles: Candle[];
  interval: string;
  fng: number | null;
  newsBias: number;
  newsImpact: number;
  newsDeep: boolean;
  recentBias: number;
  marginRatio: number | null;
  dayPnlPct: number | null;
  openPositions: number;
  maxPositions: number;
}): Promise<Features> {
  const closes = p.candles.map((c) => c.close);
  const regime = detectRegime(p.candles);
  const e12 = ema(closes, 12).at(-1)!;
  const e34 = ema(closes, 34).at(-1)!;
  const slope = e34 ? ((e12 - e34) / e34) * 100 : 0;

  const [depth, iv, hi, whale] = await Promise.all([
    marketDepth(p.symbol),
    impliedVol(p.symbol),
    higherTrend(p.symbol, p.interval),
    whaleFlow(p.symbol),
  ]);

  const vols = p.candles.slice(-30).map((c) => c.volume);
  const avg = vols.reduce((a, b) => a + b, 0) / Math.max(vols.length, 1);
  const variance = vols.reduce((a, v) => a + (v - avg) ** 2, 0) / Math.max(vols.length, 1);
  const cv = avg ? Math.sqrt(variance) / avg : 1;
  const liquidity = Math.round(Math.max(30, Math.min(99, 100 - cv * 42)));
  const volRatio = avg ? p.candles.at(-1)!.volume / avg : 1;

  const futs = [depth.funding, depth.oiChangePct, depth.takerBuyShare, depth.longShare, depth.obImbalance, depth.basis];
  const completeness = Math.round((futs.filter((x) => x !== null).length / futs.length) * 100);

  const regimeBias = regime.bias === "Bullish" ? 1 : regime.bias === "Bearish" ? -1 : 0;

  return {
    symbol: p.symbol,
    price: closes.at(-1)!,
    slope,
    rsi: rsi(closes, 14),
    atrPct: atrPct(p.candles, 14),
    adx: adx(p.candles, 14),
    macdHist: macdHist(closes),
    bbPctB: bollingerPctB(closes),
    roc: roc(closes, 10),
    emaStack: emaStack(closes),
    higherTrend: hi,
    regimeBias,
    regimeConf: regime.confidence,
    volRatio,
    liquidity,
    funding: depth.funding,
    oiChangePct: depth.oiChangePct,
    takerBuyShare: depth.takerBuyShare,
    longShare: depth.longShare,
    obImbalance: depth.obImbalance,
    basis: depth.basis,
    spreadBps: depth.spreadBps,
    dvol: iv,
    fng: p.fng,
    whaleBuyShare: whale.buyShare,
    delta: whale.delta,
    newsBias: p.newsBias,
    newsImpact: p.newsImpact,
    newsDeep: p.newsDeep,
    recentBias: p.recentBias,
    marginRatio: p.marginRatio,
    dayPnlPct: p.dayPnlPct,
    openPositions: p.openPositions,
    maxPositions: p.maxPositions,
    completeness,
  };
}
