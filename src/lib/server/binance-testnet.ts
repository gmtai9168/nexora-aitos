import crypto from "node:crypto";

/**
 * Binance USDⓈ-M Futures **Testnet** client.
 *
 * Server-only. The API secret is read from an environment variable, used to
 * sign requests here, and never leaves the server — no route returns it and
 * the browser never sees it. The base URL is hard-coded to the testnet host,
 * so even a mistaken caller cannot reach the real exchange from this module.
 */

const BASE = "https://testnet.binancefuture.com";

export type TestnetError = { ok: false; status: number; code?: number; message: string };
export type TestnetOk<T> = { ok: true; data: T };
export type TestnetResult<T> = TestnetOk<T> | TestnetError;

function creds(): { key: string; secret: string } | null {
  const key = process.env.BINANCE_TESTNET_KEY?.trim();
  const secret = process.env.BINANCE_TESTNET_SECRET?.trim();
  if (!key || !secret) return null;
  return { key, secret };
}

export function isConfigured(): boolean {
  return creds() !== null;
}

/** Cached (serverTime − localTime) offset so signed calls survive clock skew. */
let clockOffset = 0;
let clockCheckedAt = 0;

async function syncClock(): Promise<void> {
  if (Date.now() - clockCheckedAt < 60_000) return;
  try {
    const res = await fetch(`${BASE}/fapi/v1/time`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const { serverTime } = (await res.json()) as { serverTime: number };
      clockOffset = serverTime - Date.now();
      clockCheckedAt = Date.now();
    }
  } catch {
    /* keep the previous offset */
  }
}

/** Public (unsigned) GET — used for ping, time, price. */
export async function publicGet<T>(path: string): Promise<TestnetResult<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, code: body?.code, message: body?.msg ?? "request failed" };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "network error" };
  }
}

type Method = "GET" | "POST" | "DELETE";

/** Signed request. Params are HMAC-SHA256 signed with the secret, server-side. */
async function signed<T>(
  method: Method,
  path: string,
  params: Record<string, string | number | boolean> = {},
): Promise<TestnetResult<T>> {
  const c = creds();
  if (!c) {
    return {
      ok: false,
      status: 401,
      message:
        "ยังไม่ได้ตั้งค่า API Key ของ Testnet — ตั้ง BINANCE_TESTNET_KEY และ BINANCE_TESTNET_SECRET ในสภาพแวดล้อมของเซิร์ฟเวอร์",
    };
  }

  await syncClock();
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, String(v));
  query.set("timestamp", String(Date.now() + clockOffset));
  query.set("recvWindow", "5000");

  const qs = query.toString();
  const signature = crypto.createHmac("sha256", c.secret).update(qs).digest("hex");
  const url = `${BASE}${path}?${qs}&signature=${signature}`;

  try {
    const res = await fetch(url, {
      method,
      headers: { "X-MBX-APIKEY": c.key },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    const body = await res.json();
    if (!res.ok) {
      return { ok: false, status: res.status, code: body?.code, message: body?.msg ?? "request failed" };
    }
    return { ok: true, data: body as T };
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof Error ? e.message : "network error" };
  }
}

/* ------------------------------------------------------------------ *
 * Typed endpoints
 * ------------------------------------------------------------------ */

export type AccountAsset = { asset: string; walletBalance: string; availableBalance: string; unrealizedProfit: string };
export type AccountRaw = {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  availableBalance: string;
  assets: AccountAsset[];
  canTrade: boolean;
};

export type PositionRaw = {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  positionSide: string;
};

export type OrderRaw = {
  orderId: number;
  symbol: string;
  status: string;
  side: string;
  type: string;
  origQty: string;
  price: string;
  avgPrice: string;
  executedQty: string;
  reduceOnly: boolean;
  time?: number;
  updateTime?: number;
};

export const ping = () => publicGet<Record<string, never>>("/fapi/v1/ping");
export const serverTime = () => publicGet<{ serverTime: number }>("/fapi/v1/time");
export const markPrice = (symbol: string) =>
  publicGet<{ symbol: string; markPrice: string; indexPrice: string }>(`/fapi/v1/premiumIndex?symbol=${symbol}`);

export type Kline = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** Public candles from the testnet feed — signals run on the same prices we trade. */
export async function klines(symbol: string, interval: string, limit: number): Promise<TestnetResult<Kline[]>> {
  const res = await publicGet<(string | number)[][]>(
    `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
  );
  if (!res.ok) return res;
  return {
    ok: true,
    data: res.data.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
      volume: Number(k[5]),
    })),
  };
}

/* Symbol precision — Binance rejects orders whose quantity has too many
 * decimals or falls below the minimum, so it must be rounded to the book. */
type SymbolRule = { quantityPrecision: number; minQty: number; stepSize: number };
let ruleCache: Map<string, SymbolRule> | null = null;
let ruleCachedAt = 0;

async function symbolRules(): Promise<Map<string, SymbolRule>> {
  if (ruleCache && Date.now() - ruleCachedAt < 3_600_000) return ruleCache;
  const res = await publicGet<{
    symbols: {
      symbol: string;
      quantityPrecision: number;
      filters: { filterType: string; minQty?: string; stepSize?: string }[];
    }[];
  }>("/fapi/v1/exchangeInfo");
  const map = new Map<string, SymbolRule>();
  if (res.ok) {
    for (const s of res.data.symbols) {
      const lot = s.filters.find((f) => f.filterType === "LOT_SIZE");
      map.set(s.symbol, {
        quantityPrecision: s.quantityPrecision,
        minQty: Number(lot?.minQty ?? 0),
        stepSize: Number(lot?.stepSize ?? 0),
      });
    }
    ruleCache = map;
    ruleCachedAt = Date.now();
  }
  return map;
}

/** Rounds a raw quantity down to the symbol's step size; null if below minimum. */
export async function roundQuantity(symbol: string, raw: number): Promise<number | null> {
  const rules = await symbolRules();
  const rule = rules.get(symbol);
  if (!rule) return Number(raw.toFixed(3));
  const step = rule.stepSize || Math.pow(10, -rule.quantityPrecision);
  const rounded = Math.floor(raw / step) * step;
  const qty = Number(rounded.toFixed(rule.quantityPrecision));
  if (qty < rule.minQty || qty <= 0) return null;
  return qty;
}

export const account = () => signed<AccountRaw>("GET", "/fapi/v2/account");
export const positions = () => signed<PositionRaw[]>("GET", "/fapi/v2/positionRisk");
export const openOrders = (symbol?: string) =>
  signed<OrderRaw[]>("GET", "/fapi/v1/openOrders", symbol ? { symbol } : {});

export const setLeverage = (symbol: string, leverage: number) =>
  signed<{ leverage: number; symbol: string; maxNotionalValue: string }>("POST", "/fapi/v1/leverage", {
    symbol,
    leverage,
  });

export function placeOrder(o: {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  reduceOnly?: boolean;
}) {
  const params: Record<string, string | number | boolean> = {
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    quantity: o.quantity,
  };
  if (o.reduceOnly) params.reduceOnly = "true";
  if (o.type === "LIMIT") {
    params.price = o.price!;
    params.timeInForce = "GTC";
  }
  return signed<OrderRaw>("POST", "/fapi/v1/order", params);
}

export const cancelOrder = (symbol: string, orderId: number) =>
  signed<OrderRaw>("DELETE", "/fapi/v1/order", { symbol, orderId });

export const cancelAll = (symbol: string) =>
  signed<{ code: number; msg: string }>("DELETE", "/fapi/v1/allOpenOrders", { symbol });

export const TESTNET_BASE = BASE;
