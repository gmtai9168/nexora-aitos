import type { AssetClass } from "./types";

export type Listing = {
  symbol: string;
  display: string;
  name: string;
  nameTh?: string;
  assetClass: AssetClass;
  /** Badge tint — mirrors the coin/exchange colour used in the header chips. */
  color: string;
};

/** The five pinned tickers in the top bar. */
export const HEADER_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
];

export const CRYPTO: Listing[] = [
  ["BTCUSDT", "BTC/USDT", "Bitcoin", "#f7931a"],
  ["ETHUSDT", "ETH/USDT", "Ethereum", "#627eea"],
  ["SOLUSDT", "SOL/USDT", "Solana", "#14f195"],
  ["BNBUSDT", "BNB/USDT", "BNB", "#f0b90b"],
  ["XRPUSDT", "XRP/USDT", "XRP", "#8fa5b5"],
  ["DOGEUSDT", "DOGE/USDT", "Dogecoin", "#c3a634"],
  ["ADAUSDT", "ADA/USDT", "Cardano", "#0033ad"],
  ["AVAXUSDT", "AVAX/USDT", "Avalanche", "#e84142"],
  ["LINKUSDT", "LINK/USDT", "Chainlink", "#2a5ada"],
  ["TONUSDT", "TON/USDT", "Toncoin", "#0098ea"],
  ["TRXUSDT", "TRX/USDT", "TRON", "#eb0029"],
  ["DOTUSDT", "DOT/USDT", "Polkadot", "#e6007a"],
  ["MATICUSDT", "MATIC/USDT", "Polygon", "#8247e5"],
  ["NEARUSDT", "NEAR/USDT", "NEAR", "#00c1de"],
  ["ATOMUSDT", "ATOM/USDT", "Cosmos", "#5064fb"],
  ["LTCUSDT", "LTC/USDT", "Litecoin", "#a6a9aa"],
  ["UNIUSDT", "UNI/USDT", "Uniswap", "#ff007a"],
  ["APTUSDT", "APT/USDT", "Aptos", "#4bb6a8"],
  ["ARBUSDT", "ARB/USDT", "Arbitrum", "#12aaff"],
  ["OPUSDT", "OP/USDT", "Optimism", "#ff0420"],
  ["INJUSDT", "INJ/USDT", "Injective", "#00c2ff"],
  ["SUIUSDT", "SUI/USDT", "Sui", "#4da2ff"],
  ["FILUSDT", "FIL/USDT", "Filecoin", "#0090ff"],
  ["ETCUSDT", "ETC/USDT", "Ethereum Classic", "#3ab83a"],
].map(([symbol, display, name, color]) => ({
  symbol,
  display,
  name,
  assetClass: "crypto" as const,
  color,
}));

/** SET50 core names — Yahoo serves these under the .BK suffix. */
export const TH_STOCKS: Listing[] = [
  ["PTT.BK", "PTT", "PTT PCL", "ปตท.", "#00a0e9"],
  ["AOT.BK", "AOT", "Airports of Thailand", "ท่าอากาศยานไทย", "#0f7ac4"],
  ["ADVANC.BK", "ADVANC", "Advanced Info Service", "แอดวานซ์ อินโฟร์", "#00b04f"],
  ["CPALL.BK", "CPALL", "CP All", "ซีพี ออลล์", "#d4232e"],
  ["KBANK.BK", "KBANK", "Kasikornbank", "ธ.กสิกรไทย", "#00a950"],
  ["SCB.BK", "SCB", "SCB X", "เอสซีบี เอกซ์", "#4b2e83"],
  ["BBL.BK", "BBL", "Bangkok Bank", "ธ.กรุงเทพ", "#1a4f9c"],
  ["PTTEP.BK", "PTTEP", "PTT Exploration & Production", "ปตท.สผ.", "#00a0e9"],
  ["GULF.BK", "GULF", "Gulf Development", "กัลฟ์", "#e8791f"],
  ["DELTA.BK", "DELTA", "Delta Electronics", "เดลต้า", "#0067b1"],
  ["CPN.BK", "CPN", "Central Pattana", "เซ็นทรัลพัฒนา", "#c8102e"],
  ["BDMS.BK", "BDMS", "Bangkok Dusit Medical", "กรุงเทพดุสิตเวชการ", "#00a3ad"],
  ["SCC.BK", "SCC", "Siam Cement", "ปูนซิเมนต์ไทย", "#d81f26"],
  ["MINT.BK", "MINT", "Minor International", "ไมเนอร์", "#8c6239"],
  ["TRUE.BK", "TRUE", "True Corporation", "ทรู คอร์ปอเรชั่น", "#e2231a"],
  ["KTB.BK", "KTB", "Krung Thai Bank", "ธ.กรุงไทย", "#00a1e0"],
  ["BH.BK", "BH", "Bumrungrad Hospital", "บำรุงราษฎร์", "#0057a8"],
  ["OR.BK", "OR", "PTT Oil and Retail", "โออาร์", "#00a0e9"],
  ["EA.BK", "EA", "Energy Absolute", "พลังงานบริสุทธิ์", "#7ac143"],
  ["TU.BK", "TU", "Thai Union Group", "ไทยยูเนี่ยน", "#0072bc"],
  ["^SET.BK", "SET", "SET Index", "ดัชนีตลาดหลักทรัพย์", "#16e0a0"],
].map(([symbol, display, name, nameTh, color]) => ({
  symbol,
  display,
  name,
  nameTh,
  assetClass: "th" as const,
  color,
}));

/** US mega-caps plus the indices/commodities the desk watches. */
export const GLOBAL_STOCKS: Listing[] = [
  ["AAPL", "AAPL", "Apple Inc.", "แอปเปิล", "#a2aaad"],
  ["MSFT", "MSFT", "Microsoft", "ไมโครซอฟท์", "#00a4ef"],
  ["NVDA", "NVDA", "NVIDIA", "เอ็นวิเดีย", "#76b900"],
  ["GOOGL", "GOOGL", "Alphabet", "อัลฟาเบท", "#4285f4"],
  ["AMZN", "AMZN", "Amazon", "อเมซอน", "#ff9900"],
  ["META", "META", "Meta Platforms", "เมตา", "#0866ff"],
  ["TSLA", "TSLA", "Tesla", "เทสลา", "#cc0000"],
  ["AMD", "AMD", "AMD", "เอเอ็มดี", "#ed1c24"],
  ["NFLX", "NFLX", "Netflix", "เน็ตฟลิกซ์", "#e50914"],
  ["COIN", "COIN", "Coinbase", "คอยน์เบส", "#0052ff"],
  ["MSTR", "MSTR", "MicroStrategy", "ไมโครสแตรทิจี", "#f7931a"],
  ["JPM", "JPM", "JPMorgan Chase", "เจพีมอร์แกน", "#1264a3"],
  ["BABA", "BABA", "Alibaba", "อาลีบาบา", "#ff6a00"],
  ["TSM", "TSM", "TSMC", "ทีเอสเอ็มซี", "#c8102e"],
  ["^GSPC", "S&P 500", "S&P 500 Index", "ดัชนีเอสแอนด์พี 500", "#16e0a0"],
  ["^IXIC", "NASDAQ", "Nasdaq Composite", "ดัชนีแนสแด็ก", "#29c8ff"],
  ["^DJI", "DOW", "Dow Jones Industrial", "ดัชนีดาวโจนส์", "#8fa5b5"],
  ["^N225", "NIKKEI", "Nikkei 225", "ดัชนีนิกเกอิ", "#bc002d"],
  ["GC=F", "GOLD", "Gold Futures", "ทองคำล่วงหน้า", "#ffb020"],
  ["CL=F", "WTI", "Crude Oil WTI", "น้ำมันดิบ WTI", "#6b8497"],
  ["THB=X", "USD/THB", "US Dollar / Thai Baht", "ดอลลาร์ / บาท", "#14e2a0"],
].map(([symbol, display, name, nameTh, color]) => ({
  symbol,
  display,
  name,
  nameTh,
  assetClass: "global" as const,
  color,
}));

export const ALL_LISTINGS = [...CRYPTO, ...TH_STOCKS, ...GLOBAL_STOCKS];

const BY_SYMBOL = new Map(ALL_LISTINGS.map((l) => [l.symbol, l]));

export function findListing(symbol: string): Listing | undefined {
  return BY_SYMBOL.get(symbol);
}

/** Two-letter badge, e.g. BTC/USDT -> "B", PTT -> "PT". */
export function badgeText(l: Listing): string {
  if (l.assetClass === "crypto") return l.display.split("/")[0].slice(0, 1);
  return l.display.replace(/[^A-Za-z0-9]/g, "").slice(0, 2) || "?";
}
