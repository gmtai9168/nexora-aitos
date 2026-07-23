import { searchSymbols } from "@/lib/server/yahoo";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 1) return Response.json({ results: [] });

  const results = await searchSymbols(q);
  return Response.json(
    { results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
