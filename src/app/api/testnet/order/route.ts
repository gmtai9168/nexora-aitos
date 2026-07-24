import {
  cancelOrder,
  markPrice,
  placeOrder,
  setLeverage,
} from "@/lib/server/binance-testnet";
import { riskCheck, RISK_LIMITS, TESTNET_SYMBOLS, type OrderIntent } from "@/lib/testnet";

export const maxDuration = 25;

/**
 * Place a testnet order — but only after the risk gate passes on the server.
 *
 * The browser previews the same check, yet this is the copy that binds: a
 * request that skipped or forged the client preview is re-validated here
 * against a freshly fetched mark price before anything is sent to Binance.
 */
export async function POST(request: Request) {
  let intent: OrderIntent;
  try {
    intent = (await request.json()) as OrderIntent;
  } catch {
    return Response.json({ ok: false, message: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  // Hard allow-list and cap re-checks, independent of the client.
  if (!TESTNET_SYMBOLS.includes(intent.symbol)) {
    return Response.json({ ok: false, message: "สินทรัพย์นี้ไม่อยู่ในรายการที่อนุญาต" }, { status: 400 });
  }
  if (!(intent.leverage >= 1 && intent.leverage <= RISK_LIMITS.maxLeverage)) {
    return Response.json({ ok: false, message: `Leverage ต้องอยู่ระหว่าง 1x ถึง ${RISK_LIMITS.maxLeverage}x` }, { status: 400 });
  }

  const mp = await markPrice(intent.symbol);
  if (!mp.ok) {
    return Response.json({ ok: false, message: `อ่านราคาอ้างอิงไม่ได้: ${mp.message}` }, { status: 502 });
  }
  const refPrice = Number(mp.data.markPrice);

  const verdict = riskCheck(intent, refPrice);
  if (!verdict.ok) {
    const failed = verdict.checks.filter((c) => !c.pass).map((c) => c.label);
    return Response.json(
      { ok: false, message: `Risk Engine ปฏิเสธ: ${failed.join(", ")}`, verdict },
      { status: 422, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Leverage is set before the order so the position opens at the intended size.
  const lev = await setLeverage(intent.symbol, intent.leverage);
  if (!lev.ok) {
    return Response.json({ ok: false, message: `ตั้ง Leverage ไม่สำเร็จ: ${lev.message}` }, { status: lev.status || 502 });
  }

  const order = await placeOrder({
    symbol: intent.symbol,
    side: intent.side,
    type: intent.type,
    quantity: intent.quantity,
    price: intent.price,
    reduceOnly: intent.reduceOnly,
  });

  if (!order.ok) {
    return Response.json(
      { ok: false, message: `กระดานปฏิเสธคำสั่ง: ${order.message}`, code: order.code },
      { status: order.status || 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return Response.json(
    { ok: true, verdict, order: order.data, refPrice },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol");
  const orderId = Number(url.searchParams.get("orderId"));
  if (!symbol || !Number.isFinite(orderId)) {
    return Response.json({ ok: false, message: "ต้องระบุ symbol และ orderId" }, { status: 400 });
  }

  const res = await cancelOrder(symbol, orderId);
  if (!res.ok) {
    return Response.json({ ok: false, message: res.message }, { status: res.status || 502 });
  }
  return Response.json({ ok: true, order: res.data }, { headers: { "Cache-Control": "no-store" } });
}
