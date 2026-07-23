"use client";

import { useEffect, useMemo, useState } from "react";
import type { MacroRow } from "@/app/api/macro/route";
import {
  analyseNews,
  assetClasses,
  currencyStrength,
  eventRadar,
  recommendations,
  regionPulse,
  scenarios as buildScenarios,
} from "@/lib/global-intel";
import { useMarket } from "@/lib/market-context";
import { useCoinIntel } from "@/lib/use-coin-intel";
import { AIActivityFlow } from "../AIActivityFlow";
import {
  CurrencyPanel,
  FlowPanel,
  IndicesPanel,
  MacroPanel,
  NewsImpactPanel,
  OutlookPanel,
  RadarPanel,
  WorldMapPanel,
  WorldStatusPanel,
} from "./GlobalPanels";

type Stable = { symbol: string; price: number; changePct: number; volume: number };

const NO_ROWS: MacroRow[] = [];
const NO_STABLES: Stable[] = [];

export function GlobalIntelView() {
  const { quotes, context, symbol } = useMarket();
  const intel = useCoinIntel(symbol);
  const [macro, setMacro] = useState<{ rows: MacroRow[]; stablecoins: Stable[] }>({
    rows: NO_ROWS,
    stablecoins: NO_STABLES,
  });

  // Macro data moves slowly and costs ~24 upstream calls, so it polls rarely.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch("/api/macro");
        const data = await res.json();
        if (!cancelled && data.rows?.length) setMacro(data);
      } catch {
        /* keep the last board */
      }
      if (!cancelled) timer = setTimeout(load, 120000);
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

  const cryptoBias = useMemo(() => {
    const list = [...quotes.values()];
    return list.length ? list.reduce((a, q) => a + q.changePct, 0) / list.length : 0;
  }, [quotes]);

  const classes = useMemo(() => assetClasses(macro.rows, quotes), [macro.rows, quotes]);
  const regions = useMemo(() => regionPulse(macro.rows), [macro.rows]);
  const currencies = useMemo(
    () => currencyStrength(macro.rows, quotes.get("BTCUSDT")),
    [macro.rows, quotes],
  );

  const equityBias = classes.find((c) => c.key === "equity")?.changePct ?? 0;
  const news = useMemo(
    () => analyseNews(intel.news, cryptoBias, equityBias),
    [intel.news, cryptoBias, equityBias],
  );

  const radar = useMemo(
    () => eventRadar(macro.rows, macro.stablecoins, context.oiChangePct, news, cryptoBias),
    [macro, context.oiChangePct, news, cryptoBias],
  );

  const vix = macro.rows.find((r) => r.symbol === "^VIX")?.price ?? null;

  const scenarios = useMemo(
    () => buildScenarios(cryptoBias, classes, news, vix),
    [cryptoBias, classes, news, vix],
  );

  const recs = useMemo(
    () => recommendations(classes, quotes, macro.rows),
    [classes, quotes, macro.rows],
  );

  const etfRows = macro.rows.filter((r) => r.group === "etf");

  return (
    <div className="flex flex-col gap-2.5">
      <WorldStatusPanel
        classes={classes}
        fearGreed={intel.onchain.fearGreed}
        vix={vix}
      />

      {/* items-start so the map keeps its natural height next to the taller
          indices list instead of leaving dead space inside its panel. */}
      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <WorldMapPanel regions={regions} />
        <IndicesPanel rows={macro.rows} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <NewsImpactPanel items={news} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <MacroPanel rows={macro.rows} />
          <CurrencyPanel rows={currencies} />
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <FlowPanel etfRows={etfRows} stablecoins={macro.stablecoins} />
        <RadarPanel signals={radar} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_240px]">
        <OutlookPanel recs={recs} scenarios={scenarios} />
        <AIActivityFlow />
      </div>
    </div>
  );
}
