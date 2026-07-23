/** This route fans out to several upstream APIs, so it needs headroom. */
export const maxDuration = 30;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

type NewsRaw = {
  news?: {
    uuid?: string;
    title?: string;
    publisher?: string;
    link?: string;
    providerPublishTime?: number;
  }[];
};

const BULLISH = /\b(surge|surges|rally|rallies|jump|jumps|soar|soars|record|high|gain|gains|rise|rises|boost|bullish|approv|inflow|beat|beats|upgrade|adopt)\b/i;
const BEARISH = /\b(fall|falls|drop|drops|plunge|plunges|slump|sink|sinks|loss|losses|crash|bearish|outflow|selloff|sell-off|miss|misses|downgrade|warn|cut|cuts|hack|ban)\b/i;

/** Keyword scoring only — no model runs here, and the UI says so. */
function sentiment(title: string): "บวก" | "ลบ" | "กลาง" {
  const bull = BULLISH.test(title);
  const bear = BEARISH.test(title);
  if (bull && !bear) return "บวก";
  if (bear && !bull) return "ลบ";
  return "กลาง";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const focus = url.searchParams.get("q")?.trim();

  // A symbol-specific query is asked first, then the market-wide backdrop.
  const queries = focus
    ? [focus, `${focus} crypto`, "federal reserve"]
    : ["bitcoin", "stock market", "federal reserve"];

  try {
    const batches = await Promise.all(
      queries.map(async (q) => {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=0&newsCount=6`,
          {
            cache: "no-store",
            headers: { "User-Agent": UA, Accept: "application/json" },
            signal: AbortSignal.timeout(9000),
          },
        );
        if (!res.ok) return [];
        const data = (await res.json()) as NewsRaw;
        return data.news ?? [];
      }),
    );

    const seen = new Set<string>();
    const items = batches
      .flat()
      .filter((n) => n.title && !seen.has(n.title) && seen.add(n.title))
      .map((n) => ({
        id: n.uuid ?? n.title!,
        title: n.title!,
        publisher: n.publisher ?? "",
        link: n.link ?? "",
        time: (n.providerPublishTime ?? 0) * 1000,
        sentiment: sentiment(n.title!),
      }))
      .sort((a, b) => b.time - a.time)
      .slice(0, 12);

    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { items: [] },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
