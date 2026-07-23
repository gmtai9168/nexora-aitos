import { getCryptoCandles } from "./binance";
import { getStockCandles } from "./yahoo";
import type { Candle } from "../types";

/** Daily closes keyed by UTC date, so 24/7 crypto lines up with equity sessions. */
export async function dailyCloses(
  symbol: string,
  days: number,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let candles: Candle[] = [];

  if (/^[A-Z0-9]+USDT$/.test(symbol)) {
    candles = await getCryptoCandles(symbol, "1d", days);
  } else {
    const res = await getStockCandles(symbol, "6mo", "1d");
    candles = res.candles;
  }

  for (const c of candles.slice(-days)) {
    out.set(new Date(c.time * 1000).toISOString().slice(0, 10), c.close);
  }
  return out;
}

/** Pearson correlation of daily returns over the overlapping sessions. */
export function correlate(
  a: Map<string, number>,
  b: Map<string, number>,
): { value: number | null; samples: number } {
  const days = [...a.keys()].filter((d) => b.has(d)).sort();
  if (days.length < 12) return { value: null, samples: days.length };

  const ra: number[] = [];
  const rb: number[] = [];
  for (let i = 1; i < days.length; i++) {
    const pa = a.get(days[i - 1])!;
    const pb = b.get(days[i - 1])!;
    if (!pa || !pb) continue;
    ra.push(a.get(days[i])! / pa - 1);
    rb.push(b.get(days[i])! / pb - 1);
  }
  if (ra.length < 10) return { value: null, samples: ra.length };

  const ma = ra.reduce((x, y) => x + y, 0) / ra.length;
  const mb = rb.reduce((x, y) => x + y, 0) / rb.length;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < ra.length; i++) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  const den = Math.sqrt(da * db);
  return { value: den ? num / den : null, samples: ra.length };
}
