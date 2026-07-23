import type { DepthLevel } from "./use-coin-intel";

export type Venue = {
  id: string;
  name: string;
  fee: number;
  price: number | null;
  latency: number;
  online: boolean;
};

export type OrderType = "MARKET" | "LIMIT" | "STOP" | "OCO" | "TWAP" | "VWAP";
export type OrderSide = "BUY" | "SELL";
export type OrderStatus =
  | "pending"
  | "routing"
  | "sent"
  | "accepted"
  | "partial"
  | "filled"
  | "rejected"
  | "cancelled";

export type ExecStep = {
  at: number;
  label: string;
  labelTh: string;
  detail: string;
};

export type Order = {
  id: string;
  createdAt: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  /** Volume-weighted price actually achieved across the consumed book. */
  avgFillPrice: number | null;
  filledQty: number;
  status: OrderStatus;
  venue: string;
  venueLatency: number;
  slippagePct: number | null;
  feePct: number;
  feePaid: number;
  reduceOnly: boolean;
  postOnly: boolean;
  takeProfit: number | null;
  stopLoss: number | null;
  source: "AI" | "MANUAL";
  aiName: string;
  steps: ExecStep[];
  response: { code: string; message: string; ok: boolean } | null;
  routingReason: string;
};

/**
 * Walks the real order book to find the volume-weighted price a market order
 * of this size would actually get. This is measured slippage, not a guess —
 * if the book is too thin to fill the size, it reports a partial fill.
 */
export function walkBook(
  levels: DepthLevel[],
  qty: number,
): { avgPrice: number | null; filled: number; exhausted: boolean } {
  if (levels.length === 0 || qty <= 0) {
    return { avgPrice: null, filled: 0, exhausted: true };
  }

  let remaining = qty;
  let notional = 0;
  let filled = 0;

  for (const level of levels) {
    const take = Math.min(remaining, level.qty);
    notional += take * level.price;
    filled += take;
    remaining -= take;
    if (remaining <= 1e-12) break;
  }

  return {
    avgPrice: filled > 0 ? notional / filled : null,
    filled,
    exhausted: remaining > 1e-12,
  };
}

export type RoutingChoice = {
  venue: Venue;
  score: number;
  reason: string;
  ranked: { venue: Venue; score: number; liquidity: number }[];
};

/**
 * Smart Order Routing.
 *
 * Scores every reachable venue on the three things that decide fill quality:
 * the price it is quoting for our side, its taker fee, and its measured
 * round-trip latency. Offline venues are excluded rather than guessed at.
 */
export function routeOrder(
  venues: Venue[],
  side: OrderSide,
  referencePrice: number | null,
): RoutingChoice | null {
  const live = venues.filter((v) => v.online && v.price !== null);
  if (live.length === 0) return null;

  const prices = live.map((v) => v.price!);
  const best = side === "BUY" ? Math.min(...prices) : Math.max(...prices);
  const worst = side === "BUY" ? Math.max(...prices) : Math.min(...prices);
  const spread = Math.abs(worst - best) || 1;

  const fees = live.map((v) => v.fee);
  const minFee = Math.min(...fees);
  const maxFee = Math.max(...fees);
  const latencies = live.map((v) => v.latency);
  const minLat = Math.min(...latencies);
  const maxLat = Math.max(...latencies);

  const ranked = live
    .map((venue) => {
      // Price advantage over the worst quote, normalised to the spread.
      const priceEdge = (Math.abs(venue.price! - worst) / spread) * 100;
      const feeScore =
        maxFee === minFee ? 100 : ((maxFee - venue.fee) / (maxFee - minFee)) * 100;
      const latScore =
        maxLat === minLat ? 100 : ((maxLat - venue.latency) / (maxLat - minLat)) * 100;
      // A venue quoting far from consensus is quoting a thin book.
      const drift = referencePrice
        ? Math.abs(venue.price! - referencePrice) / referencePrice
        : 0;
      const liquidity = Math.max(0, Math.min(100, 100 - drift * 4000));

      return {
        venue,
        liquidity,
        score: priceEdge * 0.45 + latScore * 0.25 + feeScore * 0.15 + liquidity * 0.15,
      };
    })
    .sort((a, b) => b.score - a.score);

  const winner = ranked[0];
  const runnerUp = ranked[1];

  const reason = runnerUp
    ? `เลือก ${winner.venue.name} เพราะราคาฝั่ง${side === "BUY" ? "ซื้อ" : "ขาย"}ดีที่สุด ` +
      `(${winner.venue.price!.toLocaleString()}) หน่วงเวลา ${winner.venue.latency} ms ` +
      `ค่าธรรมเนียม ${winner.venue.fee}% — คะแนนรวม ${winner.score.toFixed(1)} ` +
      `เหนือ ${runnerUp.venue.name} ที่ ${runnerUp.score.toFixed(1)}`
    : `มีเพียง ${winner.venue.name} ที่เชื่อมต่อได้ในขณะนี้`;

  return { venue: winner.venue, score: winner.score, reason, ranked };
}

let seq = 0;
export function nextOrderId(): string {
  seq += 1;
  return `NX-${String(seq).padStart(6, "0")}`;
}

export const ORDER_TYPES: { key: OrderType; th: string }[] = [
  { key: "MARKET", th: "ตลาด" },
  { key: "LIMIT", th: "จำกัดราคา" },
  { key: "STOP", th: "หยุดขาดทุน" },
  { key: "OCO", th: "OCO" },
  { key: "TWAP", th: "TWAP" },
  { key: "VWAP", th: "VWAP" },
];

export const STATUS_META: Record<
  OrderStatus,
  { th: string; en: string; tone: "up" | "down" | "warn" | "neutral" }
> = {
  pending: { th: "รอส่ง", en: "Pending", tone: "warn" },
  routing: { th: "เลือกตลาด", en: "Routing", tone: "warn" },
  sent: { th: "ส่งแล้ว", en: "Sent", tone: "neutral" },
  accepted: { th: "ตลาดรับแล้ว", en: "Accepted", tone: "neutral" },
  partial: { th: "จับคู่บางส่วน", en: "Partial", tone: "warn" },
  filled: { th: "จับคู่ครบ", en: "Filled", tone: "up" },
  rejected: { th: "ถูกปฏิเสธ", en: "Rejected", tone: "down" },
  cancelled: { th: "ยกเลิก", en: "Cancelled", tone: "neutral" },
};

export type ExecStats = {
  total: number;
  filled: number;
  partial: number;
  rejected: number;
  cancelled: number;
  pending: number;
  fillRate: number;
  avgLatency: number;
  avgSlippage: number;
  makerPct: number;
  avgFee: number;
  volume: number;
};

export function computeStats(orders: Order[]): ExecStats {
  const done = orders.filter((o) => o.status === "filled" || o.status === "partial");
  const latencies = orders.filter((o) => o.venueLatency > 0).map((o) => o.venueLatency);
  const slips = done.filter((o) => o.slippagePct !== null).map((o) => o.slippagePct!);
  const maker = orders.filter((o) => o.postOnly || o.type === "LIMIT").length;

  const volume = done.reduce(
    (a, o) => a + o.filledQty * (o.avgFillPrice ?? o.limitPrice ?? 0),
    0,
  );

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    total: orders.length,
    filled: orders.filter((o) => o.status === "filled").length,
    partial: orders.filter((o) => o.status === "partial").length,
    rejected: orders.filter((o) => o.status === "rejected").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    pending: orders.filter((o) =>
      ["pending", "routing", "sent", "accepted"].includes(o.status),
    ).length,
    fillRate: orders.length
      ? (orders.filter((o) => o.status === "filled").length / orders.length) * 100
      : 0,
    avgLatency: avg(latencies),
    avgSlippage: avg(slips),
    makerPct: orders.length ? (maker / orders.length) * 100 : 0,
    avgFee: avg(done.map((o) => o.feePct)),
    volume,
  };
}

export type ExecQuality = {
  execution: number;
  routing: number;
  liquidity: number;
  slippage: number;
  fillQuality: number;
  overall: number;
  verdict: string;
};

/** Grades the engine on its own measured record — no fixed numbers. */
export function executionQuality(stats: ExecStats, routing: RoutingChoice | null): ExecQuality {
  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  const slippage = clamp(100 - Math.abs(stats.avgSlippage) * 900);
  const execution = clamp(100 - stats.avgLatency / 12);
  const routingScore = routing ? clamp(routing.score) : 50;
  const liquidity = routing ? clamp(routing.ranked[0]?.liquidity ?? 50) : 50;
  const fillQuality = clamp(stats.fillRate);

  const overall =
    execution * 0.2 + routingScore * 0.2 + liquidity * 0.2 + slippage * 0.25 + fillQuality * 0.15;

  return {
    execution,
    routing: routingScore,
    liquidity,
    slippage,
    fillQuality,
    overall,
    verdict:
      overall >= 85 ? "ดีเยี่ยม" : overall >= 70 ? "ดี" : overall >= 55 ? "พอใช้" : "ควรปรับปรุง",
  };
}
