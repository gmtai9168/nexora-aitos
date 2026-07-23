import { correlate, dailyCloses } from "@/lib/server/correlation";

/** This route fans out to several upstream APIs, so it needs headroom. */
export const maxDuration = 30;

const DEFAULT = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "^IXIC", "GC=F"];

/**
 * Full N×N correlation matrix of daily returns. Every cell is measured from
 * real closes; a pair without enough overlapping sessions returns null rather
 * than a filler number.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols");
  const symbols = (raw ? raw.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT).slice(
    0,
    10,
  );

  try {
    const series = await Promise.all(
      symbols.map(async (s) => {
        try {
          return { symbol: s, closes: await dailyCloses(s, 120) };
        } catch {
          return { symbol: s, closes: new Map<string, number>() };
        }
      }),
    );

    const matrix = series.map((row) =>
      series.map((col) =>
        row.symbol === col.symbol ? 1 : correlate(row.closes, col.closes).value,
      ),
    );

    return Response.json(
      { symbols, matrix },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { symbols, matrix: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
