"use client";

import { useEffect, useRef, useState } from "react";
import {
  aiReview,
  compareStrategies,
  countSignals,
  dataQuality,
  distribution,
  DEFAULT_CONFIG,
  gateChecks,
  labMonteCarlo,
  labWalkForward,
  runLab,
  STRATEGY_META,
  tradesToCsv,
  type AiReview,
  type CompareRow,
  type DataQuality,
  type Distribution,
  type Gate,
  type LabConfig,
  type LabMonteCarlo,
  type LabResult,
  type LabWalkForward,
  type SignalScan,
} from "@/lib/backtest-lab";
import { findListing } from "@/lib/universe";
import type { Candle } from "@/lib/types";
import { Panel, Tag } from "../Panel";
import {
  ConfigPanel,
  RunBar,
  StrategyPanel,
  TopControls,
  type MarketClass,
} from "./ConfigPanels";
import { DistributionPanel, RegimePanel, TradeListPanel } from "./AnalysisPanels";
import { DrawdownPanel, EquityCurvePanel, KpiSummary } from "./ResultPanels";
import {
  ActionBar,
  AiPanel,
  ComparePanel,
  MonteCarloPanel,
  PipelinePanel,
  WalkForwardPanel,
} from "./ReviewPanels";

type Report = {
  cfg: LabConfig;
  candles: Candle[];
  quality: DataQuality;
  scan: SignalScan;
  result: LabResult;
  dist: Distribution;
  wf: LabWalkForward | null;
  mc: LabMonteCarlo | null;
  gates: Gate[];
  review: AiReview;
};

type SavedRun = {
  id: number;
  name: string;
  cfg: LabConfig;
  returnPct: number;
  maxDd: number;
  profitFactor: number;
  trades: number;
};

const MAX_DD_ALLOWED = 25;

/** Configs differ only where it changes the simulation, so compare by value. */
function sameConfig(a: LabConfig, b: LabConfig): boolean {
  return (Object.keys(a) as (keyof LabConfig)[]).every((k) => a[k] === b[k]);
}

export function BacktestView() {
  const [cfg, setCfg] = useState<LabConfig>(DEFAULT_CONFIG);
  const [market, setMarket] = useState<MarketClass>("crypto");

  const [pending, setPending] = useState<{ id: number; cfg: LabConfig } | null>({
    id: 1,
    cfg: DEFAULT_CONFIG,
  });
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(true);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fetchError, setFetchError] = useState("");

  const [report, setReport] = useState<Report | null>(null);
  const [compare, setCompare] = useState<CompareRow[]>([]);
  const [comparing, setComparing] = useState(false);
  const [saved, setSaved] = useState<SavedRun[]>([]);

  // Written and read only inside effects/handlers — never during render.
  const pausedRef = useRef(false);
  const cacheRef = useRef<{ key: string; data: Candle[] }>({ key: "", data: [] });

  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    const runCfg = pending.cfg;
    const key = `${runCfg.symbol}|${runCfg.interval}|${runCfg.bars}`;
    const started = performance.now();

    const holdWhilePaused = async () => {
      while (pausedRef.current && !cancelled) {
        await new Promise((r) => setTimeout(r, 120));
      }
    };

    /** Advances the progress bar and yields a frame so it can paint. */
    const step = async (i: number) => {
      await holdWhilePaused();
      if (cancelled) return false;
      setStage(i);
      setElapsed(performance.now() - started);
      await new Promise((r) => setTimeout(r, 0));
      return !cancelled;
    };

    const finish = () => {
      if (cancelled) return;
      setElapsed(performance.now() - started);
      setStage(8);
      setRunning(false);
      setPending(null);
    };

    (async () => {
      // 1 — load history
      if (!(await step(0))) return;
      let candles = cacheRef.current.key === key ? cacheRef.current.data : [];
      if (candles.length === 0) {
        try {
          const res = await fetch(
            `/api/history?symbol=${encodeURIComponent(runCfg.symbol)}&interval=${runCfg.interval}&bars=${runCfg.bars}`,
          );
          const data: { candles?: Candle[]; error?: string } = await res.json();
          candles = data.candles ?? [];
          cacheRef.current = { key, data: candles };
          if (!cancelled) setFetchError(data.error ?? (candles.length ? "" : "ไม่ได้รับข้อมูลจากแหล่งข้อมูล"));
        } catch {
          if (!cancelled) setFetchError("เชื่อมต่อแหล่งข้อมูลไม่สำเร็จ");
          candles = [];
        }
      } else if (!cancelled) {
        setFetchError("");
      }
      if (cancelled) return;

      // 2 — data quality
      if (!(await step(1))) return;
      const quality = dataQuality(candles);

      // 3 — signal generation
      if (!(await step(2))) return;
      const scan = countSignals(candles, runCfg);

      // 4 — order simulation (fees, funding and slippage are charged inside)
      if (!(await step(3))) return;
      const result = runLab(candles, runCfg);

      // 5 — trading costs
      if (!(await step(4))) return;

      // 6 — P&L breakdown
      if (!(await step(5))) return;
      const dist = distribution(result.trades);

      // 7 — risk analysis
      if (!(await step(6))) return;
      const wf = candles.length >= 600 ? labWalkForward(candles, runCfg) : null;
      const mc = labMonteCarlo(result);

      // 8 — report
      if (!(await step(7))) return;
      const gates = gateChecks(result, wf, mc, MAX_DD_ALLOWED);
      const review = aiReview(result, dist, wf, mc, gates);

      if (cancelled) return;
      setReport({ cfg: runCfg, candles, quality, scan, result, dist, wf, mc, gates, review });
      setCompare([]);
      finish();
    })();

    return () => {
      cancelled = true;
    };
  }, [pending]);

  const run = () => {
    pausedRef.current = false;
    setPaused(false);
    setRunning(true);
    setStage(0);
    setElapsed(0);
    setPending((p) => ({ id: (p?.id ?? 0) + 1, cfg }));
  };

  const cancel = () => {
    pausedRef.current = false;
    setPaused(false);
    setRunning(false);
    setPending(null);
    setStage(0);
  };

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const runCompare = () => {
    if (!report) return;
    setComparing(true);
    setTimeout(() => {
      setCompare(compareStrategies(report.candles, report.cfg));
      setComparing(false);
    }, 30);
  };

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    if (!report) return;
    download(
      `nexora-backtest-${report.cfg.symbol}-${report.cfg.interval}-${report.cfg.strategy}.csv`,
      "﻿" + tradesToCsv(report.result.trades),
      "text/csv;charset=utf-8",
    );
  };

  const duplicate = () => {
    if (!report) return;
    setSaved((prev) => [
      {
        id: prev.length + 1,
        name: `${STRATEGY_META[report.cfg.strategy].th} · ${report.cfg.symbol} ${report.cfg.interval}`,
        cfg: report.cfg,
        returnPct: report.result.returnPct,
        maxDd: report.result.maxDrawdown,
        profitFactor: report.result.profitFactor,
        trades: report.result.trades.length,
      },
      ...prev,
    ].slice(0, 8));
  };

  const dirty = report !== null && !sameConfig(report.cfg, cfg);
  const listing = findListing(cfg.symbol);

  return (
    <div className="flex flex-col gap-2.5">
      <TopControls
        cfg={cfg}
        onChange={setCfg}
        market={market}
        onMarket={setMarket}
        dataStatus={{
          loading: running && stage === 0,
          bars: report?.quality.bars ?? 0,
          from: report?.quality.from ?? 0,
          to: report?.quality.to ?? 0,
          error: fetchError,
        }}
        onReset={() => {
          setCfg(DEFAULT_CONFIG);
          setMarket("crypto");
        }}
      />

      <RunBar
        stage={stage}
        running={running}
        paused={paused}
        elapsedMs={elapsed}
        onRun={run}
        onPause={togglePause}
        onCancel={cancel}
        dirty={dirty}
      />

      {report === null ? (
        <Panel title="ผลการทดสอบ" titleEn="Results" bodyClassName="p-3">
          <p className="py-16 text-center text-[11px] text-dim">
            {running ? "กำลังประมวลผลรอบแรก…" : "กด Run Backtest เพื่อเริ่ม"}
          </p>
        </Panel>
      ) : (
        <>
          <KpiSummary r={report.result} />

          <div className="grid items-start gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
            <div className="flex flex-col gap-2.5">
              <ConfigPanel
                cfg={cfg}
                onChange={setCfg}
                onSave={duplicate}
                saved={saved.length}
              />
              <StrategyPanel cfg={cfg} onChange={setCfg} />
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              <EquityCurvePanel r={report.result} />
              <div className="grid items-start gap-2.5 xl:grid-cols-2">
                <DrawdownPanel r={report.result} />
                <DistributionPanel dist={report.dist} total={report.result.trades.length} />
              </div>
              <AiPanel review={report.review} r={report.result} />
            </div>
          </div>

          <TradeListPanel r={report.result} candles={report.candles} onExportCsv={exportCsv} />

          <div className="grid items-start gap-2.5 xl:grid-cols-2">
            <RegimePanel dist={report.dist} />
            <div className="flex min-w-0 flex-col gap-2.5">
              <WalkForwardPanel wf={report.wf} />
              <MonteCarloPanel mc={report.mc} />
            </div>
          </div>

          <ComparePanel
            rows={compare}
            current={report.cfg}
            running={comparing}
            onRun={runCompare}
            onApply={(row) => setCfg((c) => ({ ...c, strategy: row.kind }))}
          />

          <PipelinePanel r={report.result} wf={report.wf} mc={report.mc} gates={report.gates} />

          <ActionBar
            ready={report.review.ready}
            hasResult={report.result.trades.length > 0}
            onDuplicate={duplicate}
            onCompare={runCompare}
            onExportCsv={exportCsv}
            onExportPdf={() => window.print()}
            savedCount={saved.length}
          />

          <Panel
            title="บันทึกการรันในเซสชันนี้"
            titleEn="Saved Reports"
            right={<Tag tone="neutral">{saved.length} ชุด</Tag>}
            bodyClassName="p-0"
          >
            {saved.length === 0 ? (
              <p className="px-3 py-4 text-[10px] text-dim">
                ยังไม่มีชุดที่บันทึก — กด &ldquo;บันทึกค่าที่ตั้งไว้&rdquo; หรือ &ldquo;ทำสำเนาการทดสอบ&rdquo;
                เพื่อเก็บผลรอบนี้ไว้เทียบกับรอบถัดไป (เก็บในหน่วยความจำของแท็บนี้เท่านั้น)
              </p>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                    <th className="px-2.5 py-1.5 font-medium">ชุดทดสอบ</th>
                    <th className="px-1.5 py-1.5 text-right font-medium">Return</th>
                    <th className="px-1.5 py-1.5 text-right font-medium">PF</th>
                    <th className="px-1.5 py-1.5 text-right font-medium">Max DD</th>
                    <th className="px-1.5 py-1.5 text-right font-medium">ไม้</th>
                    <th className="px-2.5 py-1.5 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {saved.map((s) => (
                    <tr key={s.id} className="border-t border-line-soft text-[10.5px]">
                      <td className="px-2.5 py-[6px] text-muted">{s.name}</td>
                      <td className={`num px-1.5 py-[6px] text-right ${s.returnPct >= 0 ? "text-up" : "text-down"}`}>
                        {s.returnPct >= 0 ? "+" : ""}
                        {s.returnPct.toFixed(2)}%
                      </td>
                      <td className="num px-1.5 py-[6px] text-right text-muted">
                        {s.profitFactor.toFixed(2)}
                      </td>
                      <td className="num px-1.5 py-[6px] text-right text-muted">
                        {s.maxDd.toFixed(1)}%
                      </td>
                      <td className="num px-1.5 py-[6px] text-right text-dim">{s.trades}</td>
                      <td className="px-2.5 py-[6px] text-right">
                        <button
                          type="button"
                          onClick={() => setCfg(s.cfg)}
                          className="rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:text-txt"
                        >
                          เรียกคืนค่า
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <p className="px-1 text-[9px] leading-relaxed text-dim">
            ข้อมูลย้อนหลังของ {listing?.display ?? cfg.symbol} มาจาก{" "}
            {/^[A-Z0-9]+USDT$/.test(cfg.symbol) ? "Binance klines" : "Yahoo Finance"} ผ่าน{" "}
            <code className="text-muted">/api/history</code> · คุณภาพข้อมูล: {report.quality.noteTh} ·
            พบสัญญาณดิบ {report.scan.total.toLocaleString()} ครั้ง (ซื้อ {report.scan.long} · ขาย{" "}
            {report.scan.short}) แต่เปิดสถานะจริง {report.result.trades.length} ไม้
            เพราะติดเพดาน {cfg.maxPositions} Position พร้อมกันและตัวกรองทิศทาง ·
            การจำลองทั้งหมดเป็นการทดสอบย้อนหลังบนราคาที่เกิดขึ้นแล้ว
            ไม่ใช่การรับประกันผลในอนาคต และแพลตฟอร์มนี้ไม่ส่งคำสั่งซื้อขายจริง
          </p>
        </>
      )}
    </div>
  );
}
