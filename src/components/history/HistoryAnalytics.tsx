"use client";

import { useMemo, useState } from "react";
import { fmtCompact } from "@/lib/format";
import type { Analytics, Slice } from "@/lib/trade-history";
import { Panel, Tag } from "../Panel";

/* ------------------------------------------------------------------ *
 * Daily P&L with a cumulative line on top
 * ------------------------------------------------------------------ */

export function DailyPnlPanel({ a }: { a: Analytics }) {
  const view = useMemo(() => {
    if (a.daily.length < 2) return null;
    const maxBar = Math.max(...a.daily.map((d) => Math.abs(d.pnl)), 1);
    const cums = a.daily.map((d) => d.cumulative);
    const lo = Math.min(...cums, 0);
    const hi = Math.max(...cums, 0);
    const span = hi - lo || 1;
    const w = 100 / a.daily.length;

    return {
      bars: a.daily.map((d, i) => ({
        x: i * w,
        w: Math.max(w * 0.78, 0.3),
        h: (Math.abs(d.pnl) / maxBar) * 42,
        up: d.pnl >= 0,
      })),
      line: a.daily
        .map((d, i) => `${(i * w + w / 2).toFixed(2)},${(100 - ((d.cumulative - lo) / span) * 92 - 4).toFixed(2)}`)
        .join(" "),
      zeroY: 100 - ((0 - lo) / span) * 92 - 4,
      first: a.daily[0].date,
      last: a.daily.at(-1)!.date,
      total: cums.at(-1)!,
    };
  }, [a.daily]);

  return (
    <Panel
      title="กำไรขาดทุนรายวัน"
      titleEn="Daily P&L"
      right={
        view && (
          <Tag tone={view.total >= 0 ? "up" : "down"}>
            สะสม {view.total >= 0 ? "+" : "−"}
            {fmtCompact(Math.abs(view.total))}
          </Tag>
        )
      }
      bodyClassName="p-2.5"
    >
      {!view ? (
        <p className="py-12 text-center text-[11px] text-dim">ยังไม่มีข้อมูลพอสำหรับกราฟรายวัน</p>
      ) : (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[150px] w-full">
            <line
              x1="0"
              y1={view.zeroY}
              x2="100"
              y2={view.zeroY}
              stroke="#47616f"
              strokeWidth="0.5"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
            {view.bars.map((b, i) => (
              <rect
                key={i}
                x={b.x}
                y={b.up ? view.zeroY - b.h : view.zeroY}
                width={b.w}
                height={Math.max(b.h, 0.4)}
                fill={b.up ? "#14e2a0" : "#ff4a68"}
                opacity="0.42"
              />
            ))}
            <polyline
              points={view.line}
              fill="none"
              stroke="#00d4ff"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="mt-1 flex justify-between text-[8.5px] text-dim">
            <span className="num">{view.first}</span>
            <span>แท่ง = กำไรขาดทุนรายวัน · เส้นฟ้า = สะสม</span>
            <span className="num">{view.last}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Breakdown tabs
 * ------------------------------------------------------------------ */

const TABS = [
  { id: "symbol", label: "รายเหรียญ" },
  { id: "bot", label: "รายบอท AI" },
  { id: "strategy", label: "รายกลยุทธ์" },
  { id: "hour", label: "รายชั่วโมง" },
  { id: "weekday", label: "รายวัน" },
  { id: "side", label: "Long / Short" },
  { id: "regime", label: "สภาวะตลาด" },
  { id: "exit", label: "สาเหตุที่ปิด" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SliceBars({ slices }: { slices: Slice[] }) {
  const active = slices.filter((s) => s.trades > 0);
  if (active.length === 0) {
    return <p className="py-10 text-center text-[10px] text-dim">ไม่มีรายการในกลุ่มนี้</p>;
  }
  const maxAbs = Math.max(...active.map((s) => Math.abs(s.pnl)), 1);

  return (
    <ul className="space-y-1">
      {slices.map((s) => (
        <li key={s.key} className={`flex items-center gap-2 ${s.trades ? "" : "opacity-35"}`}>
          <span className="flex w-[104px] shrink-0 items-center gap-1.5">
            {s.color && (
              <span className="h-[9px] w-[3px] shrink-0 rounded" style={{ background: s.color }} />
            )}
            <span className="truncate text-[10px] text-muted">{s.label}</span>
          </span>
          <span className="num w-[36px] shrink-0 text-right text-[9px] text-dim">{s.trades}</span>
          <span className="num w-[42px] shrink-0 text-right text-[9px] text-muted">
            {s.trades ? `${s.winRate.toFixed(0)}%` : "—"}
          </span>
          <span className="relative h-[10px] flex-1 overflow-hidden rounded-sm bg-[#0d1922]">
            <span
              className="absolute inset-y-0 left-0 rounded-sm"
              style={{
                width: `${(Math.abs(s.pnl) / maxAbs) * 100}%`,
                background: s.pnl >= 0 ? "#14e2a0" : "#ff4a68",
                opacity: 0.7,
              }}
            />
          </span>
          <span
            className={`num w-[66px] shrink-0 text-right text-[10px] ${
              s.pnl > 0 ? "text-up" : s.pnl < 0 ? "text-down" : "text-dim"
            }`}
          >
            {s.trades ? fmtCompact(s.pnl) : "—"}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BreakdownPanel({ a }: { a: Analytics }) {
  const [tab, setTab] = useState<TabId>("symbol");

  const slices: Slice[] =
    tab === "symbol"
      ? a.bySymbol
      : tab === "bot"
        ? a.byBot
        : tab === "strategy"
          ? a.byStrategy
          : tab === "hour"
            ? a.byHour
            : tab === "weekday"
              ? a.byWeekday
              : tab === "side"
                ? a.bySide
                : tab === "regime"
                  ? a.byRegime
                  : a.byExit;

  const traded = slices.filter((s) => s.trades > 0);
  const best = [...traded].sort((x, y) => y.pnl - x.pnl)[0];
  const worst = [...traded].sort((x, y) => x.pnl - y.pnl)[0];

  return (
    <Panel
      title="วิเคราะห์ผลการเทรด"
      titleEn="Trade Analytics"
      right={<Tag tone="neutral">{traded.length} กลุ่ม</Tag>}
      bodyClassName="p-2.5"
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-1.5 py-[3px] text-[9.5px] transition-colors ${
              tab === t.id ? "bg-brand text-black font-semibold" : "bg-[#0d1922] text-muted hover:text-txt"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-1 flex gap-2 text-[8.5px] text-dim">
        <span className="w-[104px] shrink-0">กลุ่ม</span>
        <span className="w-[36px] shrink-0 text-right">ไม้</span>
        <span className="w-[42px] shrink-0 text-right">ชนะ</span>
        <span className="flex-1">กำไรขาดทุนสุทธิ</span>
        <span className="w-[66px] shrink-0 text-right">รวม</span>
      </div>

      <SliceBars slices={slices} />

      {best && worst && (
        <p className="mt-1.5 text-[9px] leading-snug text-dim">
          ดีที่สุด <span className="text-up">{best.label}</span> ({best.trades} ไม้ ·{" "}
          {fmtCompact(best.pnl)}) · แย่ที่สุด <span className="text-down">{worst.label}</span> (
          {worst.trades} ไม้ · {fmtCompact(worst.pnl)})
          {tab === "hour" && " · เวลาไทย (UTC+7)"}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Win / loss distribution
 * ------------------------------------------------------------------ */

export function DistributionPanel({
  a,
  wins,
  losses,
  breakeven,
}: {
  a: Analytics;
  wins: number;
  losses: number;
  breakeven: number;
}) {
  const max = Math.max(...a.rDistribution.map((d) => d.count), 1);
  const total = wins + losses + breakeven;

  return (
    <Panel
      title="การกระจายผลต่อไม้"
      titleEn="Win / Loss Distribution"
      right={<Tag tone={wins >= losses ? "up" : "down"}>{total} ไม้ที่ปิดแล้ว</Tag>}
      bodyClassName="p-2.5"
    >
      <div className="mb-2 flex h-[14px] overflow-hidden rounded">
        <span
          className="flex items-center justify-center bg-up/70 text-[8.5px] font-bold text-black"
          style={{ width: `${total ? (wins / total) * 100 : 0}%` }}
        >
          {total && wins / total > 0.12 ? `ชนะ ${wins}` : ""}
        </span>
        <span
          className="flex items-center justify-center bg-[#6b8497] text-[8.5px] text-black"
          style={{ width: `${total ? (breakeven / total) * 100 : 0}%` }}
        />
        <span
          className="flex items-center justify-center bg-down/70 text-[8.5px] font-bold text-black"
          style={{ width: `${total ? (losses / total) * 100 : 0}%` }}
        >
          {total && losses / total > 0.12 ? `แพ้ ${losses}` : ""}
        </span>
      </div>

      <div className="flex h-[104px] items-end gap-[4px]">
        {a.rDistribution.map((d, i) => (
          <span key={i} className="flex flex-1 flex-col items-center gap-[3px]">
            <span className="num text-[8px] text-dim">{d.count || ""}</span>
            <span
              className="w-full rounded-t"
              style={{
                height: `${(d.count / max) * 72}px`,
                background: i === 4 ? "#6b8497" : d.positive ? "#14e2a0" : "#ff4a68",
                opacity: 0.8,
              }}
            />
            <span className="num text-[7.5px] text-dim">{d.label}</span>
          </span>
        ))}
      </div>

      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        แกนนอนคือผลต่อไม้เทียบกับความเสี่ยงที่วางไว้ (R) — +2R คือได้กำไรสองเท่าของเงินที่ยอมเสีย
        แท่งซ้ายมือคือไม้ที่ขาดทุน แท่งขวามือคือไม้ที่ทำกำไร
      </p>
    </Panel>
  );
}
