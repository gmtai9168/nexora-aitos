"use client";

import { useEffect, useState } from "react";
import { EMPTY_ONCHAIN, type Correlation, type OnChain } from "./scoring";

export type NewsItem = {
  id: string;
  title: string;
  publisher: string;
  link: string;
  time: number;
  sentiment: "บวก" | "ลบ" | "กลาง";
};

export type DepthLevel = { price: number; qty: number };
export type Micro = {
  supported: boolean;
  bids: DepthLevel[];
  asks: DepthLevel[];
  trades: { price: number; qty: number; time: number; side: "buy" | "sell" }[];
  longAccount: number | null;
  shortAccount: number | null;
  longShortRatio: number | null;
  openInterest: number | null;
  markPrice: number | null;
};

const EMPTY_MICRO: Micro = {
  supported: false,
  bids: [],
  asks: [],
  trades: [],
  longAccount: null,
  shortAccount: null,
  longShortRatio: null,
  openInterest: null,
  markPrice: null,
};

export type CoinIntel = {
  onchain: OnChain;
  correlations: Correlation[];
  news: NewsItem[];
  micro: Micro;
  loading: boolean;
};

/**
 * Everything page 03 needs beyond the shared market context. Each feed is
 * keyed by symbol so a slow response can never paint onto a different asset.
 */
export function useCoinIntel(symbol: string): CoinIntel {
  const [state, setState] = useState<{
    key: string;
    onchain: OnChain;
    correlations: Correlation[];
    news: NewsItem[];
  }>({ key: "", onchain: EMPTY_ONCHAIN, correlations: [], news: [] });

  const [micro, setMicro] = useState<{ key: string; data: Micro }>({
    key: "",
    data: EMPTY_MICRO,
  });

  // Slow feeds: on-chain, correlation and news refresh on a long cadence.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      const base = symbol.replace(/USDT$/, "");
      const [onchain, corr, news] = await Promise.all([
        fetch(`/api/onchain?symbol=${encodeURIComponent(symbol)}`)
          .then((r) => r.json())
          .catch(() => EMPTY_ONCHAIN),
        fetch(`/api/correlation?symbol=${encodeURIComponent(symbol)}`)
          .then((r) => r.json())
          .then((d) => d.correlations ?? [])
          .catch(() => []),
        fetch(`/api/news?q=${encodeURIComponent(base)}`)
          .then((r) => r.json())
          .then((d) => d.items ?? [])
          .catch(() => []),
      ]);

      if (!cancelled) setState({ key: symbol, onchain, correlations: corr, news });
      if (!cancelled) timer = setTimeout(load, 180000);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [symbol]);

  // Fast feed: order book and tape.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/microstructure?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();
        if (!cancelled) setMicro({ key: symbol, data });
      } catch {
        /* keep the last book */
      }
      if (!cancelled) timer = setTimeout(load, 7000);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [symbol]);

  const fresh = state.key === symbol;

  return {
    onchain: fresh ? state.onchain : EMPTY_ONCHAIN,
    correlations: fresh ? state.correlations : [],
    news: fresh ? state.news : [],
    micro: micro.key === symbol ? micro.data : EMPTY_MICRO,
    loading: !fresh,
  };
}

export function newsBalance(items: NewsItem[]) {
  return {
    positive: items.filter((n) => n.sentiment === "บวก").length,
    negative: items.filter((n) => n.sentiment === "ลบ").length,
    total: items.length,
  };
}
