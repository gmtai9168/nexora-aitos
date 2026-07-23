"use client";

import { useMemo, useState } from "react";
import type { BookSummary } from "@/lib/book";
import { bkkTime, fmtNum } from "@/lib/format";
import { useMarket, useNow } from "@/lib/market-context";
import type { Performance, RiskItem } from "@/lib/portfolio-intel";
import { Panel, Tag } from "../Panel";

const RANGES = [
  { key: "1d", th: "1 วัน", bars: 24 },
  { key: "7d", th: "7 วัน", bars: 60 },
  { key: "30d", th: "30 วัน", bars: 120 },
  { key: "all", th: "ทั้งหมด", bars: 400 },
] as const;

/** Section 8 — equity curve with the drawdown band underneath it. */
export function EquityCurvePanel({ curve }: { curve: number[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("7d");
  const bars = RANGES.find((r) => r.key === range)!.bars;
  const series = curve.slice(-bars);

  const { path, ddPath, min, max, maxDd } = useMemo(() => {
    if (series.length < 2) {
      return { path: "", ddPath: "", min: 0, max: 0, maxDd: 0 };
    }
    const w = 100;
    const h = 100;
    const lo = Math.min(...series);
    const hi = Math.max(...series);
    const span = hi - lo || 1;

    const pts = series.map((v, i) => {
      const x = (i / (series.length - 1)) * w;
      const y = h - ((v - lo) / span) * (h - 6) - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    // Drawdown from the running peak, plotted as depth below the top edge.
    let peak = series[0];
    let worst = 0;
    const dd = series.map((v, i) => {
      if (v > peak) peak = v;
      const d = peak ? ((peak - v) / peak) * 100 : 0;
      if (d > worst) worst = d;
      const x = (i / (series.length - 1)) * w;
      return { x, d };
    });
    const ddScale = worst || 1;
    const ddPts = dd.map((p) => `${p.x.toFixed(2)},${(100 - (p.d / ddScale) * 26).toFixed(2)}`);

    return {
      path: pts.join(" "),
      ddPath: `0,100 ${ddPts.join(" ")} 100,100`,
      min: lo,
      max: hi,
      maxDd: worst,
    };
  }, [series]);

  const up = series.length > 1 && series.at(-1)! >= series[0];

  return (
    <Panel
      title="เส้นการเติบโตของพอร์ต"
      titleEn="Equity Curve"
      right={
        <div className="flex items-center gap-1">
          <Tag tone={maxDd > 6 ? "down" : "up"}>DD {maxDd.toFixed(2)}%</Tag>
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              className={`rounded px-1.5 py-[2px] text-[9px] ${
                range === r.key
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {r.th}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5"
    >
      {series.length < 2 ? (
        <p className="py-12 text-center text-[11px] text-dim">กำลังสร้างเส้นการเติบโต…</p>
      ) : (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[190px] w-full">
            <defs>
              <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0.28" />
                <stop offset="100%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${path} 100,100`} fill="url(#eq-fill)" />
            <polygon points={ddPath} fill="rgba(255,74,104,0.14)" />
            <polyline
              points={path}
              fill="none"
              stroke={up ? "#14e2a0" : "#ff4a68"}
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <div className="flex justify-between text-[9px] text-dim">
            <span className="num">ต่ำสุด {fmtNum(min, 0)}</span>
            <span className="text-down">แถบแดง = Drawdown จากจุดสูงสุด</span>
            <span className="num">สูงสุด {fmtNum(max, 0)}</span>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Section 9 — the performance panel. */
export function PerformancePanel({ perf }: { perf: Performance }) {
  const rows: [string, string, string, string?][] = [
    ["อัตราชนะ", "Win Rate", `${perf.winRate.toFixed(1)}%`, perf.winRate >= 55 ? "text-up" : undefined],
    ["กำไรเฉลี่ยต่อไม้ชนะ", "Average Win", `${perf.avgWin.toFixed(2)}%`, "text-up"],
    ["ขาดทุนเฉลี่ยต่อไม้แพ้", "Average Loss", `${perf.avgLoss.toFixed(2)}%`, "text-down"],
    ["Profit Factor", "", perf.profitFactor.toFixed(2), perf.profitFactor >= 2 ? "text-up" : undefined],
    ["Sharpe Ratio", "", perf.sharpe.toFixed(2), perf.sharpe >= 2 ? "text-up" : undefined],
    ["Sortino Ratio", "", perf.sortino.toFixed(2), perf.sortino >= 2 ? "text-up" : undefined],
    ["Recovery Factor", "", perf.recoveryFactor.toFixed(2)],
    ["Max Drawdown", "", `${perf.maxDrawdown.toFixed(2)}%`, perf.maxDrawdown > 8 ? "text-down" : "text-up"],
    [
      "ถือเฉลี่ย",
      "Avg Holding",
      perf.avgHoldingMin >= 60
        ? `${(perf.avgHoldingMin / 60).toFixed(1)} ชม.`
        : `${perf.avgHoldingMin.toFixed(0)} นาที`,
    ],
  ];

  return (
    <Panel
      title="วิเคราะห์ผลงาน"
      titleEn="Performance Analytics"
      right={<Tag tone="warn">DEMO</Tag>}
      bodyClassName="p-2.5"
    >
      {rows.map(([th, en, v, tone]) => (
        <div
          key={th}
          className="flex items-center justify-between border-b border-line-soft py-[5px] text-[10.5px] last:border-0"
        >
          <span className="min-w-0">
            <span className="text-muted">{th}</span>
            {en && <span className="ml-1 text-[9px] text-dim">{en}</span>}
          </span>
          <span className={`num font-semibold ${tone ?? "text-txt"}`}>{v}</span>
        </div>
      ))}
      <p className="mt-1.5 border-t border-line-soft pt-1.5 text-[9px] leading-snug text-dim">
        Win Rate · Profit Factor · กำไร/ขาดทุนเฉลี่ย คำนวณจากสถานะที่เปิดอยู่จริงตามราคาตลาด
        ส่วน Sharpe · Sortino · Drawdown วัดจากเส้นการเติบโตชุดเดียวกับกราฟด้านซ้าย
      </p>
    </Panel>
  );
}

/** Sections 13 + 15 — the audit trail and the standing guardian policy. */
export function GuardianPanel({
  book,
  risks,
  drawdown,
}: {
  book: BookSummary;
  risks: RiskItem[];
  drawdown: number;
}) {
  const { lastUpdate, regime, decision, emergencyStop } = useMarket();
  const now = useNow(10000);

  const events = useMemo(() => {
    if (!lastUpdate || now === null) return [];
    const step = 90_000;
    const worst = [...risks].sort((a, b) => b.level - a.level)[0];

    return [
      {
        at: lastUpdate - step * 4,
        who: "Portfolio Engine",
        what: `รวมสถานะ ${book.positions.length} รายการ · notional ${fmtNum(book.notional, 0)} USD`,
      },
      {
        at: lastUpdate - step * 3,
        who: "Exposure AI",
        what: `Long ${book.longShare.toFixed(0)}% / Short ${(100 - book.longShare).toFixed(0)}%`,
      },
      {
        at: lastUpdate - step * 2,
        who: "Correlation AI",
        what: "ตรวจสหสัมพันธ์ 120 วันของทุกคู่ในพอร์ต",
      },
      {
        at: lastUpdate - step,
        who: "Risk AI",
        what: `ความเสี่ยงสูงสุดคือ${worst?.th ?? "—"} ที่ระดับ ${worst?.level.toFixed(0) ?? "—"}`,
      },
      {
        at: lastUpdate,
        who: "Portfolio Guardian AI",
        what: emergencyStop
          ? "ระบบถูกสั่งหยุด — Guardian ระงับการปรับพอร์ตทั้งหมด"
          : drawdown > 6
            ? "Drawdown เกินเกณฑ์ — เตรียมลดเลเวอเรจอัตโนมัติ"
            : `เฝ้าดูต่อเนื่อง · ${regime.labelTh} · มติล่าสุด ${decision?.action ?? "—"}`,
      },
    ].reverse();
  }, [lastUpdate, now, book, risks, drawdown, regime, decision, emergencyStop]);

  const triggers = [
    { th: "Drawdown เกิน 6%", armed: drawdown > 6, action: "ลดเลเวอเรจลงครึ่งหนึ่ง" },
    { th: "Margin Usage เกิน 45%", armed: book.marginRatio > 45, action: "ปิดสถานะที่อ่อนที่สุด" },
    { th: "ขาดทุนวันนี้เกิน 2%", armed: book.dayPnlPct < -2, action: "หยุดเปิดสถานะใหม่" },
    {
      th: "ความเสี่ยงมากกว่า 2 มิติอยู่โซนสูง",
      armed: risks.filter((r) => r.level >= 67).length > 2,
      action: "เปิด Hedge อัตโนมัติ",
    },
  ];

  return (
    <Panel
      title="Portfolio Guardian AI"
      titleEn="Guardian & Timeline"
      right={
        <Tag tone={triggers.some((t) => t.armed) ? "down" : "up"}>
          {triggers.some((t) => t.armed) ? "มีเงื่อนไขถูกกระตุ้น" : "เฝ้าดูปกติ 24 ชม."}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">เงื่อนไขที่ Guardian เฝ้าอยู่</div>
        <ul className="space-y-[3px]">
          {triggers.map((t) => (
            <li key={t.th} className="flex items-start gap-1.5">
              <span
                className={`mt-[5px] size-1.5 shrink-0 rounded-full ${
                  t.armed ? "bg-down dot-live" : "bg-[#33505f]"
                }`}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[10px] ${t.armed ? "text-down" : "text-muted"}`}
                >
                  {t.th}
                </span>
                <span className="block truncate text-[9px] text-dim">→ {t.action}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">ไทม์ไลน์การทำงาน</div>
        {events.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-dim">กำลังบันทึก…</p>
        ) : (
          <ol className="space-y-[3px]">
            {events.map((e) => (
              <li key={`${e.at}-${e.who}`} className="flex gap-2">
                <span className="num shrink-0 text-[9px] text-dim">
                  {bkkTime(new Date(e.at))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[10px] text-brand">{e.who}</span>
                  <span className="block truncate text-[9.5px] text-muted">{e.what}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  );
}
