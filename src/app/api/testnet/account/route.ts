import { account, positions } from "@/lib/server/binance-testnet";
import { roundTripFee, type Balance, type Position } from "@/lib/testnet";

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

  // P&L is shown net of the estimated round-trip fee — what you'd keep if the
  // position closed now at market. Keeps the numbers honest under fast turnover.
  const open: Position[] = pos.ok
    ? pos.data
        .filter((p) => Number(p.positionAmt) !== 0)
        .map((p) => {
          const amt = Number(p.positionAmt);
          const mark = Number(p.markPrice);
          const notional = Math.abs(amt) * mark;
          return {
            symbol: p.symbol,
            side: amt >= 0 ? "LONG" : "SHORT",
            size: Math.abs(amt),
            notional,
            entryPrice: Number(p.entryPrice),
            markPrice: mark,
            liquidationPrice: Number(p.liquidationPrice),
            unrealizedPnl: Number(p.unRealizedProfit) - roundTripFee(notional),
            leverage: Number(p.leverage),
          };
        })
    : [];

  const totalFees = open.reduce((s, p) => s + roundTripFee(p.notional), 0);
  const balance: Balance = {
    walletBalance: Number(acc.data.totalWalletBalance),
    availableBalance: Number(acc.data.availableBalance),
    unrealizedPnl: Number(acc.data.totalUnrealizedProfit) - totalFees,
    marginBalance: Number(acc.data.totalMarginBalance) - totalFees,
  };

  return Response.json(
    { ok: true, balance, positions: open },
    { headers: { "Cache-Control": "no-store" } },
  );
}
