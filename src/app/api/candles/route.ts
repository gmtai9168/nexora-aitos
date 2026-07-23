import { getCryptoCandles } from "@/lib/server/binance";
import { getStockCandles } from "@/lib/server/yahoo";
import type { Candle, CandleResponse } from "@/lib/types";

/** Maps a UI timeframe to the range/interval Yahoo expects. */
const STOCK_TF: Record<string, { range: string; interval: string }> = {
  "1s": { range: "1d", interval: "1m" },
  "5s": { range: "1d", interval: "1m" },
  "15s": { range: "1d", interval: "1m" },
  "1m": { range: "1d", interval: "1m" },
  "5m": { range: "5d", interval: "5m" },
  "15m": { range: "1mo", interval: "15m" },
  "1h": { range: "3mo", interval: "1h" },
  "4h": { range: "1y", interval: "1d" },
  "1d": { range: "2y", interval: "1d" },
};

/** Binance serves 1s natively; 5s and 15s are rolled up from it. */
const AGGREGATE: Record<string, number> = { "5s": 5, "15s": 15 };

function rollUp(candles: Candle[], factor: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += factor) {
    const bucket = candles.slice(i, i + factor);
    if (bucket.length === 0) continue;
    out.push({
      time: bucket[0].time,
      open: bucket[0].open,
      high: Math.max(...bucket.map((c) => c.high)),
      low: Math.min(...bucket.map((c) => c.low)),
      close: bucket.at(-1)!.close,
      volume: bucket.reduce((a, c) => a + c.volume, 0),
    });
  }
  return out;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTCUSDT";
  const tf = (url.searchParams.get("tf") ?? "5m").toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 300), 1000);

  try {
    if (/^[A-Z0-9]+USDT$/.test(symbol)) {
      const factor = AGGREGATE[tf];
      const interval = factor ? "1s" : tf;
      const fetchLimit = factor ? Math.min(1000, limit * factor) : limit;

      const raw = await getCryptoCandles(symbol, interval, fetchLimit);
      const candles = factor ? rollUp(raw, factor) : raw;

      const body: CandleResponse = { symbol, interval: tf, currency: "USDT", candles };
      return Response.json(body, { headers: { "Cache-Control": "no-store" } });
    }

    const { range, interval } = STOCK_TF[tf] ?? STOCK_TF["1d"];
    const { candles, currency } = await getStockCandles(symbol, range, interval);
    const body: CandleResponse = { symbol, interval: tf, currency, candles };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json(
      {
        symbol,
        interval: tf,
        currency: "",
        candles: [],
        error: err instanceof Error ? err.message : "fetch failed",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
