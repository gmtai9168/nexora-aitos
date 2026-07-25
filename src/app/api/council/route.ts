import { AGENTS, GROUPS } from "@/lib/agents";
import { runCouncil } from "@/lib/council";
import { agentWeight, recentBias, EMPTY_MEMORY, type AiMemory } from "@/lib/ai-memory";
import { buildFeatures } from "@/lib/server/features";
import { newsIntel } from "@/lib/server/news-intel";
import { klines } from "@/lib/server/binance-testnet";
import { fearGreed } from "@/lib/server/confluence";
import { kvGetJson } from "@/lib/server/kv";
import { TESTNET_SYMBOLS } from "@/lib/testnet";

export const maxDuration = 30;

/**
 * Live read of the full 50-agent council for one symbol — the same votes and
 * earned weights the autonomous trader uses, exposed for the dashboard so every
 * agent's real work is visible. Read-only: fetches market data, runs the
 * council, returns per-agent votes grouped by pod plus Master AI's net.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") || "BTCUSDT").toUpperCase();
  if (!TESTNET_SYMBOLS.includes(symbol)) {
    return Response.json({ error: "unsupported symbol" }, { status: 400 });
  }

  const kl = await klines(symbol, "5m", 300);
  if (!kl.ok || kl.data.length < 200) {
    return Response.json({ error: "not enough candles" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }

  // Central memory (if configured) supplies earned weights + the RL bias.
  const mem = (await kvGetJson<AiMemory>("nexora:ai-memory:v1")) ?? EMPTY_MEMORY;

  const [fng, news] = await Promise.all([fearGreed(), newsIntel(symbol)]);

  const feats = await buildFeatures({
    symbol,
    candles: kl.data,
    interval: "5m",
    fng,
    newsBias: news.bias === "bullish" ? 1 : news.bias === "bearish" ? -1 : 0,
    newsImpact: news.impact,
    newsDeep: news.deep,
    recentBias: recentBias(mem),
    marginRatio: null,
    dayPnlPct: null,
    openPositions: Object.keys(mem.open ?? {}).length,
    maxPositions: 5,
  });

  const c = runCouncil(feats, (id) => agentWeight(mem, id));
  const byId = new Map(c.votes.map((v) => [v.id, v]));

  const pods = GROUPS.map((g) => ({
    key: g.key,
    th: g.th,
    en: g.en,
    color: g.color,
    agents: AGENTS.filter((a) => a.group === g.key).map((a) => {
      const v = byId.get(a.id);
      return {
        id: a.id,
        name: a.name,
        nameTh: a.nameTh,
        kind: v?.kind ?? "monitor",
        vote: v?.vote ?? 0,
        confidence: v?.confidence ?? 0,
        note: v?.note ?? "",
        ok: v?.ok ?? null,
        weight: Math.round(agentWeight(mem, a.id) * 100) / 100,
      };
    }),
  }));

  return Response.json(
    {
      symbol,
      ranAt: Date.now(),
      master: { dir: c.dir, confidence: c.confidence, supporting: c.supporting, against: c.against, net: Math.round(c.net * 100) },
      deep: news.deep,
      pods,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
