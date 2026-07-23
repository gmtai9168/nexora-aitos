import { getCryptoCandles } from "@/lib/server/binance";

/** 24 hourly closes per symbol — just enough to draw a truthful sparkline. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbols = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9]+USDT$/.test(s))
    .slice(0, 12);

  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const candles = await getCryptoCandles(symbol, "1h", 24);
        return [symbol, candles.map((c) => c.close)] as const;
      } catch {
        return [symbol, [] as number[]] as const;
      }
    }),
  );

  return Response.json(
    { series: Object.fromEntries(entries) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
