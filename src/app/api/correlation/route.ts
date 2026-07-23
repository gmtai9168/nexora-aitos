import { correlate, dailyCloses } from "@/lib/server/correlation";

/** Benchmarks every asset on the desk is measured against. */
const BENCHMARKS = [
  { symbol: "^IXIC", label: "NASDAQ", th: "แนสแด็ก" },
  { symbol: "GC=F", label: "GOLD", th: "ทองคำ" },
  { symbol: "^SET.BK", label: "SET", th: "ตลาดหุ้นไทย" },
  { symbol: "BTCUSDT", label: "BTC", th: "บิตคอยน์" },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? "BTCUSDT";

  try {
    const target = await dailyCloses(symbol, 120);

    const pairs = await Promise.all(
      BENCHMARKS.filter((b) => b.symbol !== symbol).map(async (b) => {
        try {
          const series = await dailyCloses(b.symbol, 120);
          const { value, samples } = correlate(target, series);
          return { ...b, value, samples };
        } catch {
          return { ...b, value: null, samples: 0 };
        }
      }),
    );

    return Response.json(
      { symbol, correlations: pairs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { symbol, correlations: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
