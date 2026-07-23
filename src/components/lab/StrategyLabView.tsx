"use client";

import { useEffect, useMemo, useState } from "react";
import { useMarket } from "@/lib/market-context";
import {
  backtest,
  DEFAULT_PARAMS,
  KIND_META,
  monteCarlo,
  optimize,
  walkForward,
  type OptimizeRow,
  type StrategyKind,
  type StrategyParams,
} from "@/lib/strategy";
import type { Candle } from "@/lib/types";
import {
  AiRecommendation,
  ParamsPanel,
  StrategyCanvas,
  StrategyGenerator,
  StrategyLibrary,
  type SavedStrategy,
} from "./BuilderPanels";
import { CodeGenPanel, DeployPanel, OptimizerPanel, PaperShadowPanel } from "./DeployPanels";
import { BacktestPanel, ComparePanel, MonteCarloPanel, WalkForwardPanel } from "./TestPanels";

/** Starting presets tuned to each style — the generator swaps between them. */
const PRESETS: Record<StrategyKind, Partial<StrategyParams>> = {
  trend: { emaFast: 12, emaSlow: 34, rsiFilter: 52, stopAtr: 1.6, targetR: 2.2, maxHoldBars: 24 },
  meanReversion: { emaFast: 8, emaSlow: 55, rsiFilter: 62, stopAtr: 1.2, targetR: 1.6, maxHoldBars: 12 },
  breakout: { emaFast: 12, emaSlow: 55, rsiFilter: 50, stopAtr: 2.2, targetR: 3, maxHoldBars: 48 },
  scalping: { emaFast: 8, emaSlow: 21, rsiFilter: 48, stopAtr: 1, targetR: 1.4, maxHoldBars: 6 },
  funding: { emaFast: 12, emaSlow: 89, rsiFilter: 60, stopAtr: 1.8, targetR: 2.4, maxHoldBars: 36 },
};

const NO_CANDLES: Candle[] = [];

const LIBRARY: SavedStrategy[] = [
  { id: "trend-v3", name: "Trend Hunter V3", kind: "trend", stage: "production", params: { ...DEFAULT_PARAMS, ...PRESETS.trend } },
  { id: "breakout", name: "Breakout AI", kind: "breakout", stage: "production", params: { ...DEFAULT_PARAMS, ...PRESETS.breakout } },
  { id: "whale", name: "Whale Hunter", kind: "funding", stage: "shadow", params: { ...DEFAULT_PARAMS, ...PRESETS.funding } },
  { id: "scalp", name: "Scalping AI", kind: "scalping", stage: "paper", params: { ...DEFAULT_PARAMS, ...PRESETS.scalping } },
  { id: "meanrev", name: "Mean Reversion X", kind: "meanReversion", stage: "testing", params: { ...DEFAULT_PARAMS, ...PRESETS.meanReversion } },
];

export function StrategyLabView() {
  const { symbol } = useMarket();
  const [interval, setInterval] = useState("1h");
  const [bars, setBars] = useState(2000);
  const [candles, setCandles] = useState<{ key: string; data: Candle[] }>({ key: "", data: [] });
  const [params, setParams] = useState<StrategyParams>(LIBRARY[0].params);
  const [activeId, setActiveId] = useState(LIBRARY[0].id);
  const [library, setLibrary] = useState(LIBRARY);
  const [optRows, setOptRows] = useState<OptimizeRow[]>([]);
  const [optRunning, setOptRunning] = useState(false);
  const [history, setHistory] = useState([
    { version: 1, note: "เวอร์ชันแรก — ตามแนวโน้มล้วน", pf: 1.42 },
  ]);

  const key = `${symbol}|${interval}|${bars}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&interval=${interval}&bars=${bars}`,
        );
        const data: { candles: Candle[] } = await res.json();
        if (!cancelled) setCandles({ key, data: data.candles ?? [] });
      } catch {
        if (!cancelled) setCandles({ key, data: [] });
      }
    };
    const id = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [symbol, interval, bars, key]);

  // Memoised so its identity is stable — otherwise every render would re-run
  // the backtest, the walk-forward and five comparison backtests.
  const data = useMemo(
    () => (candles.key === key ? candles.data : NO_CANDLES),
    [candles, key],
  );
  const loading = candles.key !== key;

  // Everything below is computed from the same real candle series.
  const result = useMemo(() => backtest(data, params), [data, params]);
  const mc = useMemo(
    () => monteCarlo(result.trades, params.riskPct),
    [result.trades, params.riskPct],
  );
  const wf = useMemo(() => walkForward(data, params), [data, params]);

  const compare = useMemo(
    () =>
      library.map((s) => ({
        name: s.name,
        kind: KIND_META[s.kind].th,
        result: backtest(data, s.params),
      })),
    [library, data],
  );

  const runOptimizer = () => {
    setOptRunning(true);
    // Yield a frame so the button can paint its loading state first.
    setTimeout(() => {
      setOptRows(optimize(data, params));
      setOptRunning(false);
    }, 30);
  };

  const generate = (kind: StrategyKind) => {
    setParams((p) => ({ ...p, kind, ...PRESETS[kind] }));
    setOptRows([]);
  };

  const selectStrategy = (id: string) => {
    const s = library.find((x) => x.id === id);
    if (!s) return;
    setActiveId(id);
    setParams(s.params);
    setOptRows([]);
  };

  const cloneStrategy = (id: string) => {
    const s = library.find((x) => x.id === id);
    if (!s) return;
    const copy: SavedStrategy = {
      ...s,
      id: `${s.id}-copy-${library.length}`,
      name: `${s.name} (Copy)`,
      stage: "testing",
      params: { ...params },
    };
    setLibrary((prev) => [...prev, copy]);
    setActiveId(copy.id);
  };

  const deploy = () => {
    const next = history.length + 1;
    setHistory((prev) => [
      ...prev,
      {
        version: next,
        note: `${KIND_META[params.kind].th} · EMA ${params.emaFast}/${params.emaSlow} · ${params.targetR}R`,
        pf: result.profitFactor,
      },
    ]);
  };

  const rollback = () => setHistory((prev) => prev.slice(0, -1));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <StrategyLibrary
          items={library}
          activeId={activeId}
          onSelect={selectStrategy}
          onClone={cloneStrategy}
        />
        <StrategyCanvas params={params} />
        <StrategyGenerator
          params={params}
          onChange={setParams}
          onGenerate={generate}
          symbol={symbol}
          interval={interval}
          onInterval={setInterval}
        />
      </div>

      <BacktestPanel
        result={result}
        bars={bars}
        loading={loading}
        interval={interval}
        onBars={setBars}
      />

      <div className="grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <ParamsPanel params={params} onChange={setParams} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <MonteCarloPanel mc={mc} />
          <AiRecommendation result={result} params={params} overfit={wf.overfit} />
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <WalkForwardPanel wf={wf} />
        <ComparePanel rows={compare} />
      </div>

      <OptimizerPanel
        rows={optRows}
        running={optRunning}
        onRun={runOptimizer}
        onApply={setParams}
        current={params}
      />

      <div className="grid gap-2.5 xl:grid-cols-2">
        <PaperShadowPanel result={result} wf={wf} mc={mc} />
        <DeployPanel
          result={result}
          wf={wf}
          mc={mc}
          version={history.length}
          onDeploy={deploy}
          onRollback={rollback}
          history={history}
        />
      </div>

      <CodeGenPanel params={params} symbol={symbol} interval={interval} />
    </div>
  );
}
