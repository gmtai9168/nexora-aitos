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
import { decide, EMPTY_CONTEXT, type Evidence, type MarketContext, type MasterDecision } from "./decision";
import type { Candle, Quote } from "./types";
import { CRYPTO, HEADER_SYMBOLS } from "./universe";
import { TESTNET_SYMBOLS } from "./testnet";
import { setAgentLive, type AgentPerf } from "./agent-live";

/** Live council read from /api/council — the same 50-agent brain the trader uses. */
export type CouncilAgent = {
  id: string;
  name: string;
  nameTh: string;
  kind: "direction" | "monitor";
  vote: number;
  confidence: number;
  note: string;
  ok: boolean | null;
  weight: number;
};
export type CouncilData = {
  symbol: string;
  ranAt: number;
  master: { dir: "LONG" | "SHORT" | null; confidence: number; supporting: number; against: number; net: number };
  deep: boolean;
  pods: { key: string; th: string; en: string; color: string; agents: CouncilAgent[] }[];
};

/**
 * Folds the live 50-agent council over the local price-level plan so every
 * page's Master AI verdict, confidence, and evidence come from the same brain
 * the autonomous trader uses. Price levels (entry/stop/target) stay from the
 * candle read, re-aimed to the council's direction.
 */
function mergeCouncil(base: MasterDecision, c: CouncilData): MasterDecision {
  const agents = c.pods.flatMap((p) => p.agents).filter((a) => a.kind === "direction" && Math.abs(a.vote) >= 0.12);
  const evidence: Evidence[] = agents
    .sort((a, b) => Math.abs(b.vote) - Math.abs(a.vote))
    .slice(0, 10)
    .map((a) => ({
      key: a.id,
      th: a.nameTh,
      en: a.name,
      verdict: a.vote > 0 ? "Long" : "Short",
      vote: a.vote > 0 ? 1 : -1,
      detail: a.note,
    }));

  const action: MasterDecision["action"] = c.master.dir ?? "WAIT";
  const stopDist = base.entry ? Math.abs(base.entry - base.stop) / base.entry : 0.005;
  const dir = action === "SHORT" ? -1 : 1;
  const entry = base.entry;
  const stop = action === "WAIT" ? base.stop : entry * (1 - dir * stopDist);
  const target = action === "WAIT" ? base.target : entry * (1 + dir * stopDist * base.riskReward);

  return {
    ...base,
    action,
    confidence: c.master.confidence,
    supporting: c.master.supporting,
    against: c.master.against,
    evidence,
    stop,
    target,
    summaryTh:
      action === "WAIT"
        ? `คณะ AI 50 ตัวยังไม่มีมติชัดเจน (${c.master.supporting} หนุน / ${c.master.against} ค้าน)`
        : `คณะ AI 50 ตัวชี้ ${action} — ${c.master.supporting} หนุน / ${c.master.against} ค้าน${c.deep ? " · ข่าว AI" : ""}`,
  };
}

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
  /** Full live council (50 agents + weights) for the current symbol, when supported. */
  council: CouncilData | null;
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
  const [councilState, setCouncilState] = useState<{ key: string; data: CouncilData | null }>({
    key: "",
    data: null,
  });

  const candleKey = `${symbol}|${timeframe}`;

  const pullQuotes = useCallback(async () => {
    try {
      // Always quote the selected symbol too — stocks aren't in the watched list,
      // so this is what lets a picked stock/index feed the analysis panels.
      const wanted = WATCHED.includes(symbol) ? WATCHED : [...WATCHED, symbol];
      const res = await fetch(`/api/quotes?symbols=${wanted.join(",")}`);
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
  }, [symbol]);

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
      // Sanitize at the source so every consumer (chart, indicators, scoring)
      // gets clean data. Yahoo stock feeds can carry null/NaN gaps or duplicate
      // timestamps, which the chart library rejects with a hard throw.
      const seen = new Map<number, Candle>();
      for (const c of data.candles ?? []) {
        if (![c.time, c.open, c.high, c.low, c.close].every((n) => Number.isFinite(n))) continue;
        seen.set(c.time, { ...c, volume: Number.isFinite(c.volume) ? c.volume : 0 });
      }
      const clean = [...seen.values()].sort((a, b) => a.time - b.time);
      setCandleState({ key: candleKey, candles: clean.length ? clean : NO_CANDLES });
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

  const pullCouncil = useCallback(async () => {
    if (!TESTNET_SYMBOLS.includes(symbol)) {
      setCouncilState({ key: symbol, data: null });
      return;
    }
    try {
      const res = await fetch(`/api/council?symbol=${encodeURIComponent(symbol)}`);
      if (!res.ok) throw new Error(String(res.status));
      setCouncilState({ key: symbol, data: (await res.json()) as CouncilData });
    } catch {
      setCouncilState({ key: symbol, data: null });
    }
  }, [symbol]);

  // Real per-agent track record from the trading memory — fills the registry
  // the pure telemetry()/trustScore() functions read across every page.
  const pullAgentsPerf = useCallback(async () => {
    try {
      const res = await fetch("/api/agents-perf");
      if (!res.ok) return;
      const data = (await res.json()) as { perf: Record<string, AgentPerf> };
      setAgentLive(data.perf ?? {});
    } catch {
      /* keep last known performance */
    }
  }, []);

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
  usePoll(pullCouncil, 20000);
  usePoll(pullAgentsPerf, 30000);
  usePoll(pullExchanges, 45000);

  const candles = candleState.key === candleKey ? candleState.candles : NO_CANDLES;
  const candlesLoading = candleState.key !== candleKey;
  const context = ctxState.key === symbol ? ctxState.ctx : EMPTY_CONTEXT;
  const council = councilState.key === symbol ? councilState.data : null;

  const regime = useMemo(() => detectRegime(candles), [candles]);
  const signal = useMemo(() => readSignal(candles, regime), [candles, regime]);
  const decision = useMemo(() => {
    const base = decide(symbol, candles, regime, context);
    if (!base) return null;
    return council && council.master ? mergeCouncil(base, council) : base;
  }, [symbol, candles, regime, context, council]);

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
      council,
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
      council,
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
