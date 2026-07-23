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

type BlockchainStats = {
  hash_rate: number;
  n_tx: number;
  n_blocks_mined: number;
  minutes_between_blocks: number;
  totalbc: number;
  market_price_usd: number;
  trade_volume_usd: number;
  estimated_transaction_volume_usd: number;
  difficulty: number;
};

type Hashrates = {
  hashrates: { timestamp: number; avgHashrate: number }[];
  currentHashrate: number;
  currentDifficulty: number;
};

type Fng = { data: { value: string; value_classification: string }[] };

/**
 * On-chain intelligence.
 *
 * Bitcoin has genuine public chain data (blockchain.info + mempool.space).
 * Everything else gets the market-wide Fear & Greed index only — the route
 * says so rather than inventing per-chain numbers.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  const isBtc = symbol.startsWith("BTC");

  const [stats, rates, fng] = await Promise.all([
    isBtc ? json<BlockchainStats>("https://api.blockchain.info/stats") : null,
    isBtc ? json<Hashrates>("https://mempool.space/api/v1/mining/hashrate/1m") : null,
    json<Fng>("https://api.alternative.me/fng/?limit=8"),
  ]);

  // Hash-rate trend over the returned window — the Hash Ribbon in miniature.
  let hashTrendPct: number | null = null;
  if (rates?.hashrates && rates.hashrates.length > 3) {
    const series = rates.hashrates;
    const first = series[0].avgHashrate;
    const last = series.at(-1)!.avgHashrate;
    if (first) hashTrendPct = ((last - first) / first) * 100;
  }

  const fngNow = fng?.data?.[0] ? Number(fng.data[0].value) : null;
  const fngPrev = fng?.data?.[1] ? Number(fng.data[1].value) : null;

  return Response.json(
    {
      symbol,
      hasChainData: isBtc && stats !== null,
      hashRate: rates?.currentHashrate ?? (stats ? stats.hash_rate * 1e9 : null),
      hashTrendPct,
      difficulty: rates?.currentDifficulty ?? stats?.difficulty ?? null,
      txCount24h: stats?.n_tx ?? null,
      blocksMined24h: stats?.n_blocks_mined ?? null,
      minutesBetweenBlocks: stats?.minutes_between_blocks ?? null,
      circulatingSupply: stats ? stats.totalbc / 1e8 : null,
      onChainVolumeUsd: stats?.estimated_transaction_volume_usd ?? null,
      exchangeVolumeUsd: stats?.trade_volume_usd ?? null,
      fearGreed: fngNow,
      fearGreedPrev: fngPrev,
      fearGreedLabel: fng?.data?.[0]?.value_classification ?? null,
      fearGreedSeries: (fng?.data ?? []).map((d) => Number(d.value)).reverse(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
