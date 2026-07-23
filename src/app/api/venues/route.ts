type Venue = {
  id: string;
  name: string;
  /** Taker fee as a percentage — public spot schedule, base tier. */
  fee: number;
  url: (base: string, quote: string) => string;
  parse: (data: unknown) => number | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Same pair, five books — this is what makes best-price routing real. */
const VENUES: Venue[] = [
  {
    id: "binance",
    name: "Binance",
    fee: 0.1,
    url: (b, q) => `https://api.binance.com/api/v3/ticker/bookTicker?symbol=${b}${q}`,
    parse: (d) => {
      const r = d as { bidPrice?: string; askPrice?: string };
      const bid = num(r.bidPrice);
      const ask = num(r.askPrice);
      return bid && ask ? (bid + ask) / 2 : null;
    },
  },
  {
    id: "bybit",
    name: "Bybit",
    fee: 0.1,
    url: (b, q) => `https://api.bybit.com/v5/market/tickers?category=spot&symbol=${b}${q}`,
    parse: (d) => {
      const r = d as { result?: { list?: { lastPrice?: string }[] } };
      return num(r.result?.list?.[0]?.lastPrice);
    },
  },
  {
    id: "okx",
    name: "OKX",
    fee: 0.1,
    url: (b, q) => `https://www.okx.com/api/v5/market/ticker?instId=${b}-${q}`,
    parse: (d) => {
      const r = d as { data?: { last?: string }[] };
      return num(r.data?.[0]?.last);
    },
  },
  {
    id: "bitget",
    name: "Bitget",
    fee: 0.1,
    url: (b, q) => `https://api.bitget.com/api/v2/spot/market/tickers?symbol=${b}${q}`,
    parse: (d) => {
      const r = d as { data?: { lastPr?: string }[] };
      return num(r.data?.[0]?.lastPr);
    },
  },
  {
    id: "kraken",
    name: "Kraken",
    fee: 0.26,
    url: (b, q) => `https://api.kraken.com/0/public/Ticker?pair=${b}${q === "USDT" ? "USDT" : q}`,
    parse: (d) => {
      const r = d as { result?: Record<string, { c?: string[] }> };
      const first = r.result ? Object.values(r.result)[0] : undefined;
      return num(first?.c?.[0]);
    },
  },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  const match = symbol.match(/^([A-Z0-9]+)(USDT)$/);

  if (!match) {
    return Response.json(
      { symbol, supported: false, venues: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const [, base, quote] = match;

  const venues = await Promise.all(
    VENUES.map(async (v) => {
      const started = Date.now();
      try {
        const res = await fetch(v.url(base, quote), {
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        const latency = Date.now() - started;
        if (!res.ok) {
          return { id: v.id, name: v.name, fee: v.fee, price: null, latency, online: false };
        }
        const price = v.parse(await res.json());
        return {
          id: v.id,
          name: v.name,
          fee: v.fee,
          price,
          latency,
          online: price !== null,
        };
      } catch {
        return {
          id: v.id,
          name: v.name,
          fee: v.fee,
          price: null,
          latency: Date.now() - started,
          online: false,
        };
      }
    }),
  );

  return Response.json(
    { symbol, supported: true, venues, ts: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
