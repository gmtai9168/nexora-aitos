export type AssetClass = "crypto" | "th" | "global";

export type Quote = {
  symbol: string; // API symbol, e.g. BTCUSDT / PTT.BK / AAPL
  display: string; // what the UI shows, e.g. BTC/USDT
  name: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  open: number;
  prevClose: number;
  volume: number; // base volume
  quoteVolume: number; // turnover in quote currency
  currency: string;
};

export type Candle = {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleResponse = {
  symbol: string;
  interval: string;
  currency: string;
  candles: Candle[];
};
