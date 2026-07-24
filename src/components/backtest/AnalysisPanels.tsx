"use client";

import { useMemo, useState } from "react";
import {
  EXIT_META,
  REGIME_META,
  type Bucket,
  type Distribution,
  type LabResult,
  type LabTrade,
} from "@/lib/backtest-lab";
import { fmtCompact, fmtNum, fmtPrice } from "@/lib/format";
import type { Candle } from "@/lib/types";
import { Panel, Tag } from "../Panel";

const dt = (unix: number) =>
  new Date(unix * 1000).toLocaleString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

/* ------------------------------------------------------------------ *
 * 7. Trade distribution
 * ------------------------------------------------------------------ */

const TABS = [
  { id: "hour", label: "ชั่วโมง" },
  { id: "weekday", label: "วันในสัปดาห์" },
  { id: "month", label: "เดือน" },
  { id: "regime", label: "สภาวะตลาด" },
  { id: "side", label: "ทิศทาง" },
  { id: "outcome", label: "สาเหตุที่ปิด" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function BucketBars({ buckets, dense }: { buckets: Bucket[]; dense: boolean }) {
  const active = buckets.filter((b) => b.trades > 0);
  if (active.length === 0) {
    return <p className="py-8 text-center text-[10px] text-dim">ไม่มีไม้ในกลุ่มนี้</p>;
  }

  const maxAbs = Math.max(...active.map((b) => Math.abs(b.pnl)), 1);

  return (
    <div>
      <div className={`flex items-end gap-[3px] ${dense ? "h-[92px]" : "h-[104px]"}`}>
        {buckets.map((b, i) => {
          const h = (Math.abs(b.pnl) / maxAbs) * (dense ? 78 : 88);
          return (
            <span key={i} className="group relative flex flex-1 flex-col justify-end" title={`${b.label} · ${b.trades} ไม้ · ${fmtCompact(b.pnl)}`}>
              <span
                className="w-full rounded-t"
                style={{
                  height: `${b.trades ? Math.max(h, 2) : 0}px`,
                  background: b.pnl >= 0 ? "#14e2a0" : "#ff4a68",
                  opacity: b.trades ? 0.55 + Math.min(b.trades / 20, 0.45) : 0,
                }}
              />
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded border border-line bg-[#0b141d] px-1.5 py-1 text-[9px] text-txt group-hover:block">
                <span className="block">{b.label}</span>
                <span className="num block text-dim">
                  {b.trades} ไม้ · ชนะ {b.winRate.toFixed(0)}%
                </span>
                <span className={`num block ${b.pnl >= 0 ? "text-up" : "text-down"}`}>
                  {fmtCompact(b.pnl)}
                </span>
              </span>
            </span>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {buckets.map((b, i) => (
          <span
            key={i}
            className={`num flex-1 truncate text-center text-[7.5px] ${
              b.trades ? "text-muted" : "text-dim/50"
            }`}
          >
            {b.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DistributionPanel({ dist, total }: { dist: Distribution; total: number }) {
  const [tab, setTab] = useState<TabId>("hour");

  const buckets: Bucket[] =
    tab === "hour"
      ? dist.byHour
      : tab === "weekday"
        ? dist.byWeekday
        : tab === "month"
          ? dist.byMonth
          : tab === "regime"
            ? dist.byRegime
            : tab === "side"
              ? dist.bySide
              : [];

  const best = [...buckets].filter((b) => b.trades >= 2).sort((a, b) => b.pnl - a.pnl)[0];
  const worst = [...buckets].filter((b) => b.trades >= 2).sort((a, b) => a.pnl - b.pnl)[0];

  return (
    <Panel
      title="การกระจายของการเทรด"
      titleEn="Trade Distribution"
      right={<Tag tone="neutral">{total} ไม้</Tag>}
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

      {tab === "outcome" ? (
        <ul className="space-y-1.5 py-1">
          {dist.byOutcome.length === 0 && (
            <li className="py-8 text-center text-[10px] text-dim">ยังไม่มีไม้ที่ปิด</li>
          )}
          {dist.byOutcome.map((o) => (
            <li key={o.label} className="flex items-center gap-2">
              <span className="w-[86px] shrink-0 truncate text-[10px] text-muted">{o.label}</span>
              <span className="h-[11px] flex-1 overflow-hidden rounded-sm bg-[#0d1922]">
                <span
                  className="block h-full rounded-sm"
                  style={{ width: `${(o.count / Math.max(total, 1)) * 100}%`, background: o.color }}
                />
              </span>
              <span className="num w-[68px] shrink-0 text-right text-[10px] text-txt">
                {o.count} · {((o.count / Math.max(total, 1)) * 100).toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <BucketBars buckets={buckets} dense={tab === "hour" || tab === "month"} />
      )}

      {tab !== "outcome" && best && worst && (
        <p className="mt-1.5 text-[9px] leading-snug text-dim">
          ดีที่สุด <span className="text-up">{best.label}</span> ({best.trades} ไม้ · ชนะ{" "}
          {best.winRate.toFixed(0)}% · {fmtCompact(best.pnl)}) · แย่ที่สุด{" "}
          <span className="text-down">{worst.label}</span> ({worst.trades} ไม้ · ชนะ{" "}
          {worst.winRate.toFixed(0)}% · {fmtCompact(worst.pnl)})
          {tab === "hour" && " · เวลาไทย (UTC+7)"}
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 10. Market regime performance
 * ------------------------------------------------------------------ */

export function RegimePanel({ dist }: { dist: Distribution }) {
  const rows = dist.byRegime;
  const traded = rows.filter((r) => r.trades > 0);
  const maxAbs = Math.max(...traded.map((r) => Math.abs(r.pnl)), 1);

  return (
    <Panel
      title="ผลตามสภาวะตลาด"
      titleEn="Market Regime Performance"
      right={<Tag tone="neutral">{traded.length}/7 สภาวะที่พบ</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[8.5px] uppercase tracking-wide text-dim">
            <th className="px-2.5 py-1.5 font-medium">สภาวะตลาด</th>
            <th className="px-1 py-1.5 text-right font-medium">ไม้</th>
            <th className="px-1 py-1.5 text-right font-medium">ชนะ</th>
            <th className="px-1 py-1.5 text-right font-medium">กำไรสุทธิ</th>
            <th className="w-[26%] px-2.5 py-1.5 font-medium">คำแนะนำ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const meta = REGIME_META[r.kind];
            const none = r.trades === 0;
            const advice = none
              ? "ไม่พบในช่วงข้อมูล"
              : r.pnl > 0 && r.winRate >= 50
                ? "เปิดใช้งาน"
                : r.pnl > 0
                  ? "ใช้ได้ · เฝ้าดู"
                  : "ควรปิดใช้งาน";
            const tone = none
              ? "text-dim"
              : advice === "เปิดใช้งาน"
                ? "text-up"
                : advice === "ใช้ได้ · เฝ้าดู"
                  ? "text-warn"
                  : "text-down";
            return (
              <tr key={r.kind} className="border-t border-line-soft text-[10.5px]">
                <td className="px-2.5 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[10px] w-[3px] shrink-0 rounded" style={{ background: meta.color }} />
                    <span className="min-w-0">
                      <span className={`block truncate ${none ? "text-dim" : "text-txt"}`}>{meta.th}</span>
                      <span className="block truncate text-[8.5px] text-dim">{meta.en}</span>
                    </span>
                  </span>
                </td>
                <td className="num px-1 py-[6px] text-right text-muted">{r.trades || "—"}</td>
                <td className="num px-1 py-[6px] text-right text-muted">
                  {r.trades ? `${r.winRate.toFixed(0)}%` : "—"}
                </td>
                <td
                  className={`num px-1 py-[6px] text-right ${
                    none ? "text-dim" : r.pnl >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {r.trades ? fmtCompact(r.pnl) : "—"}
                </td>
                <td className="px-2.5 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-[7px] flex-1 overflow-hidden rounded-sm bg-[#0d1922]">
                      <span
                        className="block h-full rounded-sm"
                        style={{
                          width: `${(Math.abs(r.pnl) / maxAbs) * 100}%`,
                          background: r.pnl >= 0 ? "#14e2a0" : "#ff4a68",
                        }}
                      />
                    </span>
                    <span className={`shrink-0 text-[9px] ${tone}`}>{advice}</span>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-2.5 py-1.5 text-[9px] leading-snug text-dim">
        สภาวะตลาดถูกจำแนกจากแท่งเทียนตอนเปิดสถานะ — ความชัน EMA, เปอร์เซ็นไทล์ของ ATR,
        และแท่งที่ช่วงกว้างเกิน 4 เท่า ATR พร้อมวอลุ่มเกิน 3 เท่า จะถูกนับเป็นลูกโซ่ล้างพอร์ต
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 8. Trade list + replay
 * ------------------------------------------------------------------ */

function TradeReplay({ trade, candles }: { trade: LabTrade; candles: Candle[] }) {
  const view = useMemo(() => {
    const pad = Math.max(12, Math.round((trade.exitIndex - trade.entryIndex) * 0.8));
    const from = Math.max(0, trade.entryIndex - pad);
    const to = Math.min(candles.length - 1, trade.exitIndex + pad);
    const slice = candles.slice(from, to + 1);
    if (slice.length < 3) return null;

    const lo = Math.min(...slice.map((c) => c.low), trade.stop, trade.target);
    const hi = Math.max(...slice.map((c) => c.high), trade.stop, trade.target);
    const span = hi - lo || 1;
    const y = (v: number) => 100 - ((v - lo) / span) * 92 - 4;
    const w = 100 / slice.length;

    return {
      slice,
      from,
      bars: slice.map((c, i) => ({
        x: i * w + w / 2,
        w: Math.max(w * 0.62, 0.4),
        top: y(c.high),
        bottom: y(c.low),
        openY: y(c.open),
        closeY: y(c.close),
        up: c.close >= c.open,
      })),
      entryX: (trade.entryIndex - from) * w + w / 2,
      exitX: (trade.exitIndex - from) * w + w / 2,
      entryY: y(trade.entry),
      exitY: y(trade.exit),
      stopY: y(trade.stop),
      targetY: y(trade.target),
    };
  }, [trade, candles]);

  if (!view) return <p className="py-6 text-center text-[10px] text-dim">ข้อมูลไม่พอสำหรับย้อนดู</p>;

  const win = trade.pnlUsd > 0;

  return (
    <div className="rounded border border-line bg-[#08111a] p-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px]">
        <span className={`font-bold ${trade.side === "LONG" ? "text-up" : "text-down"}`}>
          #{trade.id} {trade.side}
        </span>
        <span className="num text-muted">
          เข้า {fmtPrice(trade.entry)} → ออก {fmtPrice(trade.exit)}
        </span>
        <span className={`num font-bold ${win ? "text-up" : "text-down"}`}>
          {win ? "+" : "−"}
          {fmtNum(Math.abs(trade.pnlUsd))} ({trade.r >= 0 ? "+" : ""}
          {trade.r.toFixed(2)}R)
        </span>
        <span className="num text-dim">ถือ {trade.holdBars} แท่ง · {trade.holdHours.toFixed(1)} ชม.</span>
        <span className="ml-auto rounded border border-line px-1.5 py-[1px] text-[8.5px] text-muted">
          {REGIME_META[trade.regime].th}
        </span>
      </div>

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[150px] w-full">
        <line x1="0" y1={view.targetY} x2="100" y2={view.targetY} stroke="#14e2a0" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={view.stopY} x2="100" y2={view.stopY} stroke="#ff4a68" strokeWidth="0.5" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
        {view.bars.map((b, i) => (
          <g key={i}>
            <line
              x1={b.x}
              y1={b.top}
              x2={b.x}
              y2={b.bottom}
              stroke={b.up ? "#14e2a0" : "#ff4a68"}
              strokeWidth="0.4"
              vectorEffect="non-scaling-stroke"
              opacity="0.75"
            />
            <rect
              x={b.x - b.w / 2}
              y={Math.min(b.openY, b.closeY)}
              width={b.w}
              height={Math.max(Math.abs(b.closeY - b.openY), 0.6)}
              fill={b.up ? "#14e2a0" : "#ff4a68"}
              opacity="0.75"
            />
          </g>
        ))}
        <line
          x1={view.entryX}
          y1="0"
          x2={view.entryX}
          y2="100"
          stroke="#00d4ff"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1={view.exitX}
          y1="0"
          x2={view.exitX}
          y2="100"
          stroke="#ffb020"
          strokeWidth="0.7"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={view.entryX} cy={view.entryY} r="1.4" fill="#00d4ff" />
        <circle cx={view.exitX} cy={view.exitY} r="1.4" fill="#ffb020" />
      </svg>

      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[8.5px]">
        <span className="text-brand">▎เข้า {dt(trade.entryTime)}</span>
        <span className="text-warn">▎ออก {dt(trade.exitTime)}</span>
        <span className="num text-up">- - เป้าหมาย {fmtPrice(trade.target)}</span>
        <span className="num text-down">- - จุดตัดขาดทุน {fmtPrice(trade.stop)}</span>
      </div>

      <dl className="mt-1.5 grid gap-1 sm:grid-cols-2">
        <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
          <dt className="text-[8.5px] text-up">เหตุผลที่เข้า</dt>
          <dd className="text-[9.5px] leading-snug text-muted">{trade.entryReason}</dd>
        </div>
        <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
          <dt className="text-[8.5px] text-down">เหตุผลที่ออก</dt>
          <dd className="text-[9.5px] leading-snug text-muted">
            {EXIT_META[trade.exitReason].th} · ค่าธรรมเนียม {fmtNum(trade.feeUsd)} · Funding{" "}
            {fmtNum(trade.fundingUsd)} · Slippage {fmtNum(trade.slippageUsd)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

const FILTERS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "win", label: "ชนะ" },
  { id: "loss", label: "แพ้" },
  { id: "long", label: "Long" },
  { id: "short", label: "Short" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function TradeListPanel({
  r,
  candles,
  onExportCsv,
}: {
  r: LabResult;
  candles: Candle[];
  onExportCsv: () => void;
}) {
  const [filter, setFilter] = useState<FilterId>("all");
  const [openId, setOpenId] = useState<number | null>(null);
  const [limit, setLimit] = useState(25);

  const rows = useMemo(() => {
    const list = r.trades.filter((t) =>
      filter === "win"
        ? t.pnlUsd > 0
        : filter === "loss"
          ? t.pnlUsd <= 0
          : filter === "long"
            ? t.side === "LONG"
            : filter === "short"
              ? t.side === "SHORT"
              : true,
    );
    return [...list].reverse();
  }, [r.trades, filter]);

  const shown = rows.slice(0, limit);
  const openTrade = openId === null ? null : r.trades.find((t) => t.id === openId) ?? null;

  return (
    <Panel
      title="รายการเทรดทั้งหมด"
      titleEn="Trade List"
      right={
        <div className="flex items-center gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setLimit(25);
              }}
              className={`rounded px-1.5 py-[2px] text-[9px] transition-colors ${
                filter === f.id ? "bg-brand text-black" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onExportCsv}
            disabled={r.trades.length === 0}
            className="rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:text-txt disabled:opacity-35"
          >
            Export CSV
          </button>
        </div>
      }
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-dim">{r.note || "ไม่มีไม้ที่ตรงเงื่อนไขนี้"}</p>
      ) : (
        <>
          <div className="max-h-[430px] overflow-auto">
            <table className="w-full min-w-[1180px] border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-[#0b141d]">
                <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                  <th className="px-2 py-1.5 font-medium">#</th>
                  <th className="px-2 py-1.5 font-medium">เวลาเข้า → ออก</th>
                  <th className="px-1.5 py-1.5 font-medium">Side</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Entry</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Exit</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">SL</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">TP</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Lev</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Fee</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Funding</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Slip</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">P&amp;L</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">R</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">ถือ</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">AI</th>
                  <th className="px-1.5 py-1.5 font-medium">สภาวะ</th>
                  <th className="px-2 py-1.5 font-medium">ออกเพราะ</th>
                  <th className="px-2 py-1.5 text-right font-medium">ผล</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const win = t.pnlUsd > 0;
                  const open = openId === t.id;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setOpenId(open ? null : t.id)}
                      className={`cursor-pointer border-t border-line-soft text-[10px] transition-colors ${
                        open ? "bg-[#0e1f26]" : "hover:bg-[#0d1922]"
                      }`}
                    >
                      <td className="num px-2 py-[5px] text-dim">{t.id}</td>
                      <td className="num whitespace-nowrap px-2 py-[5px] text-muted">
                        {dt(t.entryTime)} <span className="text-dim">→</span> {dt(t.exitTime)}
                      </td>
                      <td className={`px-1.5 py-[5px] font-semibold ${t.side === "LONG" ? "text-up" : "text-down"}`}>
                        {t.side === "LONG" ? "Buy" : "Sell"}
                      </td>
                      <td className="num px-1.5 py-[5px] text-right text-txt">{fmtPrice(t.entry)}</td>
                      <td className="num px-1.5 py-[5px] text-right text-txt">{fmtPrice(t.exit)}</td>
                      <td className="num px-1.5 py-[5px] text-right text-down/70">{fmtPrice(t.stop)}</td>
                      <td className="num px-1.5 py-[5px] text-right text-up/70">{fmtPrice(t.target)}</td>
                      <td className="num px-1.5 py-[5px] text-right text-dim">{t.leverage}x</td>
                      <td className="num px-1.5 py-[5px] text-right text-warn/80">−{fmtNum(t.feeUsd)}</td>
                      <td className={`num px-1.5 py-[5px] text-right ${t.fundingUsd > 0 ? "text-warn/80" : "text-up/70"}`}>
                        {t.fundingUsd >= 0 ? "−" : "+"}
                        {fmtNum(Math.abs(t.fundingUsd))}
                      </td>
                      <td className="num px-1.5 py-[5px] text-right text-warn/80">−{fmtNum(t.slippageUsd)}</td>
                      <td className={`num px-1.5 py-[5px] text-right font-bold ${win ? "text-up" : "text-down"}`}>
                        {win ? "+" : "−"}
                        {fmtNum(Math.abs(t.pnlUsd))}
                      </td>
                      <td className={`num px-1.5 py-[5px] text-right ${t.r >= 0 ? "text-up" : "text-down"}`}>
                        {t.r >= 0 ? "+" : ""}
                        {t.r.toFixed(2)}
                      </td>
                      <td className="num px-1.5 py-[5px] text-right text-dim">
                        {t.holdHours < 24 ? `${t.holdHours.toFixed(1)}ชม.` : `${(t.holdHours / 24).toFixed(1)}ว.`}
                      </td>
                      <td className="num px-1.5 py-[5px] text-right text-brand">{t.confidence}%</td>
                      <td className="px-1.5 py-[5px]">
                        <span
                          className="rounded px-1 py-[1px] text-[8px]"
                          style={{
                            color: REGIME_META[t.regime].color,
                            background: `${REGIME_META[t.regime].color}18`,
                          }}
                        >
                          {REGIME_META[t.regime].th}
                        </span>
                      </td>
                      <td className="px-2 py-[5px] text-[9px] text-muted">{EXIT_META[t.exitReason].th}</td>
                      <td className={`px-2 py-[5px] text-right text-[9px] font-bold ${win ? "text-up" : "text-down"}`}>
                        {win ? "WIN" : "LOSS"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line-soft px-2.5 py-1.5">
            <span className="text-[9px] text-dim">
              แสดง {shown.length} จาก {rows.length} ไม้ · คลิกแถวเพื่อดูกราฟย้อนเหตุการณ์
            </span>
            {limit < rows.length && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + 50)}
                className="rounded border border-line px-2 py-[3px] text-[9.5px] text-muted hover:text-txt"
              >
                แสดงเพิ่ม 50 ไม้
              </button>
            )}
          </div>

          {openTrade && (
            <div className="border-t border-line-soft p-2.5">
              <TradeReplay trade={openTrade} candles={candles} />
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
