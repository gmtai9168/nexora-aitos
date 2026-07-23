"use client";

import { useMemo } from "react";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import { fmtCompact, fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "./Panel";
import { Sparkline } from "./viz";

function Metric({
  label,
  labelEn,
  value,
  tone,
  bar,
}: {
  label: string;
  labelEn: string;
  value: string;
  tone?: "up" | "down" | "warn";
  bar?: number;
}) {
  const color =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "warn" ? "text-warn" : "text-txt";
  return (
    <div className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
      <div className="truncate text-[9.5px] text-dim">
        {label} <span className="text-[8.5px]">{labelEn}</span>
      </div>
      <div className={`num truncate text-[14px] font-bold ${color}`}>{value}</div>
      {bar !== undefined && (
        <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#16242f]">
          <div
            className={`h-full rounded-full ${
              bar > 75 ? "bg-down" : bar > 45 ? "bg-warn" : "bg-up"
            }`}
            style={{ width: `${Math.min(100, Math.max(2, bar))}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PortfolioOverview() {
  const { quotes, candles } = useMarket();
  const book = useMemo(() => buildBook(quotes), [quotes]);
  const curve = useMemo(
    () => equityCurve(candles, book.equity),
    [candles, book.equity],
  );
  // Sharpe and drawdown come off the same curve the sparkline draws.
  const stats = useMemo(() => curveStats(curve), [curve]);

  const up = book.dayPnl >= 0;

  return (
    <Panel
      title="ภาพรวมพอร์ต"
      titleEn="Portfolio Overview"
      right={
        <div className="flex items-center gap-1.5">
          <Tag tone="warn">DEMO</Tag>
          <span className="chip px-2 py-[2px] text-[9.5px] text-muted">USD</span>
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2.5"
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div>
          <div className="text-[10px] text-dim">
            มูลค่าพอร์ตรวม <span className="text-[9px]">Total Equity</span>
          </div>
          <div className="num flex items-baseline gap-1.5">
            <span className="bg-gradient-to-b from-white to-[#9fc9dd] bg-clip-text text-[32px] font-extrabold leading-none text-transparent">
              {fmtNum(book.equity, 0)}
            </span>
            <span className="text-[11px] text-muted">USD</span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-[10px] text-dim">วันนี้</span>
            <span className={`num text-[15px] font-bold ${up ? "text-up" : "text-down"}`}>
              {fmtSigned(book.dayPnl, 0)}
            </span>
            <span className={`num text-[11px] ${up ? "text-up" : "text-down"}`}>
              {fmtPct(book.dayPnlPct)}
            </span>
          </div>
        </div>

        <div className="min-w-0 self-end">
          <div className="mb-0.5 flex items-center justify-between text-[9px] text-dim">
            <span>Equity Curve · เรียลไทม์</span>
            <span className="num">{fmtCompact(book.notional)} notional</span>
          </div>
          <Sparkline values={curve} height={64} stroke={up ? "#14e2a0" : "#ff4a68"} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-4">
        <Metric
          label="อัตราชนะ"
          labelEn="Win Rate"
          value={`${book.winRate.toFixed(0)}%`}
          tone={book.winRate >= 60 ? "up" : undefined}
        />
        <Metric
          label="Profit Factor"
          labelEn=""
          value={book.profitFactor.toFixed(2)}
          tone={book.profitFactor >= 2 ? "up" : undefined}
        />
        <Metric
          label="Sharpe"
          labelEn=""
          value={stats.sharpe.toFixed(2)}
          tone={stats.sharpe >= 2 ? "up" : undefined}
        />
        <Metric
          label="Drawdown"
          labelEn="สูงสุด"
          value={`${stats.drawdown.toFixed(2)}%`}
          tone={stats.drawdown > 8 ? "down" : stats.drawdown > 4 ? "warn" : "up"}
        />
        <Metric
          label="Free Margin"
          labelEn=""
          value={fmtCompact(book.availableMargin)}
        />
        <Metric
          label="Leverage"
          labelEn="ใช้จริง"
          value={`${book.leverage.toFixed(2)}x`}
          tone={book.leverage > 10 ? "warn" : undefined}
        />
        <Metric
          label="Margin Usage"
          labelEn=""
          value={`${book.marginRatio.toFixed(1)}%`}
          bar={book.marginRatio}
        />
        <Metric
          label="กำไรรวม"
          labelEn="Total P/L"
          value={fmtSigned(book.totalPnl, 0)}
          tone={book.totalPnl >= 0 ? "up" : "down"}
        />
      </div>
    </Panel>
  );
}
