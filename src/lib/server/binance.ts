import type { Candle, Quote } from "../types";
import { CRYPTO, findListing } from "../universe";

/**
 * data-api.binance.vision is the read-only market-data mirror; api.binance.com
 * is tried first and the mirror covers the regions where it is blocked.
 */
const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

async function binance<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${host}${path} -> ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("binance failed");
}

type Ticker24h = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  openPrice: string;
  prevClosePrice: string;
  volume: string;
  quoteVolume: string;
};

function toQuote(t: Ticker24h): Quote {
  const listing = findListing(t.symbol);
  const base = t.symbol.replace(/USDT$/, "");
  return {
    symbol: t.symbol,
    display: listing?.display ?? `${base}/USDT`,
    name: listing?.name ?? base,
    assetClass: "crypto",
    price: Number(t.lastPrice),
    change: Number(t.priceChange),
    changePct: Number(t.priceChangePercent),
    high: Number(t.highPrice),
    low: Number(t.lowPrice),
    open: Number(t.openPrice),
    prevClose: Number(t.prevClosePrice),
    volume: Number(t.volume),
    quoteVolume: Number(t.quoteVolume),
    currency: "USDT",
  };
}

export async function getCryptoQuotes(symbols: string[]): Promise<Quote[]> {
  if (symbols.length === 0) return [];
  const query = encodeURIComponent(JSON.stringify(symbols));
  const raw = await binance<Ticker24h[]>(
    `/api/v3/ticker/24hr?symbols=${query}`,
  );
  const bySymbol = new Map(raw.map((t) => [t.symbol, toQuote(t)]));
  // Preserve the caller's ordering so the UI never reshuffles between polls.
  return symbols
    .map((s) => bySymbol.get(s))
    .filter((q): q is Quote => q !== undefined);
}

export type Movers = {
  gainers: Quote[];
  losers: Quote[];
  counts: { up: number; down: number; flat: number; total: number };
};

/**
 * Ranks the whole USDT spot board. Illiquid pairs are filtered out first —
 * without a turnover floor the leaderboard fills with dead micro-caps.
 */
export async function getMovers(limit = 5): Promise<Movers> {
  const raw = await binance<Ticker24h[]>("/api/v3/ticker/24hr");
  const usdt = raw.filter(
    (t) =>
      t.symbol.endsWith("USDT") &&
      !/(UP|DOWN|BULL|BEAR)USDT$/.test(t.symbol) &&
      Number(t.quoteVolume) > 5_000_000,
  );

  const counts = { up: 0, down: 0, flat: 0, total: usdt.length };
  for (const t of usdt) {
    const pct = Number(t.priceChangePercent);
    if (pct > 0.05) counts.up++;
    else if (pct < -0.05) counts.down++;
    else counts.flat++;
  }

  const sorted = [...usdt].sort(
    (a, b) => Number(b.priceChangePercent) - Number(a.priceChangePercent),
  );

  return {
    gainers: sorted.slice(0, limit).map(toQuote),
    losers: sorted.slice(-limit).reverse().map(toQuote),
    counts,
  };
}

export async function getCryptoCandles(
  symbol: string,
  interval: string,
  limit: number,
): Promise<Candle[]> {
  const raw = await binance<(string | number)[][]>(
    `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${limit}`,
  );
  return raw.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
  }));
}

export const DEFAULT_CRYPTO_SYMBOLS = CRYPTO.map((c) => c.symbol);
