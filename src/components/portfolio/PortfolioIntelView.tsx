"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import { useMarket } from "@/lib/market-context";
import { useLiveAccount } from "@/lib/live-account";
import {
  allocation,
  digitalTwin,
  exposure,
  healthScore,
  performance,
  recommendations,
  riskMonitor,
  stressTest,
} from "@/lib/portfolio-intel";
import { ALL_LISTINGS } from "@/lib/universe";
import {
  EquityCurvePanel,
  GuardianPanel,
  PerformancePanel,
} from "./AnalyticsPanels";
import {
  AllocationPanel,
  ExposurePanel,
  HeaderStats,
  LivePositionsPanel,
  PortfolioOverviewPanel,
} from "./OverviewPanels";
import {
  CorrelationMatrix,
  DigitalTwinPanel,
  RecommendationPanel,
  RiskMonitorPanel,
  StressTestPanel,
} from "./RiskPanels";

const MATRIX_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "^IXIC",
  "GC=F",
];

const COLORS = new Map(ALL_LISTINGS.map((l) => [l.symbol, l.color]));

export function PortfolioIntelView() {
  const { quotes, candles, regime, context, exchanges, decision } = useMarket();
  const live = useLiveAccount();
  const [matrix, setMatrix] = useState<{ symbols: string[]; matrix: (number | null)[][] }>({
    symbols: [],
    matrix: [],
  });
  const [shock, setShock] = useState(-10);

  // Correlations are expensive to compute, so they refresh on a slow loop.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/matrix?symbols=${MATRIX_SYMBOLS.join(",")}`);
        const data = await res.json();
        if (!cancelled && data.matrix?.length) setMatrix(data);
      } catch {
        /* keep the last matrix */
      }
      if (!cancelled) timer = setTimeout(load, 300000);
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

  const book = useMemo(() => buildBook(quotes, live), [quotes, live]);
  const curve = useMemo(() => equityCurve(candles, book.equity), [candles, book.equity]);
  const stats = useMemo(() => curveStats(curve), [curve]);
  const exp = useMemo(() => exposure(book, quotes), [book, quotes]);
  const alloc = useMemo(() => allocation(book, COLORS), [book]);

  // The strongest correlation anywhere in the book drives the risk read.
  const { maxCorrelation, hotPairs } = useMemo(() => {
    const pairs: { a: string; b: string; value: number }[] = [];
    matrix.matrix.forEach((row, i) =>
      row.forEach((v, j) => {
        if (i < j && v !== null) {
          pairs.push({
            a: matrix.symbols[i].replace(/USDT$/, ""),
            b: matrix.symbols[j].replace(/USDT$/, ""),
            value: v,
          });
        }
      }),
    );
    return {
      maxCorrelation: pairs.length ? Math.max(...pairs.map((p) => p.value)) : null,
      hotPairs: pairs,
    };
  }, [matrix]);

  const risks = useMemo(
    () =>
      riskMonitor(
        book,
        exp,
        stats.drawdown,
        regime.atr,
        maxCorrelation,
        exchanges.filter((e) => !e.online).length,
        context.funding,
      ),
    [book, exp, stats.drawdown, regime.atr, maxCorrelation, exchanges, context.funding],
  );

  const health = useMemo(
    () =>
      healthScore(book, exp, stats.drawdown, maxCorrelation, decision?.confidence ?? 60),
    [book, exp, stats.drawdown, maxCorrelation, decision],
  );

  const recs = useMemo(
    () => recommendations(book, exp, risks, hotPairs, quotes),
    [book, exp, risks, hotPairs, quotes],
  );

  const scenarios = useMemo(
    () =>
      stressTest(book, [
        { label: "BTC และตลาดรวม -5%", shockPct: -5 },
        { label: "ตลาดรวม -10%", shockPct: -10 },
        { label: "ตลาดรวม -20% (วิกฤต)", shockPct: -20 },
        { label: "ตลาดรวม +10%", shockPct: 10 },
        { label: `จำลองเอง ${shock >= 0 ? "+" : ""}${shock}%`, shockPct: shock },
      ]),
    [book, shock],
  );

  const twin = useMemo(() => digitalTwin(book, stats.drawdown), [book, stats.drawdown]);
  const perf = useMemo(
    () => performance(book, curve, stats.sharpe, stats.drawdown),
    [book, curve, stats],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <HeaderStats
        book={book}
        health={health}
        drawdown={stats.drawdown}
        sharpe={stats.sharpe}
        exp={exp}
      />

      <PortfolioOverviewPanel book={book} curve={curve} health={health} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <LivePositionsPanel book={book} />
        <AllocationPanel rows={alloc} exp={exp} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <ExposurePanel exp={exp} />
        <CorrelationMatrix
          symbols={matrix.symbols}
          matrix={matrix.matrix}
          loading={matrix.matrix.length === 0}
        />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <RecommendationPanel items={recs} />
        <RiskMonitorPanel items={risks} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <EquityCurvePanel curve={curve} />
        <PerformancePanel perf={perf} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <StressTestPanel results={scenarios} shock={shock} onShock={setShock} />
        <DigitalTwinPanel results={twin} />
      </div>

      <GuardianPanel book={book} risks={risks} drawdown={stats.drawdown} />
    </div>
  );
}
