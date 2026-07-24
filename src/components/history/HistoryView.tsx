"use client";

import { useEffect, useMemo, useState } from "react";
import {
  analytics,
  applyFilters,
  buildLedger,
  buildReport,
  deskConfig,
  DESKS,
  EMPTY_FILTERS,
  LEDGER_BASE,
  LEDGER_SYMBOLS,
  ledgerToCsv,
  ledgerToExcel,
  periodWindow,
  runLab,
  summarise,
  type DeskRun,
  type Filters,
  type LedgerRow,
  type Period,
  type ReportKind,
} from "@/lib/trade-history";
import type { Candle } from "@/lib/types";
import { Panel, Tag } from "../Panel";
import { BreakdownPanel, DailyPnlPanel, DistributionPanel } from "./HistoryAnalytics";
import { dtShort, ExportPanel, FiltersPanel, HistoryTable, SummaryBar } from "./HistoryPanels";
import { TradeDrawer } from "./TradeDrawer";

type Loaded = {
  rows: LedgerRow[];
  candles: Map<string, Candle[]>;
  latest: number;
  earliest: number;
  failures: string[];
};

const NO_ROWS: LedgerRow[] = [];

export function HistoryView() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: LEDGER_SYMBOLS.length, label: "" });
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<string | null>(null);

  // One pass per symbol: fetch its candles, then run all seven desks on them.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const runs: DeskRun[] = [];
      const candles = new Map<string, Candle[]>();
      const failures: string[] = [];

      for (let s = 0; s < LEDGER_SYMBOLS.length; s++) {
        const symbol = LEDGER_SYMBOLS[s];
        if (cancelled) return;
        setProgress({ done: s, total: LEDGER_SYMBOLS.length, label: symbol });

        let bars: Candle[] = [];
        try {
          const res = await fetch(
            `/api/history?symbol=${symbol}&interval=${LEDGER_BASE.interval}&bars=${LEDGER_BASE.bars}`,
          );
          const data: { candles?: Candle[] } = await res.json();
          bars = data.candles ?? [];
        } catch {
          bars = [];
        }
        if (cancelled) return;

        if (bars.length < 200) {
          failures.push(symbol);
          continue;
        }

        candles.set(symbol, bars);
        for (const desk of DESKS) {
          runs.push({ desk, symbol, result: runLab(bars, deskConfig(desk, symbol)) });
        }

        // Yield so the progress bar can paint between symbols.
        await new Promise((r) => setTimeout(r, 0));
      }

      if (cancelled) return;

      const rows = buildLedger(runs);
      if (rows.length === 0) {
        setError(
          failures.length
            ? `ดึงข้อมูลย้อนหลังไม่สำเร็จ (${failures.join(", ")})`
            : "ไม่พบรายการเทรดจากการจำลอง",
        );
        setProgress((p) => ({ ...p, done: p.total }));
        return;
      }

      setLoaded({
        rows,
        candles,
        latest: rows.at(-1)!.openTime,
        earliest: rows[0].openTime,
        failures,
      });
      setProgress((p) => ({ ...p, done: p.total }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = loaded?.rows ?? NO_ROWS;
  const latest = loaded?.latest ?? 0;

  const filtered = useMemo(
    () => applyFilters(rows, filters, latest),
    [rows, filters, latest],
  );
  const summary = useMemo(() => summarise(filtered), [filtered]);
  const stats = useMemo(() => analytics(filtered), [filtered]);

  const rangeLabel = useMemo(() => {
    if (!loaded) return "—";
    const { from, to } = periodWindow(filters, latest);
    const lo = Math.max(from, loaded.earliest);
    const hi = Math.min(to === Infinity ? latest : to, latest);
    return `${dtShort(lo)} – ${dtShort(hi)} (เวลาไทย)`;
  }, [filters, latest, loaded]);

  const selectedRow = selected ? (filtered.find((r) => r.key === selected) ?? null) : null;

  const setFiltersAndReset = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stamp = `${filters.period}-${filtered.length}`;
  const disclaimer =
    "# NEXORA AITOS — PAPER (simulated on real historical prices). No order was ever sent to an exchange.\n";

  const exportReport = (kind: ReportKind) => {
    download(
      `nexora-${kind}-report-${stamp}.txt`,
      buildReport(kind, filtered, summary, rangeLabel),
      "text/plain;charset=utf-8",
    );
  };

  const symbols = useMemo(() => [...new Set(rows.map((r) => r.symbol))], [rows]);
  const accounts = useMemo(() => [...new Set(rows.map((r) => r.account))], [rows]);
  const leverages = useMemo(
    () => [...new Set(rows.map((r) => r.leverage))].sort((a, b) => a - b),
    [rows],
  );

  if (!loaded) {
    const pct = Math.round((progress.done / progress.total) * 100);
    return (
      <Panel
        title="กำลังสร้างประวัติการเทรด"
        titleEn="Building Ledger"
        right={<Tag tone={error ? "down" : "warn"}>{error ? "ผิดพลาด" : `${pct}%`}</Tag>}
        bodyClassName="p-4"
      >
        {error ? (
          <p className="py-10 text-center text-[11px] text-down">{error}</p>
        ) : (
          <>
            <p className="mb-2 text-center text-[11px] text-muted">
              ดึงแท่งเทียนจริง {LEDGER_BASE.bars.toLocaleString()} แท่ง ({LEDGER_BASE.interval}) ของ{" "}
              {LEDGER_SYMBOLS.length} เหรียญ แล้วเดินระบบจำลอง {DESKS.length} บอทต่อเหรียญ
            </p>
            <p className="mb-3 text-center text-[10px] text-dim">
              {progress.label ? `กำลังประมวลผล ${progress.label}…` : "กำลังเริ่ม…"}
            </p>
            <div className="mx-auto h-[6px] w-full max-w-[420px] overflow-hidden rounded-full bg-[#0d1922]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand to-up transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <SummaryBar
        s={summary}
        filters={filters}
        rangeLabel={rangeLabel}
        onPeriod={(p: Period) => setFiltersAndReset({ ...filters, period: p })}
        onCustom={(from, to) =>
          setFiltersAndReset({ ...filters, period: "custom", fromDate: from, toDate: to })
        }
      />

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <HistoryTable
            rows={filtered}
            page={page}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={setPageSize}
            activeKey={selected}
            onSelect={(r) => setSelected(r.key)}
          />

          <DailyPnlPanel a={stats} />

          <div className="grid items-start gap-2.5 xl:grid-cols-2">
            <BreakdownPanel a={stats} />
            <DistributionPanel
              a={stats}
              wins={summary.wins}
              losses={summary.losses}
              breakeven={summary.breakeven}
            />
          </div>

          <ExportPanel
            count={filtered.length}
            onCsv={() =>
              download(`nexora-trade-history-${stamp}.csv`, disclaimer + ledgerToCsv(filtered), "text/csv;charset=utf-8")
            }
            onExcel={() =>
              download(
                `nexora-trade-history-${stamp}.xls`,
                disclaimer + ledgerToExcel(filtered),
                "application/vnd.ms-excel;charset=utf-8",
              )
            }
            onPdf={() => window.print()}
            onReport={exportReport}
          />
        </div>

        <FiltersPanel
          filters={filters}
          onChange={setFiltersAndReset}
          onReset={() => setFiltersAndReset(EMPTY_FILTERS)}
          symbols={symbols}
          accounts={accounts}
          leverages={leverages}
          matched={filtered.length}
          total={rows.length}
        />
      </div>

      <p className="px-1 text-[9px] leading-relaxed text-dim">
        ประวัติทั้งหมดนี้สร้างจากการเดินระบบจำลองบน<strong className="text-muted">ราคาตลาดจริงย้อนหลัง</strong>{" "}
        {LEDGER_BASE.bars.toLocaleString()} แท่ง ({LEDGER_BASE.interval}) ของ {symbols.length} เหรียญจาก Binance
        โดย {DESKS.length} บอทที่ตั้งค่าต่างกัน — ราคา เวลา ค่าธรรมเนียม Funding Slippage
        และสภาวะตลาดเป็นค่าที่คำนวณจากข้อมูลจริงทั้งหมด
        แต่<strong className="text-warn">ไม่มีคำสั่งใดถูกส่งไปยังกระดานเทรดจริง</strong> ·
        สิ่งที่ให้ไม่ได้เพราะไม่มีข้อมูล: Latency การส่งคำสั่ง, Open Interest ย้อนหลัง
        และการแยก Maker/Taker (แบบจำลองคิดเป็น Taker ทั้งสองข้างเสมอ)
        {loaded.failures.length > 0 && (
          <> · ดึงข้อมูลไม่สำเร็จ: {loaded.failures.join(", ")}</>
        )}
      </p>

      {selectedRow && (
        <TradeDrawer
          row={selectedRow}
          candles={loaded.candles.get(selectedRow.symbol) ?? []}
          peers={rows}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
