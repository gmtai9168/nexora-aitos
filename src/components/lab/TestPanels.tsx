"use client";

import { useMemo } from "react";
import { fmtPct } from "@/lib/format";
import type { BacktestResult, MonteCarlo, WalkForward } from "@/lib/strategy";
import { Panel, Tag } from "../Panel";

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1">
      <div className="truncate text-[9px] text-dim">{label}</div>
      <div className={`num truncate text-[13px] font-bold ${tone ?? "text-txt"}`}>{value}</div>
    </div>
  );
}

/** Section 6 — equity curve, drawdown and the trade distribution. */
export function BacktestPanel({
  result,
  bars,
  loading,
  interval,
  onBars,
}: {
  result: BacktestResult;
  bars: number;
  loading: boolean;
  interval: string;
  onBars: (v: number) => void;
}) {
  const { curvePath, ddPath, hist } = useMemo(() => {
    const eq = result.equity;
    if (eq.length < 2) return { curvePath: "", ddPath: "", hist: [] as number[] };

    const lo = Math.min(...eq);
    const hi = Math.max(...eq);
    const span = hi - lo || 1;
    const pts = eq.map((v, i) => {
      const x = (i / (eq.length - 1)) * 100;
      const y = 100 - ((v - lo) / span) * 94 - 3;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });

    let peak = eq[0];
    let worst = 0;
    const dd = eq.map((v, i) => {
      if (v > peak) peak = v;
      const d = peak ? ((peak - v) / peak) * 100 : 0;
      if (d > worst) worst = d;
      return { x: (i / (eq.length - 1)) * 100, d };
    });
    const scale = worst || 1;

    // R-multiple histogram across 9 buckets from -3R to +3R.
    const buckets = new Array(9).fill(0);
    for (const t of result.trades) {
      const idx = Math.max(0, Math.min(8, Math.round(t.r * 1.5) + 4));
      buckets[idx]++;
    }

    return {
      curvePath: pts.join(" "),
      ddPath: `0,100 ${dd.map((p) => `${p.x.toFixed(2)},${(100 - (p.d / scale) * 24).toFixed(2)}`).join(" ")} 100,100`,
      hist: buckets,
    };
  }, [result]);

  const up = result.returnPct >= 0;
  const maxBucket = Math.max(...hist, 1);

  return (
    <Panel
      title="เครื่องมือทดสอบย้อนหลัง"
      titleEn="Backtesting Engine"
      right={
        <div className="flex items-center gap-1">
          <Tag tone={loading ? "warn" : "up"}>
            {loading ? "กำลังโหลด…" : `${result.bars} แท่ง · ${interval}`}
          </Tag>
          {[500, 1000, 2000, 3000].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onBars(b)}
              className={`rounded px-1.5 py-[2px] text-[9px] ${
                bars === b ? "bg-brand text-black" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        <Stat
          label="ผลตอบแทนรวม"
          value={fmtPct(result.returnPct)}
          tone={up ? "text-up" : "text-down"}
        />
        <Stat
          label="อัตราชนะ Win Rate"
          value={`${result.winRate.toFixed(1)}%`}
          tone={result.winRate >= 50 ? "text-up" : undefined}
        />
        <Stat
          label="Profit Factor"
          value={result.profitFactor.toFixed(2)}
          tone={result.profitFactor >= 1.5 ? "text-up" : result.profitFactor >= 1 ? "text-warn" : "text-down"}
        />
        <Stat
          label="Max Drawdown"
          value={`${result.maxDrawdown.toFixed(1)}%`}
          tone={result.maxDrawdown > 20 ? "text-down" : "text-txt"}
        />
        <Stat label="จำนวนไม้ Trades" value={`${result.trades.length}`} />
        <Stat label="ค่าเฉลี่ยต่อไม้" value={`${result.avgR.toFixed(2)}R`} tone={result.avgR >= 0 ? "text-up" : "text-down"} />
      </div>

      {result.trades.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-dim">
          {loading ? "กำลังดึงข้อมูลย้อนหลัง…" : "เงื่อนไขนี้ไม่เกิดสัญญาณเลยในช่วงที่ทดสอบ"}
        </p>
      ) : (
        <>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-[168px] w-full">
            <defs>
              <linearGradient id="bt-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0.26" />
                <stop offset="100%" stopColor={up ? "#14e2a0" : "#ff4a68"} stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={`0,100 ${curvePath} 100,100`} fill="url(#bt-fill)" />
            <polygon points={ddPath} fill="rgba(255,74,104,0.13)" />
            <polyline
              points={curvePath}
              fill="none"
              stroke={up ? "#14e2a0" : "#ff4a68"}
              strokeWidth="1.4"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <div>
            <div className="mb-1 text-[9.5px] text-dim">
              การกระจายผลต่อไม้ (R-multiple) · แถบแดงบนกราฟคือ Drawdown
            </div>
            <div className="flex h-[46px] items-end gap-[3px]">
              {hist.map((n, i) => (
                <span key={i} className="flex flex-1 flex-col items-center gap-[2px]">
                  <span
                    className="w-full rounded-t"
                    style={{
                      height: `${(n / maxBucket) * 38}px`,
                      background: i < 4 ? "#ff4a68" : i === 4 ? "#6b8497" : "#14e2a0",
                      opacity: 0.8,
                    }}
                  />
                  <span className="num text-[7.5px] text-dim">
                    {((i - 4) / 1.5).toFixed(1)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </>
      )}

      <p className="text-[9px] leading-snug text-dim">
        ทดสอบกับแท่งเทียนจริงย้อนหลัง · เข้าที่ราคาเปิดแท่งถัดจากสัญญาณ (ไม่มองอนาคต) ·
        หากราคาแตะทั้ง Stop และ TP ในแท่งเดียวกันจะนับเป็น Stop เสมอ · หักค่าธรรมเนียมทั้งขาเข้าและขาออก
      </p>
    </Panel>
  );
}

/** Section 7 — bootstrap Monte Carlo over the actual trade results. */
export function MonteCarloPanel({ mc }: { mc: MonteCarlo | null }) {
  const bars = useMemo(() => {
    if (!mc) return [];
    const lo = mc.p5;
    const hi = mc.p95;
    const span = hi - lo || 1;
    const buckets = new Array(24).fill(0);
    for (const v of mc.distribution) {
      const idx = Math.max(0, Math.min(23, Math.floor(((v - lo) / span) * 24)));
      buckets[idx]++;
    }
    return buckets;
  }, [mc]);

  if (!mc) {
    return (
      <Panel title="จำลองมอนติคาร์โล" titleEn="Monte Carlo" bodyClassName="p-3">
        <p className="py-10 text-center text-[11px] text-dim">
          ต้องมีอย่างน้อย 12 ไม้จึงจะจำลองได้ — ปรับพารามิเตอร์หรือขยายช่วงข้อมูล
        </p>
      </Panel>
    );
  }

  const max = Math.max(...bars, 1);

  return (
    <Panel
      title="จำลองมอนติคาร์โล"
      titleEn="Monte Carlo"
      right={
        <Tag tone={mc.probProfit >= 70 ? "up" : mc.probProfit >= 50 ? "warn" : "down"}>
          {mc.runs.toLocaleString()} รอบ
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Stat
          label="โอกาสได้กำไร"
          value={`${mc.probProfit.toFixed(1)}%`}
          tone={mc.probProfit >= 70 ? "text-up" : mc.probProfit >= 50 ? "text-warn" : "text-down"}
        />
        <Stat
          label="ผลตอบแทนกลาง"
          value={fmtPct(mc.medianReturn)}
          tone={mc.medianReturn >= 0 ? "text-up" : "text-down"}
        />
        <Stat
          label="Drawdown แย่สุด"
          value={`${mc.worstDrawdown.toFixed(1)}%`}
          tone={mc.worstDrawdown > 30 ? "text-down" : "text-warn"}
        />
        <Stat
          label="ความเสี่ยงหางยาว"
          value={mc.tailRisk}
          tone={mc.tailRisk === "ต่ำ" ? "text-up" : mc.tailRisk === "ปานกลาง" ? "text-warn" : "text-down"}
        />
      </div>

      <div className="flex h-[70px] items-end gap-[2px]">
        {bars.map((n, i) => (
          <span
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${(n / max) * 66}px`,
              background:
                mc.p5 + ((mc.p95 - mc.p5) * i) / 24 >= 0 ? "#14e2a0" : "#ff4a68",
              opacity: 0.75,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-dim">
        <span className="num">แย่สุด 5% · {fmtPct(mc.p5)}</span>
        <span>การกระจายผลตอบแทนจากการสุ่มลำดับไม้</span>
        <span className="num">ดีสุด 5% · {fmtPct(mc.p95)}</span>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        สุ่มสลับลำดับผลของไม้จริงทั้งหมด {mc.runs.toLocaleString()} รอบ
        เพื่อวัดว่าผลจาก Backtest มาจากฝีมือกลยุทธ์หรือมาจากโชคของลำดับเหตุการณ์
      </p>
    </Panel>
  );
}

/** Section 8 — in-sample vs out-of-sample. */
export function WalkForwardPanel({ wf }: { wf: WalkForward }) {
  return (
    <Panel
      title="ทดสอบแบบ Walk Forward"
      titleEn="Walk Forward Testing"
      right={<Tag tone={wf.overfit ? "down" : "up"}>{wf.overfit ? "พบ Overfitting" : "ผ่าน"}</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">ช่วงข้อมูล</th>
            <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
            <th className="px-2 py-1.5 text-right font-medium">Win Rate</th>
            <th className="px-2 py-1.5 text-right font-medium">PF</th>
            <th className="px-2 py-1.5 text-right font-medium">Max DD</th>
            <th className="px-3 py-1.5 text-right font-medium">ไม้</th>
          </tr>
        </thead>
        <tbody>
          {wf.windows.map((w) => (
            <tr key={w.label} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px] text-muted">{w.label}</td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  w.result.returnPct >= 0 ? "text-up" : "text-down"
                }`}
              >
                {fmtPct(w.result.returnPct)}
              </td>
              <td className="num px-2 py-[6px] text-right">{w.result.winRate.toFixed(1)}%</td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  w.result.profitFactor >= 1.3 ? "text-up" : "text-warn"
                }`}
              >
                {w.result.profitFactor.toFixed(2)}
              </td>
              <td className="num px-2 py-[6px] text-right text-muted">
                {w.result.maxDrawdown.toFixed(1)}%
              </td>
              <td className="num px-3 py-[6px] text-right text-dim">
                {w.result.trades.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p
        className={`border-t border-line-soft px-3 py-1.5 text-[9.5px] leading-snug ${
          wf.overfit ? "text-down" : "text-dim"
        }`}
      >
        {wf.verdictTh}
      </p>
    </Panel>
  );
}

/** Section 9 — strategy leaderboard. */
export function ComparePanel({
  rows,
}: {
  rows: { name: string; kind: string; result: BacktestResult }[];
}) {
  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];

  return (
    <Panel
      title="เปรียบเทียบกลยุทธ์"
      titleEn="Performance Compare"
      right={<Tag tone="up">AI เลือก {best?.name ?? "—"}</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">กลยุทธ์</th>
            <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
            <th className="px-2 py-1.5 text-right font-medium">Win Rate</th>
            <th className="px-2 py-1.5 text-right font-medium">PF</th>
            <th className="px-2 py-1.5 text-right font-medium">Max DD</th>
            <th className="px-3 py-1.5 text-right font-medium">ไม้</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.name}
              className={`border-t border-line-soft text-[10.5px] ${
                best && r.name === best.name ? "bg-[#0e1f26]" : ""
              }`}
            >
              <td className="px-3 py-[6px]">
                <span className="block truncate">{r.name}</span>
                <span className="block truncate text-[8.5px] text-dim">{r.kind}</span>
              </td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  r.result.returnPct >= 0 ? "text-up" : "text-down"
                }`}
              >
                {fmtPct(r.result.returnPct)}
              </td>
              <td className="num px-2 py-[6px] text-right">{r.result.winRate.toFixed(1)}%</td>
              <td className="num px-2 py-[6px] text-right font-bold text-brand">
                {r.result.profitFactor.toFixed(2)}
              </td>
              <td className="num px-2 py-[6px] text-right text-muted">
                {r.result.maxDrawdown.toFixed(1)}%
              </td>
              <td className="num px-3 py-[6px] text-right text-dim">
                {r.result.trades.length}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        ทุกแถวรัน Backtest กับข้อมูลชุดเดียวกันและช่วงเวลาเดียวกัน จึงเทียบกันได้ตรงไปตรงมา
      </p>
    </Panel>
  );
}
