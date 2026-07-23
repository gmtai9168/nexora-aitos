const SPOT = "https://api.binance.com";
const FUTURES = "https://fapi.binance.com";

async function json<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Premium = { lastFundingRate: string; markPrice: string; nextFundingTime: number };
type OiPoint = { sumOpenInterest: string; sumOpenInterestValue: string; timestamp: number };
type AggTrade = { p: string; q: string; m: boolean };
type LsPoint = { longAccount: string; shortAccount: string; longShortRatio: string };

/**
 * The evidence behind a Master AI call: funding, open-interest trend, and the
 * taker buy/sell split. Everything here is measured, not modelled.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();

  if (!/^[A-Z0-9]+USDT$/.test(symbol)) {
    return Response.json(
      { supported: false, symbol },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const [premium, oiHist, trades, ls] = await Promise.all([
    json<Premium>(`${FUTURES}/fapi/v1/premiumIndex?symbol=${symbol}`),
    json<OiPoint[]>(
      `${FUTURES}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=13`,
    ),
    json<AggTrade[]>(`${SPOT}/api/v3/aggTrades?symbol=${symbol}&limit=1000`),
    json<LsPoint[]>(
      `${FUTURES}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=5m&limit=1`,
    ),
  ]);

  // Open interest: now vs. one hour ago.
  let oiNow: number | null = null;
  let oiChangePct: number | null = null;
  if (oiHist && oiHist.length >= 2) {
    oiNow = Number(oiHist.at(-1)!.sumOpenInterest);
    const oldest = Number(oiHist[0].sumOpenInterest);
    oiChangePct = oldest ? ((oiNow - oldest) / oldest) * 100 : null;
  }

  // Taker flow: m === false means the buyer was the taker (aggressive buy).
  let buyVol = 0;
  let sellVol = 0;
  let whaleBuy = 0;
  let whaleSell = 0;
  if (trades) {
    const notionals = trades.map((t) => Number(t.p) * Number(t.q));
    const sorted = [...notionals].sort((a, b) => a - b);
    // "Whale" = top decile of this window's trade sizes.
    const whaleFloor = sorted[Math.floor(sorted.length * 0.9)] ?? Infinity;

    trades.forEach((t, i) => {
      const n = notionals[i];
      if (t.m) sellVol += n;
      else buyVol += n;
      if (n >= whaleFloor) {
        if (t.m) whaleSell += n;
        else whaleBuy += n;
      }
    });
  }

  const totalVol = buyVol + sellVol;
  const whaleTotal = whaleBuy + whaleSell;

  return Response.json(
    {
      supported: true,
      symbol,
      funding: premium ? Number(premium.lastFundingRate) * 100 : null,
      markPrice: premium ? Number(premium.markPrice) : null,
      nextFundingTime: premium ? premium.nextFundingTime : null,
      openInterest: oiNow,
      openInterestValue: oiHist?.at(-1)
        ? Number(oiHist.at(-1)!.sumOpenInterestValue)
        : null,
      oiChangePct,
      takerBuyShare: totalVol ? (buyVol / totalVol) * 100 : null,
      whaleBuyShare: whaleTotal ? (whaleBuy / whaleTotal) * 100 : null,
      whaleNotional: whaleTotal || null,
      longAccount: ls?.[0] ? Number(ls[0].longAccount) * 100 : null,
      shortAccount: ls?.[0] ? Number(ls[0].shortAccount) * 100 : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
