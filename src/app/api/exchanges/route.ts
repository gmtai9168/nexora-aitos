type Probe = {
  id: string;
  name: string;
  url: string;
  method?: "GET" | "POST";
  body?: string;
};

/** Cheapest public liveness endpoint each venue exposes. */
const PROBES: Probe[] = [
  { id: "binance", name: "Binance", url: "https://api.binance.com/api/v3/ping" },
  { id: "bybit", name: "Bybit", url: "https://api.bybit.com/v5/market/time" },
  { id: "okx", name: "OKX", url: "https://www.okx.com/api/v5/public/time" },
  { id: "bitget", name: "Bitget", url: "https://api.bitget.com/api/v2/public/time" },
  {
    id: "hyperliquid",
    name: "Hyperliquid",
    url: "https://api.hyperliquid.xyz/info",
    method: "POST",
    body: JSON.stringify({ type: "meta" }),
  },
];

export async function GET() {
  const results = await Promise.all(
    PROBES.map(async (p) => {
      const started = Date.now();
      try {
        const res = await fetch(p.url, {
          method: p.method ?? "GET",
          headers: p.method === "POST" ? { "Content-Type": "application/json" } : undefined,
          body: p.body,
          cache: "no-store",
          signal: AbortSignal.timeout(6000),
        });
        return {
          id: p.id,
          name: p.name,
          online: res.ok,
          latency: Date.now() - started,
          status: res.status,
        };
      } catch {
        return {
          id: p.id,
          name: p.name,
          online: false,
          latency: Date.now() - started,
          status: 0,
        };
      }
    }),
  );

  return Response.json(
    { exchanges: results, ts: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
