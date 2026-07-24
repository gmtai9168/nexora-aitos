import { openOrders } from "@/lib/server/binance-testnet";
import type { OpenOrder } from "@/lib/testnet";

export const maxDuration = 20;

export async function GET() {
  const res = await openOrders();
  if (!res.ok) {
    return Response.json(
      { ok: false, message: res.message },
      { status: res.status || 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const orders: OpenOrder[] = res.data.map((o) => ({
    orderId: o.orderId,
    symbol: o.symbol,
    side: o.side,
    type: o.type,
    status: o.status,
    quantity: Number(o.origQty),
    price: Number(o.price),
    executedQty: Number(o.executedQty),
    reduceOnly: o.reduceOnly,
    time: o.time ?? o.updateTime ?? 0,
  }));

  return Response.json({ ok: true, orders }, { headers: { "Cache-Control": "no-store" } });
}
