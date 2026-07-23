"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { detectRegime, readSignal, type Regime, type SignalRead } from "./analytics";
import { decide, EMPTY_CONTEXT, type MarketContext, type MasterDecision } from "./decision";
import type { Candle, Quote } from "./types";
import { CRYPTO, HEADER_SYMBOLS } from "./universe";

export const TIMEFRAMES = [
  "1s",
  "5s",
  "15s",
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;
export type Timeframe = (typeof TIMEFRAMES)[number];

const SUB_MINUTE = new Set<Timeframe>(["1s", "5s", "15s"]);

export type ExchangeHealth = {
  id: string;
  name: string;
  online: boolean;
  latency: number;
  status: number;
};

type Movers = {
  gainers: Quote[];
  losers: Quote[];
  counts: { up: number; down: number; flat: number; total: number };
};

type MarketState = {
  quotes: Map<string, Quote>;
  prevPrices: Map<string, number>;
  movers: Movers;
  symbol: string;
  setSymbol: (s: string) => void;
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;
  candles: Candle[];
  candlesLoading: boolean;
  regime: Regime;
  signal: SignalRead;
  context: MarketContext;
  decision: MasterDecision | null;
  exchanges: ExchangeHealth[];
  connected: boolean;
  lastUpdate: number;
  /** Increments on every quote poll — drives the AI fleet animation. */
  tick: number;
  emergencyStop: boolean;
  setEmergencyStop: (v: boolean) => void;
};

const MarketContextObj = createContext<MarketState | null>(null);

const WATCHED = Array.from(
  new Set([...HEADER_SYMBOLS, ...CRYPTO.map((c) => c.symbol)]),
);

const EMPTY_MOVERS: Movers = {
  gainers: [],
  losers: [],
  counts: { up: 0, down: 0, flat: 0, total: 0 },
};

const NO_CANDLES: Candle[] = [];
const NO_EXCHANGES: ExchangeHealth[] = [];

type Board = { quotes: Map<string, Quote>; prev: Map<string, number> };
const EMPTY_BOARD: Board = { quotes: new Map(), prev: new Map() };

/**
 * Polls without overlapping: each cycle schedules the next only after the
 * previous request settles, so a slow upstream cannot pile up requests.
 */
function usePoll(task: () => Promise<void>, intervalMs: number) {
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      await task();
      if (!cancelled) timer = setTimeout(run, intervalMs);
    };

    // Deferred past the first paint: a fetch that resolves while React is
    // still hydrating would mutate attributes on panels it has not reached yet.
    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(run, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [task, intervalMs]);
}

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [board, setBoard] = useState<Board>(EMPTY_BOARD);
  const [movers, setMovers] = useState<Movers>(EMPTY_MOVERS);
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [connected, setConnected] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [tick, setTick] = useState(0);
  const [exchanges, setExchanges] = useState<ExchangeHealth[]>(NO_EXCHANGES);
  const [emergencyStop, setEmergencyStop] = useState(false);

  const [candleState, setCandleState] = useState<{ key: string; candles: Candle[] }>({
    key: "",
    candles: NO_CANDLES,
  });
  const [ctxState, setCtxState] = useState<{ key: string; ctx: MarketContext }>({
    key: "",
    ctx: EMPTY_CONTEXT,
  });

  const candleKey = `${symbol}|${timeframe}`;

  const pullQuotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes?symbols=${WATCHED.join(",")}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { quotes: Quote[] } = await res.json();
      if (data.quotes.length === 0) throw new Error("empty");

      setBoard((old) => ({
        quotes: new Map(data.quotes.map((q) => [q.symbol, q])),
        prev: new Map([...old.quotes].map(([k, v]) => [k, v.price])),
      }));
      setConnected(true);
      setLastUpdate(Date.now());
      setTick((t) => t + 1);
    } catch {
      setConnected(false);
    }
  }, []);

  const pullMovers = useCallback(async () => {
    try {
      const res = await fetch("/api/movers?limit=6");
      if (!res.ok) return;
      setMovers(await res.json());
    } catch {
      /* leaderboard is non-critical — keep the last good board */
    }
  }, []);

  const pullCandles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/candles?symbol=${encodeURIComponent(symbol)}&tf=${timeframe}&limit=${SUB_MINUTE.has(timeframe) ? 400 : 300}`,
      );
      const data: { candles: Candle[] } = await res.json();
      setCandleState({ key: candleKey, candles: data.candles ?? NO_CANDLES });
    } catch {
      setCandleState({ key: candleKey, candles: NO_CANDLES });
    }
  }, [symbol, timeframe, candleKey]);

  const pullContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/context?symbol=${encodeURIComponent(symbol)}`);
      const data: MarketContext = await res.json();
      setCtxState({ key: symbol, ctx: data });
    } catch {
      setCtxState({ key: symbol, ctx: EMPTY_CONTEXT });
    }
  }, [symbol]);

  const pullExchanges = useCallback(async () => {
    try {
      const res = await fetch("/api/exchanges");
      const data: { exchanges: ExchangeHealth[] } = await res.json();
      setExchanges(data.exchanges ?? NO_EXCHANGES);
    } catch {
      /* venue board keeps its last reading */
    }
  }, []);

  usePoll(pullQuotes, 6000);
  usePoll(pullMovers, 30000);
  usePoll(pullCandles, SUB_MINUTE.has(timeframe) ? 4000 : 20000);
  usePoll(pullContext, 25000);
  usePoll(pullExchanges, 45000);

  const candles = candleState.key === candleKey ? candleState.candles : NO_CANDLES;
  const candlesLoading = candleState.key !== candleKey;
  const context = ctxState.key === symbol ? ctxState.ctx : EMPTY_CONTEXT;

  const regime = useMemo(() => detectRegime(candles), [candles]);
  const signal = useMemo(() => readSignal(candles, regime), [candles, regime]);
  const decision = useMemo(
    () => decide(symbol, candles, regime, context),
    [symbol, candles, regime, context],
  );

  const value = useMemo<MarketState>(
    () => ({
      quotes: board.quotes,
      prevPrices: board.prev,
      movers,
      symbol,
      setSymbol,
      timeframe,
      setTimeframe,
      candles,
      candlesLoading,
      regime,
      signal,
      context,
      decision,
      exchanges,
      connected,
      lastUpdate,
      tick,
      emergencyStop,
      setEmergencyStop,
    }),
    [
      board,
      movers,
      symbol,
      timeframe,
      candles,
      candlesLoading,
      regime,
      signal,
      context,
      decision,
      exchanges,
      connected,
      lastUpdate,
      tick,
      emergencyStop,
    ],
  );

  return (
    <MarketContextObj.Provider value={value}>{children}</MarketContextObj.Provider>
  );
}

export function useMarket(): MarketState {
  const ctx = useContext(MarketContextObj);
  if (!ctx) throw new Error("useMarket must be used inside <MarketProvider>");
  return ctx;
}

/** Direction of the last tick for a symbol — drives the row flash. */
export function useTickDirection(symbol: string): "up" | "down" | null {
  const { quotes, prevPrices } = useMarket();
  const now = quotes.get(symbol)?.price;
  const before = prevPrices.get(symbol);
  if (now === undefined || before === undefined || now === before) return null;
  return now > before ? "up" : "down";
}

/**
 * A clock that only starts after mount. Server-rendering a time would hydrate
 * with a stale value, so components read `null` until the first tick.
 */
export function useNow(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const start = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(start);
      clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
