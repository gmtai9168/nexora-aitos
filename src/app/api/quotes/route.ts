import { getCryptoQuotes, DEFAULT_CRYPTO_SYMBOLS } from "@/lib/server/binance";
import { getStockQuotes } from "@/lib/server/yahoo";
import type { Quote } from "@/lib/types";

/** Crypto goes to Binance, everything else to Yahoo — split by symbol shape. */
function isCrypto(symbol: string) {
  return /^[A-Z0-9]+USDT$/.test(symbol);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("symbols");
  const symbols = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_CRYPTO_SYMBOLS;

  const crypto = symbols.filter(isCrypto);
  const stocks = symbols.filter((s) => !isCrypto(s));

  const [cryptoQuotes, stockQuotes] = await Promise.all([
    crypto.length ? getCryptoQuotes(crypto).catch(() => [] as Quote[]) : [],
    stocks.length ? getStockQuotes(stocks).catch(() => [] as Quote[]) : [],
  ]);

  const bySymbol = new Map(
    [...cryptoQuotes, ...stockQuotes].map((q) => [q.symbol, q]),
  );
  const quotes = symbols
    .map((s) => bySymbol.get(s))
    .filter((q): q is Quote => q !== undefined);

  return Response.json(
    { quotes, ts: Date.now() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
