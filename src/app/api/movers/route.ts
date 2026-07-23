import { getMovers } from "@/lib/server/binance";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 5), 20);
  try {
    const movers = await getMovers(limit);
    return Response.json(movers, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      {
        gainers: [],
        losers: [],
        counts: { up: 0, down: 0, flat: 0, total: 0 },
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
