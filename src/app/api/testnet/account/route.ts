import { account, positions } from "@/lib/server/binance-testnet";
import type { Balance, Position } from "@/lib/testnet";

export const maxDuration = 20;

/** Wallet balance and open positions — read-only, no secret ever returned. */
export async function GET() {
  const [acc, pos] = await Promise.all([account(), positions()]);

  if (!acc.ok) {
    return Response.json(
      { ok: false, message: acc.message },
      { status: acc.status || 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const balance: Balance = {
    walletBalance: Number(acc.data.totalWalletBalance),
    availableBalance: Number(acc.data.availableBalance),
    unrealizedPnl: Number(acc.data.totalUnrealizedProfit),
    marginBalance: Number(acc.data.totalMarginBalance),
  };

  const open: Position[] = pos.ok
    ? pos.data
        .filter((p) => Number(p.positionAmt) !== 0)
        .map((p) => {
          const amt = Number(p.positionAmt);
          const mark = Number(p.markPrice);
          return {
            symbol: p.symbol,
            side: amt >= 0 ? "LONG" : "SHORT",
            size: Math.abs(amt),
            notional: Math.abs(amt) * mark,
            entryPrice: Number(p.entryPrice),
            markPrice: mark,
            liquidationPrice: Number(p.liquidationPrice),
            unrealizedPnl: Number(p.unRealizedProfit),
            leverage: Number(p.leverage),
          };
        })
    : [];

  return Response.json(
    { ok: true, balance, positions: open },
    { headers: { "Cache-Control": "no-store" } },
  );
}
