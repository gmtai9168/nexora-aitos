"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Balance, Position as TestnetPosition } from "./testnet";

/**
 * The real testnet account, polled once and shared across every page.
 *
 * This is the single source of truth for "how much money is actually here".
 * When it is connected, the portfolio, fund, risk and execution pages read
 * their balances and positions from it instead of the old demo constants —
 * so the numbers on screen equal the real testnet balance. When it is not
 * connected (no keys), pages fall back to the labelled demo book.
 */
export type LiveAccount = {
  connected: boolean;
  loading: boolean;
  wallet: number;
  available: number;
  unrealizedPnl: number;
  equity: number;
  positions: {
    symbol: string;
    side: "LONG" | "SHORT";
    size: number;
    notional: number;
    entryPrice: number;
    markPrice: number;
    unrealizedPnl: number;
    liquidationPrice: number;
    leverage: number;
  }[];
};

const EMPTY: LiveAccount = {
  connected: false,
  loading: true,
  wallet: 0,
  available: 0,
  unrealizedPnl: 0,
  equity: 0,
  positions: [],
};

const LiveAccountCtx = createContext<LiveAccount>(EMPTY);

const POLL_MS = 15_000;

export function LiveAccountProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<LiveAccount>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch("/api/testnet/account");
        const data: { ok: boolean; balance?: Balance; positions?: TestnetPosition[] } = await res.json();
        if (cancelled) return;
        if (data.ok && data.balance) {
          setAccount({
            connected: true,
            loading: false,
            wallet: data.balance.walletBalance,
            available: data.balance.availableBalance,
            unrealizedPnl: data.balance.unrealizedPnl,
            equity: data.balance.marginBalance,
            positions: (data.positions ?? []).map((p) => ({
              symbol: p.symbol,
              side: p.side,
              size: p.size,
              notional: p.notional,
              entryPrice: p.entryPrice,
              markPrice: p.markPrice,
              unrealizedPnl: p.unrealizedPnl,
              liquidationPrice: p.liquidationPrice,
              leverage: p.leverage,
            })),
          });
        } else {
          setAccount((a) => ({ ...a, connected: false, loading: false }));
        }
      } catch {
        if (!cancelled) setAccount((a) => ({ ...a, connected: false, loading: false }));
      }
      if (!cancelled) timer = setTimeout(load, POLL_MS);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  return <LiveAccountCtx.Provider value={account}>{children}</LiveAccountCtx.Provider>;
}

export function useLiveAccount(): LiveAccount {
  return useContext(LiveAccountCtx);
}
