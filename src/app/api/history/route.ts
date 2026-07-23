import { getCryptoCandles } from "@/lib/server/binance";
import { getStockCandles } from "@/lib/server/yahoo";
import type { Candle } from "@/lib/types";

const HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];

/** Binance caps a kline request at 1000 bars, so deep history is paginated. */
async function pagedKlines(
  symbol: string,
  interval: string,
  bars: number,
): Promise<Candle[]> {
  const out: Candle[] = [];
  let endTime: number | undefined;

  while (out.length < bars) {
    const limit = Math.min(1000, bars - out.length);
    const qs = `symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}${
      endTime ? `&endTime=${endTime}` : ""
    }`;

    let page: (string | number)[][] | null = null;
    for (const host of HOSTS) {
      try {
        const res = await fetch(`${host}/api/v3/klines?${qs}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) continue;
        page = (await res.json()) as (string | number)[][];
        break;
      } catch {
        /* try the mirror */
      }
    }
    if (!page || page.length === 0) break;

    const chunk: Candle[] = page.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    }));

    out.unshift(...chunk);
    endTime = Number(page[0][0]) - 1;
    if (page.length < limit) break;
  }

  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTCUSDT";
  const interval = url.searchParams.get("interval") ?? "1h";
  const bars = Math.min(Number(url.searchParams.get("bars") ?? 2000), 4000);

  try {
    if (/^[A-Z0-9]+USDT$/.test(symbol)) {
      const candles = await pagedKlines(symbol, interval, bars);
      return Response.json(
        { symbol, interval, bars: candles.length, candles },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    // Equities: Yahoo returns the whole range in one call.
    const range = interval === "1d" ? "5y" : interval === "1h" ? "2y" : "1y";
    const { candles } = await getStockCandles(symbol, range, interval);
    return Response.json(
      { symbol, interval, bars: candles.length, candles: candles.slice(-bars) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    // Last resort: a single page is better than an empty chart.
    try {
      const candles = await getCryptoCandles(symbol, interval, Math.min(bars, 1000));
      return Response.json(
        { symbol, interval, bars: candles.length, candles },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return Response.json(
        {
          symbol,
          interval,
          bars: 0,
          candles: [],
          error: err instanceof Error ? err.message : "fetch failed",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
  }
}
