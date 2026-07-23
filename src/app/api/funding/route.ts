const FUTURES = "https://fapi.binance.com";

type PremiumRaw = { symbol: string; lastFundingRate: string };

/** Funding rates for the heatmap — one board-wide call, filtered server-side. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const wanted = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  try {
    const res = await fetch(`${FUTURES}/fapi/v1/premiumIndex`, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const all = (await res.json()) as PremiumRaw[];

    const bySymbol = new Map(
      all.map((p) => [p.symbol, Number(p.lastFundingRate) * 100]),
    );

    const rates = (wanted.length ? wanted : [...bySymbol.keys()].slice(0, 12))
      .map((symbol) => ({ symbol, rate: bySymbol.get(symbol) ?? null }))
      .filter((r) => r.rate !== null);

    return Response.json(
      { rates },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { rates: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
