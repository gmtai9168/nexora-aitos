const SPOT_HOSTS = ["https://api.binance.com", "https://data-api.binance.vision"];
const FUTURES = "https://fapi.binance.com";

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function spot<T>(path: string): Promise<T | null> {
  for (const host of SPOT_HOSTS) {
    const data = await json<T>(host + path);
    if (data !== null) return data;
  }
  return null;
}

type DepthRaw = { bids: [string, string][]; asks: [string, string][] };
type TradeRaw = {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
};
type PremiumRaw = { lastFundingRate: string; markPrice: string; nextFundingTime: number };
type OpenInterestRaw = { openInterest: string };
type LSRaw = { longAccount: string; shortAccount: string; longShortRatio: string }[];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();

  if (!/^[A-Z0-9]+USDT$/.test(symbol)) {
    return Response.json(
      { supported: false, symbol },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [depth, trades, premium, oi, ls] = await Promise.all([
    spot<DepthRaw>(`/api/v3/depth?symbol=${symbol}&limit=14`),
    spot<TradeRaw[]>(`/api/v3/trades?symbol=${symbol}&limit=18`),
    json<PremiumRaw>(`${FUTURES}/fapi/v1/premiumIndex?symbol=${symbol}`),
    json<OpenInterestRaw>(`${FUTURES}/fapi/v1/openInterest?symbol=${symbol}`),
    json<LSRaw>(
      `${FUTURES}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`,
    ),
  ]);

  const num = ([p, q]: [string, string]) => ({ price: Number(p), qty: Number(q) });

  return Response.json(
    {
      supported: true,
      symbol,
      bids: (depth?.bids ?? []).map(num),
      asks: (depth?.asks ?? []).map(num),
      trades: (trades ?? [])
        .slice()
        .reverse()
        .map((t) => ({
          price: Number(t.price),
          qty: Number(t.qty),
          time: t.time,
          // isBuyerMaker true means the taker sold into the bid.
          side: t.isBuyerMaker ? ("sell" as const) : ("buy" as const),
        })),
      funding: premium ? Number(premium.lastFundingRate) * 100 : null,
      markPrice: premium ? Number(premium.markPrice) : null,
      nextFundingTime: premium?.nextFundingTime ?? null,
      openInterest: oi ? Number(oi.openInterest) : null,
      longAccount: ls?.[0] ? Number(ls[0].longAccount) * 100 : null,
      shortAccount: ls?.[0] ? Number(ls[0].shortAccount) * 100 : null,
      longShortRatio: ls?.[0] ? Number(ls[0].longShortRatio) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
