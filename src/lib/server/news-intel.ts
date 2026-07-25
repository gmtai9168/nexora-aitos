import Anthropic from "@anthropic-ai/sdk";
import { kvGetJson, kvSetJsonEx } from "./kv";

/**
 * Deep news layer for the autonomous trader.
 *
 * Two honest tiers:
 *   • DEEP — a real LLM (Claude) reads recent headlines for the asset and
 *     judges near-term directional bias, how market-moving it is, and whether
 *     a genuine high-impact event is imminent. Costs money per read; requires
 *     ANTHROPIC_API_KEY in the environment.
 *   • SURFACE — no key set: fall back to keyword bias on the same headlines,
 *     with a low, clearly-labelled weight. Never pretends to be the LLM.
 *
 * What this is NOT: a way to trade before the market. By the time any REST
 * feed reaches us, professional low-latency systems have already moved price.
 * The value here is *understanding* the news (a confluence factor) and
 * *avoiding* trading into a high-impact event (a lockout), not front-running.
 *
 * Cost is contained: each asset's read is cached for NEWS_TTL_SEC (in KV when
 * configured, else in-process), so a burst of cycles reuses one analysis.
 */

const NEWS_TTL_SEC = 300; // 5 minutes — one paid read per asset per window
const HEADLINE_COUNT = 8;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/** Human names help the model reason; USDT-pair symbol → base asset. */
const ASSET: Record<string, { code: string; name: string }> = {
  BTCUSDT: { code: "BTC", name: "Bitcoin" },
  ETHUSDT: { code: "ETH", name: "Ethereum" },
  SOLUSDT: { code: "SOL", name: "Solana" },
  BNBUSDT: { code: "BNB", name: "BNB" },
  XRPUSDT: { code: "XRP", name: "XRP" },
  ADAUSDT: { code: "ADA", name: "Cardano" },
  DOGEUSDT: { code: "DOGE", name: "Dogecoin" },
  AVAXUSDT: { code: "AVAX", name: "Avalanche" },
  LINKUSDT: { code: "LINK", name: "Chainlink" },
  DOTUSDT: { code: "DOT", name: "Polkadot" },
  LTCUSDT: { code: "LTC", name: "Litecoin" },
  TRXUSDT: { code: "TRX", name: "TRON" },
  BCHUSDT: { code: "BCH", name: "Bitcoin Cash" },
  ETCUSDT: { code: "ETC", name: "Ethereum Classic" },
  XLMUSDT: { code: "XLM", name: "Stellar" },
  ATOMUSDT: { code: "ATOM", name: "Cosmos" },
  NEARUSDT: { code: "NEAR", name: "NEAR Protocol" },
  UNIUSDT: { code: "UNI", name: "Uniswap" },
  FILUSDT: { code: "FIL", name: "Filecoin" },
  APTUSDT: { code: "APT", name: "Aptos" },
  ARBUSDT: { code: "ARB", name: "Arbitrum" },
  OPUSDT: { code: "OP", name: "Optimism" },
  INJUSDT: { code: "INJ", name: "Injective" },
  AAVEUSDT: { code: "AAVE", name: "Aave" },
};

export type NewsBias = "bullish" | "bearish" | "neutral";

export type NewsIntel = {
  /** true when a real LLM produced this; false = keyword fallback. */
  deep: boolean;
  bias: NewsBias;
  /** 0–100: how market-moving the current news flow is. */
  impact: number;
  /** A genuine imminent high-volatility event (CPI, FOMC, ETF ruling, hack…). */
  highImpact: boolean;
  /** The single headline that mattered most, for the log. */
  headline: string;
  /** Short Thai explanation. */
  reason: string;
  ranAt: number;
};

/* ------------------------------------------------------------------ *
 * Headlines — CryptoPanic (paid/dev tier) when a token is set, else the
 * free Yahoo Finance search we already use elsewhere.
 * ------------------------------------------------------------------ */

type Headline = { title: string; at: number };

async function fetchHeadlines(symbol: string): Promise<Headline[]> {
  const asset = ASSET[symbol];
  const code = asset?.code ?? symbol.replace(/USDT$/, "");
  const token = process.env.CRYPTOPANIC_TOKEN;

  if (token) {
    try {
      const res = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${token}&currencies=${code}&public=true&kind=news`,
        { cache: "no-store", signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const data = (await res.json()) as { results?: { title?: string; published_at?: string }[] };
        const items = (data.results ?? [])
          .filter((r) => r.title)
          .map((r) => ({ title: r.title!, at: r.published_at ? Date.parse(r.published_at) : 0 }))
          .slice(0, HEADLINE_COUNT);
        if (items.length) return items;
      }
    } catch {
      /* fall through to the free source */
    }
  }

  // Free fallback: Yahoo Finance search (same source as /api/news).
  try {
    const q = asset?.name ?? code;
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=${HEADLINE_COUNT}`,
      { cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { news?: { title?: string; providerPublishTime?: number }[] };
    return (data.news ?? [])
      .filter((n) => n.title)
      .map((n) => ({ title: n.title!, at: (n.providerPublishTime ?? 0) * 1000 }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ *
 * Analysis
 * ------------------------------------------------------------------ */

const BULLISH = /\b(surge|rally|jump|soar|record|gain|rise|boost|bullish|approv|inflow|beat|upgrade|adopt|etf)\b/i;
const BEARISH = /\b(fall|drop|plunge|slump|sink|loss|crash|bearish|outflow|selloff|sell-off|miss|downgrade|warn|cut|hack|ban|lawsuit|sec)\b/i;

/** Keyword tally when no LLM key is set — honest, low-weight fallback. */
function surfaceIntel(symbol: string, headlines: Headline[]): NewsIntel {
  let bull = 0;
  let bear = 0;
  for (const h of headlines) {
    if (BULLISH.test(h.title)) bull++;
    if (BEARISH.test(h.title)) bear++;
  }
  const bias: NewsBias = bull > bear ? "bullish" : bear > bull ? "bearish" : "neutral";
  const impact = Math.min(40, (bull + bear) * 6); // capped low — keywords aren't understanding
  return {
    deep: false,
    bias,
    impact,
    highImpact: false, // never claim a high-impact event from keywords
    headline: headlines[0]?.title ?? "ไม่มีข่าวเด่น",
    reason: `นับคีย์เวิร์ด: บวก ${bull} · ลบ ${bear} (ยังไม่เปิดข่าวเชิงลึก — ตั้ง ANTHROPIC_API_KEY)`,
    ranAt: Date.now(),
  };
}

const SCHEMA: Anthropic.Tool.InputSchema = {
  type: "object",
  properties: {
    bias: { type: "string", enum: ["bullish", "bearish", "neutral"] },
    impact: { type: "integer", description: "0-100: how market-moving the current flow is for this asset over the next hour" },
    highImpact: { type: "boolean", description: "true only for a genuine imminent high-volatility catalyst (CPI, FOMC, ETF ruling, major hack/exploit, exchange insolvency)" },
    headline: { type: "string", description: "the single most important headline verbatim" },
    reason: { type: "string", description: "one short sentence in Thai" },
  },
  required: ["bias", "impact", "highImpact", "headline", "reason"],
};

let client: Anthropic | null = null;
function anthropic(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

async function deepIntel(symbol: string, headlines: Headline[]): Promise<NewsIntel | null> {
  const ai = anthropic();
  if (!ai || headlines.length === 0) return null;

  const asset = ASSET[symbol];
  const now = Date.now();
  const list = headlines
    .map((h) => `- (${h.at ? Math.round((now - h.at) / 60000) + "m ago" : "recent"}) ${h.title}`)
    .join("\n");

  const prompt =
    `You are a crypto markets news analyst. Assess the near-term (next ~1 hour) impact of these ` +
    `headlines on ${asset?.name ?? symbol} (${asset?.code ?? symbol}).\n\n` +
    `Headlines:\n${list}\n\n` +
    `Be conservative and honest: most headlines are noise. Only set highImpact=true for a genuine ` +
    `imminent high-volatility catalyst. impact should reflect real price relevance, not headline count. ` +
    `Answer strictly in the given JSON schema. Write "reason" in Thai.`;

  try {
    const res = await ai.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 500,
      tools: [{ name: "report_news", description: "Report the near-term news read for the asset.", input_schema: SCHEMA }],
      tool_choice: { type: "tool", name: "report_news" },
      messages: [{ role: "user", content: prompt }],
    });
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!block) return null;
    const parsed = block.input as { bias: NewsBias; impact: number; highImpact: boolean; headline: string; reason: string };
    return {
      deep: true,
      bias: parsed.bias,
      impact: Math.max(0, Math.min(100, Math.round(parsed.impact))),
      highImpact: Boolean(parsed.highImpact),
      headline: parsed.headline || headlines[0]?.title || "",
      reason: parsed.reason || "",
      ranAt: now,
    };
  } catch {
    return null; // any failure → caller falls back to surface, never blocks a cycle
  }
}

/* ------------------------------------------------------------------ *
 * Public: cached per-asset read
 * ------------------------------------------------------------------ */

const mem = new Map<string, NewsIntel>();

/** Whether a real LLM key is present — the UI shows the honest tier. */
export function newsDeepConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function newsIntel(symbol: string): Promise<NewsIntel> {
  const cacheKey = `nexora:news:v1:${symbol}`;

  const cached = await kvGetJson<NewsIntel>(cacheKey);
  if (cached && Date.now() - cached.ranAt < NEWS_TTL_SEC * 1000) return cached;
  const local = mem.get(symbol);
  if (local && Date.now() - local.ranAt < NEWS_TTL_SEC * 1000) return local;

  const headlines = await fetchHeadlines(symbol);
  const intel = (await deepIntel(symbol, headlines)) ?? surfaceIntel(symbol, headlines);

  mem.set(symbol, intel);
  await kvSetJsonEx(cacheKey, intel, NEWS_TTL_SEC);
  return intel;
}

/* ------------------------------------------------------------------ *
 * Turn a read into a confidence factor + a lockout signal
 * ------------------------------------------------------------------ */

export type NewsScore = {
  /** Confidence adjustment in points (bounded), signed by agreement. */
  adj: number;
  factor: { label: string; agree: boolean | null; note: string };
  /** Skip opening: a high-impact event is imminent (deep tier only). */
  lockout: boolean;
};

export function scoreNews(dir: "LONG" | "SHORT", intel: NewsIntel): NewsScore {
  const long = dir === "LONG";
  const lockout = intel.deep && intel.highImpact;

  let adj = 0;
  let agree: boolean | null = null;
  if (intel.bias !== "neutral") {
    agree = (intel.bias === "bullish") === long;
    // Deep reads earn up to ±22; keyword reads are capped low (±8).
    const cap = intel.deep ? 22 : 8;
    const weight = Math.round((intel.impact / 100) * cap);
    adj = agree ? weight : -weight;
  }

  const label = intel.deep ? "ข่าว (AI วิเคราะห์)" : "ข่าว (คีย์เวิร์ด)";
  const biasTh = intel.bias === "bullish" ? "บวก" : intel.bias === "bearish" ? "ลบ" : "กลาง";
  const note = lockout
    ? `⚠ ข่าวแรงใกล้เข้า — งดเปิด: ${intel.headline}`
    : `${biasTh} · แรงกระทบ ${intel.impact}${intel.deep ? "" : " (คีย์เวิร์ด)"}`;

  return { adj, factor: { label, agree, note }, lockout };
}
