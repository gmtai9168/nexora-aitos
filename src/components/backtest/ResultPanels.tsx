"use client";

import { useMemo, useState } from "react";
import type { LabResult } from "@/lib/backtest-lab";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import { Panel, Tag } from "../Panel";

/* ------------------------------------------------------------------ *
 * 5. KPI summary — colour follows the desk's pass / watch / fail bands
 * ------------------------------------------------------------------ */

type Band = "pass" | "watch" | "fail";

const BAND_CLASS: Record<Band, string> = {
  pass: "text-up",
  watch: "text-warn",
  fail: "text-down",
};

/** Higher is better unless `invert`, in which case lower is better. */
function band(value: number, good: number, ok: number, invert = false): Band {
  if (invert) return value <= good ? "pass" : value <= ok ? "watch" : "fail";
  return value >= good ? "pass" : value >= ok ? "watch" : "fail";
}

function Kpi({
  label,
  labelEn,
  value,
  sub,
  tone,
}: {
  label: string;
  labelEn: string;
  value: string;
  sub?: string;
  tone: Band;
}) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
      <div className="truncate text-[9px] text-muted">{label}</div>
      <div className="truncate text-[8px] text-dim">{labelEn}</div>
      <div className={`num mt-[2px] truncate text-[15px] font-bold ${BAND_CLASS[tone]}`}>{value}</div>
      {sub && <div className="num truncate text-[8.5px] text-dim">{sub}</div>}
    </div>
  );
}

export function KpiSummary({ r }: { r: LabResult }) {
  const cur = r.config.market === "futures" ? "USDT" : "USD";
  const passes = [
    band(r.profitFactor, 1.5, 1),
    band(r.maxDrawdown, 15, 25, true),
    band(r.winRate, 50, 40),
    band(r.sharpe, 1, 0.4),
  ];
  const ok = passes.filter((p) => p === "pass").length;

  return (
    <Panel
      title="สรุปผลสำคัญ"
      titleEn="KPI Summary"
      right={
        <Tag tone={ok >= 3 ? "up" : ok >= 2 ? "warn" : "down"}>
          ผ่านเกณฑ์หลัก {ok}/4
        </Tag>
      }
      bodyClassName="p-2"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-6">
        <Kpi
          label="กำไรสุทธิ"
          labelEn="Net Profit"
          value={`${r.netProfit >= 0 ? "+" : "−"}${fmtCompact(Math.abs(r.netProfit))}`}
          sub={cur}
          tone={r.netProfit > 0 ? "pass" : "fail"}
        />
        <Kpi
          label="ผลตอบแทนรวม"
          labelEn="Total Return"
          value={fmtPct(r.returnPct)}
          sub={`ถือยาว ${fmtPct(r.buyHoldPct)}`}
          tone={r.returnPct > r.buyHoldPct ? "pass" : r.returnPct > 0 ? "watch" : "fail"}
        />
        <Kpi
          label="อัตราชนะ"
          labelEn="Win Rate"
          value={`${r.winRate.toFixed(2)}%`}
          sub={`${r.trades.filter((t) => t.pnlUsd > 0).length} ชนะ / ${r.trades.filter((t) => t.pnlUsd <= 0).length} แพ้`}
          tone={band(r.winRate, 50, 40)}
        />
        <Kpi
          label="Profit Factor"
          labelEn="Profit Factor"
          value={r.profitFactor.toFixed(2)}
          sub={`เกณฑ์ ≥ 1.50`}
          tone={band(r.profitFactor, 1.5, 1)}
        />
        <Kpi
          label="Sharpe Ratio"
          labelEn="Sharpe (ต่อปี)"
          value={r.sharpe.toFixed(2)}
          tone={band(r.sharpe, 1, 0.4)}
        />
        <Kpi
          label="Sortino Ratio"
          labelEn="Sortino (ต่อปี)"
          value={r.sortino.toFixed(2)}
          tone={band(r.sortino, 1.4, 0.6)}
        />
        <Kpi
          label="Drawdown ลึกสุด"
          labelEn="Max Drawdown"
          value={`−${r.maxDrawdown.toFixed(2)}%`}
          tone={band(r.maxDrawdown, 15, 25, true)}
        />
        <Kpi
          label="จำนวนไม้"
          labelEn="Total Trades"
          value={r.trades.length.toLocaleString()}
          sub={`เกณฑ์ ≥ 30`}
          tone={band(r.trades.length, 30, 15)}
        />
        <Kpi
          label="กำไรเฉลี่ยต่อไม้ชนะ"
          labelEn="Average Win"
          value={`+${fmtCompact(r.avgWin)}`}
          tone="pass"
        />
        <Kpi
          label="ขาดทุนเฉลี่ยต่อไม้แพ้"
          labelEn="Average Loss"
          value={`−${fmtCompact(r.avgLoss)}`}
          tone="fail"
        />
        <Kpi
          label="Risk / Reward"
          labelEn="Avg Win ÷ Avg Loss"
          value={r.riskReward.toFixed(2)}
          tone={band(r.riskReward, 1.5, 1)}
        />
        <Kpi
          label="Recovery Factor"
          labelEn="Return ÷ Max DD"
          value={r.recoveryFactor.toFixed(2)}
          tone={band(r.recoveryFactor, 3, 1)}
        />
      </div>

      <div className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
        <Kpi label="CAGR" labelEn="ต่อปีทบต้น" value={fmtPct(r.cagr)} tone={r.cagr > 0 ? "pass" : "fail"} />
        <Kpi
          label="ค่าคาดหวังต่อไม้"
          labelEn="Expectancy"
          value={`${r.expectancy >= 0 ? "+" : "−"}${fmtNum(Math.abs(r.expectancy))}`}
          tone={r.expectancy > 0 ? "pass" : "fail"}
        />
        <Kpi
          label="ค่าธรรมเนียมรวม"
          labelEn="Total Fees"
          value={`−${fmtCompact(r.totalFees)}`}
          tone="watch"
        />
        <Kpi
          label="Funding รวม"
          labelEn="Total Funding"
          value={`${r.totalFunding >= 0 ? "−" : "+"}${fmtCompact(Math.abs(r.totalFunding))}`}
          sub={r.config.market === "spot" ? "Spot ไม่มี Funding" : undefined}
          tone={r.totalFunding > 0 ? "watch" : "pass"}
        />
        <Kpi
          label="Slippage รวม"
          labelEn="Total Slippage"
          value={`−${fmtCompact(r.totalSlippage)}`}
          tone="watch"
        />
      </div>

      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        เขียว = ผ่านเกณฑ์ · เหลือง = ต้องตรวจสอบ · แดง = ไม่ผ่าน · ทุกตัวเลขด้านบนเป็นค่าสุทธิ
        หลังหักต้นทุนแล้ว — ถ้าไม่คิดต้นทุนเลย ไม้ชุดเดียวกันนี้จะให้ผล{" "}
        <span className={r.grossBeforeCosts >= 0 ? "text-up" : "text-down"}>
          {r.grossBeforeCosts >= 0 ? "+" : "−"}
          {fmtCompact(Math.abs(r.grossBeforeCosts))}
        </span>{" "}
        {cur} แต่ต้นทุนรวม {fmtCompact(r.totalCosts)} (ค่าธรรมเนียม {fmtCompact(r.totalFees)} +
        Funding {fmtCompact(r.totalFunding)} + Slippage {fmtCompact(r.totalSlippage)}) ทำให้เหลือสุทธิ{" "}
        <span className={r.netProfit >= 0 ? "text-up" : "text-down"}>
          {r.netProfit >= 0 ? "+" : "−"}
          {fmtCompact(Math.abs(r.netProfit))}
        </span>
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 6. Equity curve with drawdown underneath and a real zoom
 * ------------------------------------------------------------------ */

const ZOOMS = [
  { id: "all", label: "ทั้งหมด" },
  { id: "1y", label: "1Y" },
  { id: "6m", label: "6M" },
  { id: "3m", label: "3M" },
  { id: "1m", label: "1M" },
] as const;

type ZoomId = (typeof ZOOMS)[number]["id"];

const ZOOM_DAYS: Record<ZoomId, number> = { all: 0, "1y": 365, "6m": 182, "3m": 91, "1m": 30 };

export function EquityCurvePanel({ r }: { r: LabResult }) {
  const [zoom, setZoom] = useState<ZoomId>("all");
  const [focusDd, setFocusDd] = useState(false);

  const view = useMemo(() => {
    const n = r.equity.length;
    if (n < 2) return null;

    let from = 0;
    let to = n - 1;

    if (focusDd && r.drawdown.clusters.length > 0) {
      // Widest view of the deepest drawdown, padded by a tenth on each side.
      const worst = r.drawdown.clusters[0];
      const s = r.times.findIndex((t) => t >= worst.startTime);
      const e = r.times.findIndex((t) => t >= worst.endTime);
      if (s >= 0) {
        const pad = Math.max(10, Math.round((e < 0 ? n - 1 : e - s) * 0.4));
        from = Math.max(0, s - pad);
        to = Math.min(n - 1, (e < 0 ? n - 1 : e) + pad);
      }
    } else if (zoom !== "all") {
      const cutoff = r.times[n - 1] - ZOOM_DAYS[zoom] * 86400;
      const idx = r.times.findIndex((t) => t >= cutoff);
      if (idx > 0) from = idx;
    }

    if (to - from < 2) return null;

    const eq = r.equity.slice(from, to + 1);
    const bh = r.buyHold.slice(from, to + 1);
    const dd = r.drawdown.series.slice(from, to + 1);
    const ts = r.times.slice(from, to + 1);

    const lo = Math.min(...eq, ...bh, r.config.capital);
    const hi = Math.max(...eq, ...bh, r.config.capital);
    const span = hi - lo || 1;
    const y = (v: number) => 100 - ((v - lo) / span) * 92 - 4;
    const x = (i: number) => (i / (eq.length - 1)) * 100;

    const path = (arr: number[]) =>
      arr.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(" ");

    const worstDd = Math.max(...dd, 1);
    const ddPath = dd.map((d, i) => `${x(i).toFixed(2)},${((d / worstDd) * 100).toFixed(2)}`).join(" ");

    const label = (t: number) =>
      new Date(t * 1000).toLocaleDateString("th-TH", { month: "short", year: "2-digit" });

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const i = Math.round(f * (ts.length - 1));
      return { x: x(i), label: label(ts[i]) };
    });

    return {
      equityPath: path(eq),
      holdPath: path(bh),
      capitalY: y(r.config.capital),
      ddPath,
      worstDd,
      ticks,
      lo,
      hi,
      from,
      to,
      count: eq.length,
    };
  }, [r, zoom, focusDd]);

  const up = r.returnPct >= 0;

  return (
    <Panel
      title="เส้นการเติบโตของทุน"
      titleEn="Equity Curve"
      right={
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFocusDd((v) => !v)}
            disabled={r.drawdown.clusters.length === 0}
            className={`rounded px-1.5 py-[2px] text-[9px] transition-colors disabled:opacity-30 ${
              focusDd ? "bg-down text-white" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
            }`}
          >
            ซูมช่วงขาดทุนหนัก
          </button>
          {ZOOMS.map((z) => (
            <button
              key={z.id}
              type="button"
              onClick={() => {
                setZoom(z.id);
                setFocusDd(false);
              }}
              className={`rounded px-1.5 py-[2px] text-[9px] transition-colors ${
                zoom === z.id && !focusDd
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {z.label}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5"
    >
      {!view ? (
        <p className="py-16 text-center text-[11px] text-dim">{r.note || "ยังไม่มีผลการทดสอบ"}</p>
      ) : (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px]">
            <span className="flex items-center gap-1 text-up">
              <span className="h-[2px] w-4 rounded" style={{ background: up ? "#14e2a0" : "#ff4a68" }} />
              กลยุทธ์ AI
            </span>
            <span className="flex items-center gap-1 text-muted">
              <span className="h-[2px] w-4 rounded bg-[#6b8497]" />
              ถือยาว (Buy &amp; Hold)
            </span>
            <span className="flex items-center gap-1 text-dim">
              <span className="h-[2px] w-4 rounded border-t border-dashed border-dim" />
              ทุนตั้งต้น {fmtCompact(r.config.capital)}
            </span>
            <span className="num ml-auto text-dim">
              แสดง {view.count.toLocaleString()} / {r.equity.length.toLocaleString()} แท่ง ·{" "}
              {fmtCompact(view.lo)} – {fmtCompact(view.hi)}
            </span>
          </div>

          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[196px] w-full">
            <defs>
              <linearGradient id="bt-eq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0.24" />
                <stop offset="100%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${view.equityPath} 100,100`} fill="url(#bt-eq)" />
            <line
              x1="0"
              y1={view.capitalY}
              x2="100"
              y2={view.capitalY}
              stroke="#47616f"
              strokeWidth="0.6"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={view.holdPath}
              fill="none"
              stroke="#6b8497"
              strokeWidth="1.1"
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              points={view.equityPath}
              fill="none"
              stroke={up ? "#14e2a0" : "#ff4a68"}
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div className="mt-1 flex justify-between px-[2px] text-[8.5px] text-dim">
            {view.ticks.map((t, i) => (
              <span key={i} className="num">
                {t.label}
              </span>
            ))}
          </div>

          <div className="mt-1.5">
            <div className="mb-[2px] flex items-baseline justify-between text-[9px]">
              <span className="text-down">Drawdown ใต้จุดสูงสุด</span>
              <span className="num text-dim">ลึกสุดในช่วงนี้ −{view.worstDd.toFixed(2)}%</span>
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[54px] w-full">
              <polygon points={`0,0 ${view.ddPath} 100,0`} fill="rgba(255,74,104,0.20)" />
              <polyline
                points={view.ddPath}
                fill="none"
                stroke="#ff4a68"
                strokeWidth="1.1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 9. Drawdown analysis
 * ------------------------------------------------------------------ */

export function DrawdownPanel({ r }: { r: LabResult }) {
  const d = r.drawdown;
  const hours = (bars: number) => (bars * r.barSec) / 3600;
  const dur = (bars: number) => {
    const h = hours(bars);
    if (h >= 48) return `${(h / 24).toFixed(1)} วัน`;
    if (h >= 1) return `${h.toFixed(1)} ชม.`;
    return `${(h * 60).toFixed(0)} นาที`;
  };

  const rows: { label: string; value: string; tone: string }[] = [
    { label: "Drawdown ปัจจุบัน", value: `−${d.current.toFixed(2)}%`, tone: d.current > 5 ? "text-down" : "text-txt" },
    { label: "Drawdown ลึกสุด", value: `−${d.max.toFixed(2)}%`, tone: d.max > 20 ? "text-down" : d.max > 10 ? "text-warn" : "text-up" },
    { label: "Drawdown เฉลี่ย", value: `−${d.avg.toFixed(2)}%`, tone: "text-muted" },
    { label: "ช่วงติดลบนานสุด", value: dur(d.longestBars), tone: "text-warn" },
    {
      label: "เวลาฟื้นตัว",
      value: d.recovered ? dur(d.recoveryBars) : "ยังไม่ฟื้น",
      tone: d.recovered ? "text-up" : "text-down",
    },
    {
      label: "แพ้ติดกันมากสุด",
      value: `${d.worstLossStreak} ไม้ (${fmtCompact(d.worstStreakUsd)})`,
      tone: d.worstLossStreak >= 5 ? "text-down" : "text-muted",
    },
  ];

  const maxDepth = Math.max(...d.clusters.map((c) => c.depth), 1);

  return (
    <Panel
      title="วิเคราะห์ช่วงขาดทุน"
      titleEn="Drawdown Analysis"
      right={
        <Tag tone={d.max > 25 ? "down" : d.max > 15 ? "warn" : "up"}>
          {r.config.leverage}x · {r.config.margin === "isolated" ? "Isolated" : "Cross"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.label} className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1">
            <div className="truncate text-[9px] text-muted">{row.label}</div>
            <div className={`num truncate text-[13px] font-bold ${row.tone}`}>{row.value}</div>
          </div>
        ))}
      </div>

      {d.clusters.length > 0 && (
        <div>
          <div className="mb-1 text-[9.5px] text-muted">
            กลุ่มการขาดทุนที่ลึกที่สุด (Loss Cluster)
          </div>
          <ul className="space-y-1">
            {d.clusters.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="num w-[92px] shrink-0 text-[9px] text-dim">
                  {new Date(c.startTime * 1000).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })}
                </span>
                <span className="h-[9px] flex-1 overflow-hidden rounded-sm bg-[#0d1922]">
                  <span
                    className="block h-full rounded-sm bg-down/70"
                    style={{ width: `${(c.depth / maxDepth) * 100}%` }}
                  />
                </span>
                <span className="num w-[54px] shrink-0 text-right text-[9.5px] text-down">
                  −{c.depth.toFixed(1)}%
                </span>
                <span className="num w-[62px] shrink-0 text-right text-[9px] text-dim">
                  {dur(c.bars)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[9px] leading-snug text-dim">
        {r.liquidations > 0 ? (
          <span className="text-down">
            คำเตือน: มี {r.liquidations} ไม้ที่ถูกบังคับปิดจากการชนราคา Liquidation ที่ Leverage{" "}
            {r.config.leverage}x — บัญชีเงินจริงจะเสียมาร์จินก้อนนั้นทันที
          </span>
        ) : (
          `ไม่มีไม้ใดชนราคา Liquidation ที่ Leverage ${r.config.leverage}x (${r.config.margin === "isolated" ? "แยกมาร์จินต่อไม้" : "ใช้ยอดคงเหลือทั้งบัญชีค้ำ"})`
        )}
      </p>
    </Panel>
  );
}
