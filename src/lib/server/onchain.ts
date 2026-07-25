/**
 * #4 On-chain flow — SCAFFOLD, dormant until real-money go-live.
 *
 * The one deep source with a genuine "see it before price fully reacts" thesis:
 * large exchange inflows (coins moving to an exchange = potential sell pressure)
 * and outflows (accumulation) settle publicly on-chain, a bit ahead of the full
 * price reaction. Honest caveat: it is not millisecond front-running, and the
 * big firms watch the same wallets — the edge is modest and medium-horizon.
 *
 * There is no reliable FREE exchange-flow feed, so this stays OFF until the
 * operator provisions a paid provider (Glassnode / Nansen) at real-money launch.
 * The wiring is here so switching it on later is a config flip, not a rebuild.
 * While GLASSNODE_API_KEY / NANSEN_API_KEY are unset, onchainFlow() returns null
 * and the cycle adds nothing.
 */

export type OnchainFlow = {
  /** Net exchange flow over the window in USD (+ = inflow / sell pressure). */
  netFlowUsd: number;
  bias: "bullish" | "bearish" | "neutral";
  note: string;
};

export function onchainConfigured(): boolean {
  return Boolean(process.env.GLASSNODE_API_KEY || process.env.NANSEN_API_KEY);
}

export async function onchainFlow(symbol: string): Promise<OnchainFlow | null> {
  if (!onchainConfigured()) return null;
  void symbol; // used by the provider read below once implemented

  // TODO(real-money launch): implement the paid provider read here.
  //   Glassnode: /v1/metrics/transactions/transfers_volume_exchanges_net
  //   Nansen:    Smart-Money / exchange-flow endpoints
  // Map net exchange flow → bias (large inflow = bearish, large outflow = bullish),
  // scale to a bounded confidence factor via scoreOnchain below. Intentionally
  // left unimplemented so no half-working paid call ships before it's needed.
  return null;
}

export type OnchainScore = {
  adj: number;
  factor: { label: string; agree: boolean | null; note: string };
};

export function scoreOnchain(dir: "LONG" | "SHORT", flow: OnchainFlow): OnchainScore {
  const long = dir === "LONG";
  let agree: boolean | null = null;
  let adj = 0;
  if (flow.bias !== "neutral") {
    agree = (flow.bias === "bullish") === long;
    adj = agree ? 14 : -14; // medium-horizon signal, bounded
  }
  return { adj, factor: { label: "กระแสเงินออนเชน", agree, note: flow.note } };
}
