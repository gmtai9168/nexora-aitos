"use client";

import { useEffect, useMemo, useState } from "react";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import { useMarket } from "@/lib/market-context";
import { stressTest } from "@/lib/portfolio-intel";
import {
  BAND_META,
  blackSwan,
  committee,
  dynamicLeverage,
  globalRisk,
  marketRisk,
  positionRisk,
  riskRecommendations,
} from "@/lib/risk-engine";
import type { Quote } from "@/lib/types";
import { GuardianPanel } from "../portfolio/AnalyticsPanels";
import { CorrelationMatrix } from "../portfolio/RiskPanels";
import {
  BlackSwanPanel,
  CommitteePanel,
  GlobalRiskPanel,
  KillSwitchPanel,
  LeverageMarginPanel,
  MarketRiskPanel,
  PositionRiskPanel,
  RiskRecommendationPanel,
  StressPanel,
} from "./RiskPanels";

const MATRIX_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT", "^IXIC", "GC=F"];

export function RiskEngineView() {
  const { quotes, candles, regime, context, exchanges, symbol } = useMarket();
  const [matrix, setMatrix] = useState<{ symbols: string[]; matrix: (number | null)[][] }>({
    symbols: [],
    matrix: [],
  });
  const [extra, setExtra] = useState<{ usdc: number | null; fearGreed: number | null }>({
    usdc: null,
    fearGreed: null,
  });

  // Correlation matrix — expensive, so it refreshes slowly.
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

  // The stablecoin peg and the fear index feed the black-swan checks.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const [peg, chain] = await Promise.all([
          fetch("/api/quotes?symbols=USDCUSDT")
            .then((r) => r.json())
            .then((d: { quotes: Quote[] }) => d.quotes?.[0]?.price ?? null)
            .catch(() => null),
          fetch("/api/onchain?symbol=BTCUSDT")
            .then((r) => r.json())
            .then((d) => d.fearGreed ?? null)
            .catch(() => null),
        ]);
        if (!cancelled) setExtra({ usdc: peg, fearGreed: chain });
      } catch {
        /* keep the last reading */
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

  const book = useMemo(() => buildBook(quotes), [quotes]);
  const curve = useMemo(() => equityCurve(candles, book.equity), [candles, book.equity]);
  const stats = useMemo(() => curveStats(curve), [curve]);

  const maxCorrelation = useMemo(() => {
    const vals: number[] = [];
    matrix.matrix.forEach((row, i) =>
      row.forEach((v, j) => {
        if (i < j && v !== null) vals.push(v);
      }),
    );
    return vals.length ? Math.max(...vals) : null;
  }, [matrix]);

  const market = useMemo(
    () => marketRisk(regime, context, quotes.get(symbol), exchanges, 0, extra.fearGreed),
    [regime, context, quotes, symbol, exchanges, extra.fearGreed],
  );

  const positions = useMemo(() => positionRisk(book, regime), [book, regime]);

  const swans = useMemo(
    () => blackSwan(regime, context, quotes, exchanges, extra.usdc),
    [regime, context, quotes, exchanges, extra.usdc],
  );

  const global = useMemo(
    () => globalRisk(book, market, positions, maxCorrelation, swans, stats.drawdown),
    [book, market, positions, maxCorrelation, swans, stats.drawdown],
  );

  const board = useMemo(
    () => committee(book, market, positions, maxCorrelation, swans, stats.drawdown),
    [book, market, positions, maxCorrelation, swans, stats.drawdown],
  );

  const lev = useMemo(
    () => dynamicLeverage(regime, market, swans, book.configuredLeverage),
    [regime, market, swans, book.configuredLeverage],
  );

  const recs = useMemo(
    () => riskRecommendations(global, positions, lev, book, maxCorrelation, swans),
    [global, positions, lev, book, maxCorrelation, swans],
  );

  const scenarios = useMemo(
    () =>
      stressTest(book, [
        { label: "ตลาดร่วง 5%", shockPct: -5 },
        { label: "BTC Flash Crash 10%", shockPct: -10 },
        { label: "ตลาดร่วง 20% (วิกฤต)", shockPct: -20 },
        { label: "ตลาดร่วง 30% (Black Swan)", shockPct: -30 },
        { label: "ตลาดฟื้น +10%", shockPct: 10 },
      ]),
    [book],
  );

  const riskRows = useMemo(
    () =>
      market.map((m) => ({
        th: m.th,
        en: m.en,
        level: m.score,
        label: m.score >= 67 ? "สูง" : m.score >= 34 ? "ปานกลาง" : "ต่ำ",
      })),
    [market],
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {[
          { th: "คะแนนรวม", en: "Global Risk", v: `${global.score}/100`, c: BAND_META[global.band].color },
          { th: "ความเสี่ยงพอร์ต", en: "Portfolio", v: `${(book.marginRatio * 1.7).toFixed(0)}`, c: undefined },
          { th: "ความเสี่ยงตลาด", en: "Market", v: `${(market.reduce((a, m) => a + m.score, 0) / market.length).toFixed(0)}`, c: undefined },
          { th: "Margin Ratio", en: "", v: `${book.marginRatio.toFixed(1)}%`, c: undefined },
          { th: "เลเวอเรจ", en: "Leverage", v: `${book.leverage.toFixed(2)}x`, c: undefined },
          { th: "Drawdown", en: "", v: `${stats.drawdown.toFixed(2)}%`, c: undefined },
          { th: "สหสัมพันธ์สูงสุด", en: "Correlation", v: maxCorrelation === null ? "—" : maxCorrelation.toFixed(2), c: undefined },
          { th: "Black Swan", en: "", v: `${swans.filter((s) => s.triggered).length} สัญญาณ`, c: swans.some((s) => s.triggered) ? "#ff4a68" : "#14e2a0" },
        ].map((c) => (
          <div key={c.th} className="panel min-w-0 flex-1 px-2.5 py-1.5">
            <div className="truncate text-[9px] tracking-wide text-dim">
              {c.th} {c.en && <span className="text-[8px]">{c.en}</span>}
            </div>
            <div
              className="num truncate text-[15px] font-bold"
              style={{ color: c.c ?? "#d5e2ee" }}
            >
              {c.v}
            </div>
          </div>
        ))}
      </div>

      <GlobalRiskPanel global={global} verdict={board.verdict} summaryTh={board.summaryTh} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PositionRiskPanel rows={positions} book={book} />
        <CommitteePanel votes={board.votes} verdict={board.verdict} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <MarketRiskPanel items={market} />
        <CorrelationMatrix
          symbols={matrix.symbols}
          matrix={matrix.matrix}
          loading={matrix.matrix.length === 0}
        />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-3">
        <LeverageMarginPanel book={book} lev={lev} drawdown={stats.drawdown} />
        <BlackSwanPanel items={swans} />
        <RiskRecommendationPanel items={recs} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <StressPanel results={scenarios} />
        <KillSwitchPanel />
      </div>

      <GuardianPanel book={book} risks={riskRows} drawdown={stats.drawdown} />
    </div>
  );
}
