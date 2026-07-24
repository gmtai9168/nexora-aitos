/**
 * Shared testnet types and the pre-trade risk gate.
 *
 * Both the browser (to preview) and the server (to enforce) run `riskCheck`.
 * The client copy is a courtesy preview; the server copy is the one that
 * actually blocks an order, so a manipulated request cannot skip it.
 */

export type OrderIntent = {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: number;
  price?: number;
  leverage: number;
  reduceOnly: boolean;
};

/** Symbols the desk allows on testnet — an allow-list, not a block-list. */
export const TESTNET_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT"];

/** Caps enforced before any order reaches the exchange. Testnet money, real gate. */
export const RISK_LIMITS = {
  maxLeverage: 20,
  maxNotionalUsd: 5000,
  minNotionalUsd: 5, // Binance futures minimum
};

export type RiskVerdict = {
  ok: boolean;
  notionalUsd: number;
  checks: { label: string; pass: boolean; detail: string }[];
};

export function riskCheck(intent: OrderIntent, refPrice: number): RiskVerdict {
  const price = intent.type === "LIMIT" && intent.price ? intent.price : refPrice;
  const notionalUsd = price * intent.quantity;
  const checks: RiskVerdict["checks"] = [];

  checks.push({
    label: "สินทรัพย์อยู่ในรายการที่อนุญาต",
    pass: TESTNET_SYMBOLS.includes(intent.symbol),
    detail: `${intent.symbol} · อนุญาต ${TESTNET_SYMBOLS.join(", ")}`,
  });
  checks.push({
    label: "Leverage ไม่เกินเพดาน",
    pass: intent.leverage >= 1 && intent.leverage <= RISK_LIMITS.maxLeverage,
    detail: `${intent.leverage}x · เพดาน ${RISK_LIMITS.maxLeverage}x`,
  });
  checks.push({
    label: "จำนวนถูกต้อง",
    pass: intent.quantity > 0,
    detail: `${intent.quantity}`,
  });
  checks.push({
    label: "มูลค่าสถานะไม่เกินเพดาน",
    pass: notionalUsd <= RISK_LIMITS.maxNotionalUsd,
    detail: `${notionalUsd.toFixed(2)} USDT · เพดาน ${RISK_LIMITS.maxNotionalUsd.toLocaleString()} USDT`,
  });
  checks.push({
    label: "มูลค่าถึงขั้นต่ำของกระดาน",
    pass: notionalUsd >= RISK_LIMITS.minNotionalUsd,
    detail: `${notionalUsd.toFixed(2)} USDT · ขั้นต่ำ ${RISK_LIMITS.minNotionalUsd} USDT`,
  });
  if (intent.type === "LIMIT") {
    checks.push({
      label: "ราคา Limit ถูกต้อง",
      pass: !!intent.price && intent.price > 0,
      detail: intent.price ? `${intent.price}` : "ไม่ได้ระบุราคา",
    });
  }

  return { ok: checks.every((c) => c.pass), notionalUsd, checks };
}

/* ------------------------------------------------------------------ *
 * Client-facing DTOs — sanitised shapes the routes return
 * ------------------------------------------------------------------ */

export type TestnetStatus = {
  configured: boolean;
  reachable: boolean;
  latencyMs: number;
  clockSkewMs: number | null;
  canTrade: boolean | null;
  message: string;
};

export type Balance = {
  walletBalance: number;
  availableBalance: number;
  unrealizedPnl: number;
  marginBalance: number;
};

export type Position = {
  symbol: string;
  side: "LONG" | "SHORT";
  size: number;
  notional: number;
  entryPrice: number;
  markPrice: number;
  liquidationPrice: number;
  unrealizedPnl: number;
  leverage: number;
};

export type OpenOrder = {
  orderId: number;
  symbol: string;
  side: string;
  type: string;
  status: string;
  quantity: number;
  price: number;
  executedQty: number;
  reduceOnly: boolean;
  time: number;
};
