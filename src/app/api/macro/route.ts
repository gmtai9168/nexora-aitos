import { getCryptoQuotes } from "@/lib/server/binance";
import { getStockQuotes } from "@/lib/server/yahoo";
import type { Quote } from "@/lib/types";

/** This route fans out to several upstream APIs, so it needs headroom. */
export const maxDuration = 30;

export type MacroRow = {
  symbol: string;
  label: string;
  th: string;
  group: string;
  region?: string;
  price: number;
  changePct: number;
  currency: string;
};

/** Everything the macro desk watches, in one basket. */
const BASKET: { symbol: string; label: string; th: string; group: string; region?: string }[] = [
  // Equity indices
  { symbol: "^GSPC", label: "S&P 500", th: "เอสแอนด์พี 500", group: "index", region: "us" },
  { symbol: "^IXIC", label: "NASDAQ", th: "แนสแด็ก", group: "index", region: "us" },
  { symbol: "^DJI", label: "DOW JONES", th: "ดาวโจนส์", group: "index", region: "us" },
  { symbol: "^GDAXI", label: "DAX", th: "ดักซ์ เยอรมนี", group: "index", region: "eu" },
  { symbol: "^FTSE", label: "FTSE 100", th: "ฟุตซี่ อังกฤษ", group: "index", region: "uk" },
  { symbol: "^N225", label: "NIKKEI 225", th: "นิกเกอิ ญี่ปุ่น", group: "index", region: "jp" },
  { symbol: "^HSI", label: "HANG SENG", th: "ฮั่งเส็ง ฮ่องกง", group: "index", region: "hk" },
  { symbol: "^SET.BK", label: "SET", th: "ตลาดหุ้นไทย", group: "index", region: "th" },

  // Rates and volatility
  { symbol: "^TNX", label: "US 10Y", th: "พันธบัตรสหรัฐ 10 ปี", group: "rate" },
  { symbol: "^FVX", label: "US 5Y", th: "พันธบัตรสหรัฐ 5 ปี", group: "rate" },
  { symbol: "^TYX", label: "US 30Y", th: "พันธบัตรสหรัฐ 30 ปี", group: "rate" },
  { symbol: "^VIX", label: "VIX", th: "ดัชนีความกลัว", group: "vol" },

  // Currencies
  { symbol: "DX-Y.NYB", label: "DXY", th: "ดัชนีดอลลาร์", group: "fx" },
  { symbol: "EURUSD=X", label: "EUR/USD", th: "ยูโร", group: "fx" },
  { symbol: "JPY=X", label: "USD/JPY", th: "เยน", group: "fx" },
  { symbol: "GBPUSD=X", label: "GBP/USD", th: "ปอนด์", group: "fx" },
  { symbol: "THB=X", label: "USD/THB", th: "บาท", group: "fx" },

  // Commodities
  { symbol: "GC=F", label: "GOLD", th: "ทองคำ", group: "commodity" },
  { symbol: "SI=F", label: "SILVER", th: "เงิน", group: "commodity" },
  { symbol: "CL=F", label: "WTI OIL", th: "น้ำมันดิบ", group: "commodity" },

  // Spot crypto ETFs — the closest public proxy for institutional flow
  { symbol: "IBIT", label: "IBIT", th: "BlackRock Bitcoin ETF", group: "etf" },
  { symbol: "FBTC", label: "FBTC", th: "Fidelity Bitcoin ETF", group: "etf" },
  { symbol: "GBTC", label: "GBTC", th: "Grayscale Bitcoin Trust", group: "etf" },
  { symbol: "ETHA", label: "ETHA", th: "BlackRock Ethereum ETF", group: "etf" },
];

/** Stablecoin pegs read straight off Binance. */
const STABLES = ["USDCUSDT", "FDUSDUSDT", "TUSDUSDT"];

export async function GET() {
  const [stocks, stables] = await Promise.all([
    getStockQuotes(BASKET.map((b) => b.symbol)).catch(() => [] as Quote[]),
    getCryptoQuotes(STABLES).catch(() => [] as Quote[]),
  ]);

  const bySymbol = new Map(stocks.map((q) => [q.symbol, q]));

  const rows: MacroRow[] = [];
  for (const b of BASKET) {
    const q = bySymbol.get(b.symbol);
    if (!q) continue;
    rows.push({
      symbol: b.symbol,
      label: b.label,
      th: b.th,
      group: b.group,
      region: b.region,
      price: q.price,
      changePct: q.changePct,
      currency: q.currency,
    });
  }

  return Response.json(
    {
      rows,
      stablecoins: stables.map((s) => ({
        symbol: s.symbol.replace("USDT", ""),
        price: s.price,
        changePct: s.changePct,
        volume: s.quoteVolume,
      })),
      ts: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
