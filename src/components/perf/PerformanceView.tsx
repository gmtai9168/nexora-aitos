"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtNum, fmtPct } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import {
  buyHoldCurve,
  curveStat,
  improvements,
  monthlyReturns,
  performanceTwin,
  periodReturns,
  riskAnalytics,
  runRoster,
  tradeAnalytics,
} from "@/lib/performance";
import { DEFAULT_PARAMS } from "@/lib/strategy";
import type { Candle } from "@/lib/types";
import {
  AttributionPanel,
  EquityCurvePanel,
  ExecutivePanel,
  ImprovementPanel,
  KpiStrip,
  MonthlyPanel,
  PeriodPanel,
  RiskPanel,
  ScatterPanel,
  StrategyTable,
  TradePanel,
  TwinPanel,
} from "./PerfPanels";

const NO_CANDLES: Candle[] = [];
const INTERVALS = [
  { key: "1h", th: "รายชั่วโมง", bars: 2000 },
  { key: "4h", th: "4 ชั่วโมง", bars: 1500 },
  { key: "1d", th: "รายวัน", bars: 900 },
] as const;

export function PerformanceView() {
  const { symbol } = useMarket();
  const [intervalKey, setIntervalKey] = useState<(typeof INTERVALS)[number]["key"]>("1h");
  const [history, setHistory] = useState<{ key: string; data: Candle[] }>({
    key: "",
    data: NO_CANDLES,
  });
  const [exported, setExported] = useState<string | null>(null);

  const conf = INTERVALS.find((i) => i.key === intervalKey)!;
  const key = `${symbol}|${intervalKey}|${conf.bars}`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&interval=${intervalKey}&bars=${conf.bars}`,
        );
        const data: { candles: Candle[] } = await res.json();
        if (!cancelled) setHistory({ key, data: data.candles ?? NO_CANDLES });
      } catch {
        if (!cancelled) setHistory({ key, data: NO_CANDLES });
      }
    };
    const id = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [symbol, intervalKey, conf.bars, key]);

  const candles = useMemo(
    () => (history.key === key ? history.data : NO_CANDLES),
    [history, key],
  );
  const loading = history.key !== key;

  // One roster run feeds every panel on the page.
  const { rows, portfolio } = useMemo(() => runRoster(candles), [candles]);
  const benchmark = useMemo(() => buyHoldCurve(candles), [candles]);
  const stat = useMemo(() => curveStat(portfolio), [portfolio]);
  const benchStat = useMemo(() => curveStat(benchmark), [benchmark]);
  const trade = useMemo(() => tradeAnalytics(rows), [rows]);
  const risk = useMemo(() => riskAnalytics(rows, candles.length), [rows, candles.length]);
  const periods = useMemo(
    () => periodReturns(portfolio, benchmark, intervalKey),
    [portfolio, benchmark, intervalKey],
  );
  const months = useMemo(() => monthlyReturns(candles, rows), [candles, rows]);
  const twin = useMemo(
    () => performanceTwin(candles, DEFAULT_PARAMS, stat),
    [candles, stat],
  );
  const improve = useMemo(
    () => improvements(rows, trade, stat, twin),
    [rows, trade, stat, twin],
  );

  const best = [...rows].sort((a, b) => b.result.returnPct - a.result.returnPct)[0];
  const worst = [...rows].sort((a, b) => a.result.returnPct - b.result.returnPct)[0];
  const totalTrades = rows.reduce((a, r) => a + r.result.trades.length, 0);
  const winRate = totalTrades
    ? (rows.reduce((a, r) => a + (r.result.winRate / 100) * r.result.trades.length, 0) /
        totalTrades) *
      100
    : 0;
  const profitFactor = rows.length
    ? rows.reduce((a, r) => a + r.result.profitFactor * r.weight, 0)
    : 0;

  // A single 0-100 read on the whole book.
  const score = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        profitFactor * 24 + winRate * 0.35 - stat.maxDrawdown * 1.1 + stat.sharpe * 4,
      ),
    ),
  );

  const summary = useMemo(() => {
    if (!best || candles.length === 0) return "กำลังรวบรวมผลย้อนหลัง…";
    const alpha = stat.returnPct - benchStat.returnPct;

    return (
      `ในช่วงที่ทดสอบ ระบบเปิดสถานะทั้งหมด ${totalTrades} ครั้ง อัตราชนะรวม ${winRate.toFixed(1)}% ` +
      `กลยุทธ์ที่ทำผลงานดีที่สุดคือ ${best.name} (${fmtPct(best.result.returnPct)}) ` +
      `ส่วน ${worst?.name} ให้ผล ${fmtPct(worst?.result.returnPct ?? 0)} จึงควรทบทวนการใช้งาน · ` +
      `พอร์ตรวมให้ผล ${fmtPct(stat.returnPct)} เทียบกับการถือยาว ${fmtPct(benchStat.returnPct)} ` +
      `คิดเป็นส่วนต่าง ${fmtPct(alpha)} ที่ Max Drawdown ${stat.maxDrawdown.toFixed(2)}%`
    );
  }, [best, worst, stat, benchStat, totalTrades, winRate, candles.length]);

  const exportReport = (kind: string) => {
    const payload = rows.map((r) => ({
      strategy: r.name,
      ai: r.aiName,
      weight: r.weight,
      returnPct: Number(r.result.returnPct.toFixed(4)),
      winRate: Number(r.result.winRate.toFixed(2)),
      profitFactor: Number(r.result.profitFactor.toFixed(3)),
      maxDrawdown: Number(r.result.maxDrawdown.toFixed(3)),
      trades: r.result.trades.length,
    }));

    const body =
      kind === "CSV"
        ? [
            "strategy,ai,weight,returnPct,winRate,profitFactor,maxDrawdown,trades",
            ...payload.map((p) => Object.values(p).join(",")),
          ].join("\n")
        : JSON.stringify({ symbol, interval: intervalKey, portfolio: stat, rows: payload }, null, 2);

    try {
      const blob = new Blob([body], {
        type: kind === "CSV" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexora-performance-${symbol}-${intervalKey}.${kind.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
      setExported(kind);
      setTimeout(() => setExported(null), 2500);
    } catch {
      /* download blocked — nothing else to do */
    }
  };

  const kpis = [
    {
      th: "ผลตอบแทนรวม",
      en: "Total Return",
      value: fmtPct(stat.returnPct),
      tone: stat.returnPct >= 0 ? "text-up" : "text-down",
      sub: `ถือยาว ${fmtPct(benchStat.returnPct)}`,
    },
    { th: "Sharpe", en: "", value: stat.sharpe.toFixed(2), tone: stat.sharpe >= 1 ? "text-up" : undefined },
    { th: "Sortino", en: "", value: stat.sortino.toFixed(2) },
    {
      th: "Max Drawdown",
      en: "",
      value: `${stat.maxDrawdown.toFixed(2)}%`,
      tone: stat.maxDrawdown > 15 ? "text-down" : "text-up",
    },
    { th: "อัตราชนะ", en: "Win Rate", value: `${winRate.toFixed(1)}%` },
    { th: "Profit Factor", en: "", value: profitFactor.toFixed(2), tone: profitFactor >= 1.3 ? "text-up" : "text-warn" },
    { th: "Calmar", en: "", value: stat.calmar.toFixed(2) },
    { th: "จำนวนไม้", en: "Trades", value: `${totalTrades}` },
  ];

  const execKpis = [
    { th: "ผลตอบแทนพอร์ต", value: fmtPct(stat.returnPct), tone: stat.returnPct >= 0 ? "text-up" : "text-down" },
    { th: "เหนือการถือยาว", value: fmtPct(stat.returnPct - benchStat.returnPct), tone: stat.returnPct >= benchStat.returnPct ? "text-up" : "text-down" },
    { th: "Max Drawdown", value: `${stat.maxDrawdown.toFixed(2)}%` },
    { th: "Sharpe", value: stat.sharpe.toFixed(2) },
    { th: "อัตราชนะ", value: `${winRate.toFixed(1)}%` },
    { th: "จำนวนไม้", value: `${totalTrades}` },
    { th: "AI ที่ดีที่สุด", value: best?.aiName ?? "—", tone: "text-up" },
    { th: "AI ที่อ่อนที่สุด", value: worst?.aiName ?? "—", tone: "text-down" },
    { th: "แท่งเทียนที่ใช้", value: fmtNum(candles.length, 0) },
    { th: "เลเวอเรจที่ตั้งไว้", value: `${risk.leverage}X` },
  ];

  const benchmarks = [
    { label: "พอร์ต AI", returnPct: stat.returnPct, color: "#14e2a0" },
    { label: `${symbol.replace("USDT", "")} ถือยาว`, returnPct: benchStat.returnPct, color: "#a78bfa" },
    ...rows.slice(0, 3).map((r) => ({
      label: r.name,
      returnPct: r.result.returnPct,
      color: r.color,
    })),
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="panel flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
        <span className="text-[10px] text-dim">ช่วงเวลาที่วิเคราะห์</span>
        {INTERVALS.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => setIntervalKey(i.key)}
            className={`rounded px-2 py-[3px] text-[10px] ${
              intervalKey === i.key
                ? "bg-brand text-black"
                : "text-muted hover:bg-[#0f1c26] hover:text-txt"
            }`}
          >
            {i.th}
          </button>
        ))}
        <span className="num ml-auto text-[9.5px] text-dim">
          {loading ? "กำลังโหลดข้อมูล…" : `${candles.length.toLocaleString()} แท่ง · ${symbol}`}
        </span>
        {exported && (
          <span className="text-[9.5px] text-up">ดาวน์โหลดไฟล์ {exported} แล้ว</span>
        )}
      </div>

      <KpiStrip cards={kpis} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <EquityCurvePanel
          portfolio={portfolio}
          benchmark={benchmark}
          stat={stat}
          benchStat={benchStat}
        />
        <AttributionPanel rows={rows} />
      </div>

      <StrategyTable rows={rows} />

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ScatterPanel rows={rows} benchStat={benchStat} />
        <PeriodPanel periods={periods} benchmarks={benchmarks} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TradePanel data={trade} />
        <RiskPanel data={risk} stat={stat} />
      </div>

      <MonthlyPanel cells={months} />

      <ExecutivePanel score={score} summary={summary} kpis={execKpis} />

      <div className="grid gap-2.5 xl:grid-cols-2">
        <TwinPanel rows={twin} />
        <ImprovementPanel items={improve} onExport={exportReport} />
      </div>
    </div>
  );
}
