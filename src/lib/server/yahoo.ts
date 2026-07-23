import type { AssetClass, Candle, Quote } from "../types";
import { findListing } from "../universe";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

async function yahoo<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, {
        cache: "no-store",
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) throw new Error(`${host}${path} -> ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("yahoo failed");
}

type ChartMeta = {
  symbol: string;
  currency?: string;
  regularMarketPrice?: number;
  previousClose?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
  longName?: string;
  shortName?: string;
};

type ChartResponse = {
  chart: {
    result:
      | {
          meta: ChartMeta;
          timestamp?: number[];
          indicators: {
            quote: {
              open?: (number | null)[];
              high?: (number | null)[];
              low?: (number | null)[];
              close?: (number | null)[];
              volume?: (number | null)[];
            }[];
          };
        }[]
      | null;
    error: { description?: string } | null;
  };
};

function classOf(symbol: string): AssetClass {
  return findListing(symbol)?.assetClass ?? (symbol.endsWith(".BK") ? "th" : "global");
}

/**
 * Yahoo's v7 quote endpoint now demands a crumb/cookie pair, so quotes are
 * derived from the v8 chart meta block instead — same numbers, no auth.
 */
export async function getStockQuote(symbol: string): Promise<Quote | null> {
  try {
    const data = await yahoo<ChartResponse>(
      `/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`,
    );
    const result = data.chart.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change = price - prevClose;
    const listing = findListing(symbol);

    const quote = result.indicators.quote[0] ?? {};
    const closes = (quote.close ?? []).filter(
      (v): v is number => typeof v === "number",
    );
    const opens = (quote.open ?? []).filter(
      (v): v is number => typeof v === "number",
    );

    return {
      symbol,
      display: listing?.display ?? symbol,
      name: listing?.name ?? meta.longName ?? meta.shortName ?? symbol,
      assetClass: classOf(symbol),
      price,
      change,
      changePct: prevClose ? (change / prevClose) * 100 : 0,
      high: meta.regularMarketDayHigh ?? Math.max(...closes, price),
      low: meta.regularMarketDayLow ?? Math.min(...closes, price),
      open: opens.at(-1) ?? prevClose,
      prevClose,
      volume: meta.regularMarketVolume ?? 0,
      quoteVolume: (meta.regularMarketVolume ?? 0) * price,
      currency: meta.currency ?? "USD",
    };
  } catch {
    return null;
  }
}

export async function getStockQuotes(symbols: string[]): Promise<Quote[]> {
  const results = await Promise.all(symbols.map(getStockQuote));
  return results.filter((q): q is Quote => q !== null);
}

export async function getStockCandles(
  symbol: string,
  range: string,
  interval: string,
): Promise<{ candles: Candle[]; currency: string }> {
  const data = await yahoo<ChartResponse>(
    `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`,
  );
  const result = data.chart.result?.[0];
  if (!result?.timestamp) return { candles: [], currency: "USD" };

  const q = result.indicators.quote[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    // Yahoo pads holidays/halts with nulls — those bars would break the chart.
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      time: result.timestamp[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume: q.volume?.[i] ?? 0,
    });
  }
  return { candles, currency: result.meta.currency ?? "USD" };
}

type SearchResponse = {
  quotes?: {
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchDisp?: string;
    quoteType?: string;
  }[];
};

export async function searchSymbols(query: string) {
  try {
    const data = await yahoo<SearchResponse>(
      `/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0`,
    );
    return (data.quotes ?? [])
      .filter((q) => q.symbol)
      .map((q) => ({
        symbol: q.symbol!,
        name: q.longname ?? q.shortname ?? q.symbol!,
        exchange: q.exchDisp ?? "",
        type: q.quoteType ?? "",
      }));
  } catch {
    return [];
  }
}
