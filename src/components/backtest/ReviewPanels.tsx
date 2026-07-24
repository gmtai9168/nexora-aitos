"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  STRATEGY_META,
  type AiReview,
  type CompareRow,
  type Gate,
  type LabConfig,
  type LabMonteCarlo,
  type LabResult,
  type LabWalkForward,
} from "@/lib/backtest-lab";
import { fmtCompact, fmtPct } from "@/lib/format";
import { RingGauge } from "../viz";
import { Panel, Tag } from "../Panel";

/* ------------------------------------------------------------------ *
 * 11. AI analysis & recommendation
 * ------------------------------------------------------------------ */

function Bullets({
  title,
  items,
  tone,
  empty,
}: {
  title: string;
  items: string[];
  tone: string;
  empty: string;
}) {
  return (
    <div>
      <div className={`mb-[3px] text-[9.5px] font-semibold ${tone}`}>{title}</div>
      {items.length === 0 ? (
        <p className="text-[9.5px] text-dim">{empty}</p>
      ) : (
        <ul className="space-y-[3px]">
          {items.map((t, i) => (
            <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-muted">
              <span className={`shrink-0 ${tone}`}>·</span>
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiPanel({ review, r }: { review: AiReview; r: LabResult }) {
  const color =
    review.score >= 85 ? "#14e2a0" : review.score >= 55 ? "#ffb020" : "#ff4a68";

  return (
    <Panel
      title="บทวิเคราะห์จาก AI"
      titleEn="AI Analysis & Recommendation"
      right={
        <Tag tone={review.ready ? "up" : "warn"}>
          {review.ready ? "พร้อมสำหรับ Paper Trading" : "ยังไม่ผ่านเกณฑ์"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <RingGauge value={review.score} size={104} label={review.grade} sub="ประสิทธิภาพรวม" color={color} />
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] leading-relaxed text-txt">{review.headline}</p>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
              <div className="text-[8.5px] text-dim">เหมาะกับสภาวะ</div>
              <div className="truncate text-[10px] text-up">{review.bestRegime}</div>
            </div>
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
              <div className="text-[8.5px] text-dim">ควรเลี่ยงสภาวะ</div>
              <div className="truncate text-[10px] text-down">{review.worstRegime}</div>
            </div>
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
              <div className="text-[8.5px] text-dim">ช่วงเวลาที่ดีที่สุด</div>
              <div className="num truncate text-[10px] text-brand">{review.bestHour}</div>
            </div>
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
              <div className="text-[8.5px] text-dim">เหมาะกับ</div>
              <div className="truncate text-[10px] text-muted">{review.suitability}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Bullets title="จุดแข็ง" items={review.strengths} tone="text-up" empty="ยังไม่พบจุดแข็งที่ผ่านเกณฑ์" />
        <Bullets title="จุดอ่อน" items={review.weaknesses} tone="text-warn" empty="ไม่พบจุดอ่อนที่มีนัยสำคัญ" />
        <Bullets title="ความเสี่ยง" items={review.risks} tone="text-down" empty="ไม่พบความเสี่ยงเฉพาะจากผลชุดนี้" />
        <Bullets title="สิ่งที่ควรปรับ" items={review.adjustments} tone="text-brand" empty="ไม่มีข้อเสนอปรับแต่งเพิ่มเติม" />
      </div>

      <p
        className={`rounded border px-2 py-1.5 text-[10px] leading-snug ${
          review.ready
            ? "border-up/30 bg-[#0d2b23] text-up"
            : "border-warn/30 bg-[#20180a] text-warn"
        }`}
      >
        {review.readyNote}
      </p>

      <p className="text-[9px] leading-snug text-dim">
        ทุกข้อความในบทวิเคราะห์นี้อ้างอิงตัวเลขจากผลทดสอบด้านบนโดยตรง —
        ไม่มีการเรียกโมเดลภาษาภายนอกและไม่มีข้อความที่เขียนไว้ล่วงหน้า ·
        ผลรวมไม้ที่ชนะ {fmtCompact(r.grossProfit)} · ผลรวมไม้ที่แพ้ {fmtCompact(r.grossLoss)} ·
        อัตราส่วนสองค่านี้คือ Profit Factor {r.profitFactor.toFixed(2)}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * Walk-forward & Monte Carlo
 * ------------------------------------------------------------------ */

export function WalkForwardPanel({ wf }: { wf: LabWalkForward | null }) {
  return (
    <Panel
      title="ทดสอบเดินหน้า"
      titleEn="Walk-Forward Analysis"
      right={wf ? <Tag tone={wf.overfit ? "down" : "up"}>{wf.overfit ? "พบ Overfitting" : "ผ่าน"}</Tag> : undefined}
      bodyClassName="p-0"
    >
      {!wf ? (
        <p className="py-10 text-center text-[11px] text-dim">ยังไม่ได้รัน</p>
      ) : (
        <>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="px-2.5 py-1.5 font-medium">ช่วงข้อมูล</th>
                <th className="px-1.5 py-1.5 text-right font-medium">ผลตอบแทน</th>
                <th className="px-1.5 py-1.5 text-right font-medium">ชนะ</th>
                <th className="px-1.5 py-1.5 text-right font-medium">PF</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Max DD</th>
                <th className="px-2.5 py-1.5 text-right font-medium">ไม้</th>
              </tr>
            </thead>
            <tbody>
              {wf.windows.map((w) => (
                <tr key={w.label} className="border-t border-line-soft text-[10.5px]">
                  <td className="px-2.5 py-[6px] text-muted">{w.label}</td>
                  <td className={`num px-1.5 py-[6px] text-right ${w.result.returnPct >= 0 ? "text-up" : "text-down"}`}>
                    {fmtPct(w.result.returnPct)}
                  </td>
                  <td className="num px-1.5 py-[6px] text-right text-muted">
                    {w.result.winRate.toFixed(0)}%
                  </td>
                  <td className={`num px-1.5 py-[6px] text-right ${w.result.profitFactor >= 1.3 ? "text-up" : "text-warn"}`}>
                    {w.result.profitFactor.toFixed(2)}
                  </td>
                  <td className="num px-1.5 py-[6px] text-right text-muted">
                    {w.result.maxDrawdown.toFixed(1)}%
                  </td>
                  <td className="num px-2.5 py-[6px] text-right text-dim">{w.result.trades.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`border-t border-line-soft px-2.5 py-1.5 text-[9.5px] leading-snug ${wf.overfit ? "text-down" : "text-dim"}`}>
            {wf.verdictTh}
          </p>
        </>
      )}
    </Panel>
  );
}

export function MonteCarloPanel({ mc }: { mc: LabMonteCarlo | null }) {
  const bars = useMemo(() => {
    if (!mc) return [];
    const lo = mc.p5;
    const hi = mc.p95;
    const span = hi - lo || 1;
    const buckets = new Array(28).fill(0);
    for (const v of mc.distribution) {
      buckets[Math.max(0, Math.min(27, Math.floor(((v - lo) / span) * 28)))]++;
    }
    return buckets;
  }, [mc]);

  if (!mc) {
    return (
      <Panel title="จำลองมอนติคาร์โล" titleEn="Monte Carlo Simulation" bodyClassName="p-3">
        <p className="py-10 text-center text-[11px] text-dim">
          ต้องมีอย่างน้อย 12 ไม้จึงจะจำลองได้
        </p>
      </Panel>
    );
  }

  const max = Math.max(...bars, 1);

  return (
    <Panel
      title="จำลองมอนติคาร์โล"
      titleEn="Monte Carlo Simulation"
      right={<Tag tone={mc.probProfit >= 70 ? "up" : mc.probProfit >= 50 ? "warn" : "down"}>{mc.runs.toLocaleString()} รอบ</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {[
          { l: "โอกาสได้กำไร", v: `${mc.probProfit.toFixed(1)}%`, t: mc.probProfit >= 70 ? "text-up" : mc.probProfit >= 50 ? "text-warn" : "text-down" },
          { l: "ผลตอบแทนกลาง", v: fmtPct(mc.median), t: mc.median >= 0 ? "text-up" : "text-down" },
          { l: "แย่สุด 5% (VaR)", v: fmtPct(mc.p5), t: "text-down" },
          { l: "โอกาสพอร์ตพัง", v: `${mc.riskOfRuin.toFixed(1)}%`, t: mc.riskOfRuin < 5 ? "text-up" : "text-down" },
        ].map((s) => (
          <div key={s.l} className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1">
            <div className="truncate text-[9px] text-muted">{s.l}</div>
            <div className={`num truncate text-[13px] font-bold ${s.t}`}>{s.v}</div>
          </div>
        ))}
      </div>

      <div className="flex h-[76px] items-end gap-[2px]">
        {bars.map((n, i) => (
          <span
            key={i}
            className="flex-1 rounded-t"
            style={{
              height: `${(n / max) * 72}px`,
              background: mc.p5 + ((mc.p95 - mc.p5) * i) / 28 >= 0 ? "#14e2a0" : "#ff4a68",
              opacity: 0.75,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-dim">
        <span className="num">5% VaR · {fmtPct(mc.p5)}</span>
        <span>Drawdown กลาง {mc.medianDrawdown.toFixed(1)}% · แย่สุด {mc.worstDrawdown.toFixed(1)}%</span>
        <span className="num">95% · {fmtPct(mc.p95)}</span>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        สุ่มสลับลำดับผลของไม้จริงทั้งหมด {mc.runs.toLocaleString()} รอบ
        เพื่อวัดว่าผลที่ได้มาจากตัวกลยุทธ์เองหรือมาจากโชคของลำดับเหตุการณ์
        และนับว่ากี่รอบที่พอร์ตเหลือต่ำกว่า 20% ของทุนตั้งต้น
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 12. Comparison mode
 * ------------------------------------------------------------------ */

export function ComparePanel({
  rows,
  current,
  running,
  onRun,
  onApply,
}: {
  rows: CompareRow[];
  current: LabConfig;
  running: boolean;
  onRun: () => void;
  onApply: (k: CompareRow) => void;
}) {
  return (
    <Panel
      title="เปรียบเทียบกลยุทธ์"
      titleEn="Comparison Mode"
      right={
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className="rounded border border-line bg-[#0f1c26] px-2 py-[3px] text-[9.5px] text-muted hover:text-txt disabled:opacity-40"
        >
          {running ? "กำลังคำนวณ…" : rows.length ? "คำนวณใหม่" : "รันเปรียบเทียบทั้ง 7 กลยุทธ์"}
        </button>
      }
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-dim">
          กดปุ่มด้านบนเพื่อรันทั้ง 7 กลยุทธ์บนข้อมูลชุดเดียวกันและต้นทุนชุดเดียวกัน
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                  <th className="px-2.5 py-1.5 font-medium">อันดับ / กลยุทธ์</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Return</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Win Rate</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">PF</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">Max DD</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">ไม้</th>
                  <th className="px-1.5 py-1.5 text-right font-medium">ล้างพอร์ต</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">คะแนน AI</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const active = row.kind === current.strategy;
                  const m = STRATEGY_META[row.kind];
                  return (
                    <tr
                      key={row.kind}
                      onClick={() => onApply(row)}
                      className={`cursor-pointer border-t border-line-soft text-[10.5px] transition-colors ${
                        active ? "bg-[#0e1f26]" : "hover:bg-[#0d1922]"
                      }`}
                    >
                      <td className="px-2.5 py-[6px]">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`num w-[15px] shrink-0 text-center text-[9px] font-bold ${
                              i === 0 ? "text-brand" : "text-dim"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="h-[10px] w-[3px] shrink-0 rounded" style={{ background: m.color }} />
                          <span className="min-w-0">
                            <span className="block truncate text-txt">{m.th}</span>
                            <span className="block truncate text-[8.5px] text-dim">{m.en}</span>
                          </span>
                        </span>
                      </td>
                      <td className={`num px-1.5 py-[6px] text-right ${row.result.returnPct >= 0 ? "text-up" : "text-down"}`}>
                        {fmtPct(row.result.returnPct)}
                      </td>
                      <td className="num px-1.5 py-[6px] text-right text-muted">
                        {row.result.winRate.toFixed(1)}%
                      </td>
                      <td className={`num px-1.5 py-[6px] text-right font-semibold ${row.result.profitFactor >= 1.5 ? "text-up" : "text-warn"}`}>
                        {row.result.profitFactor.toFixed(2)}
                      </td>
                      <td className={`num px-1.5 py-[6px] text-right ${row.result.maxDrawdown > 20 ? "text-down" : "text-muted"}`}>
                        {row.result.maxDrawdown.toFixed(1)}%
                      </td>
                      <td className="num px-1.5 py-[6px] text-right text-dim">{row.result.trades.length}</td>
                      <td className={`num px-1.5 py-[6px] text-right ${row.result.liquidations ? "text-down" : "text-dim"}`}>
                        {row.result.liquidations}
                      </td>
                      <td className={`num px-2.5 py-[6px] text-right font-bold ${i === 0 ? "text-brand" : "text-muted"}`}>
                        {row.score.toFixed(1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line-soft px-2.5 py-1.5 text-[9px] leading-snug text-dim">
            คะแนน AI = ผลตอบแทน×0.6 − Drawdown×1.2 + Profit Factor×12 + จำนวนไม้×0.12 − ล้างพอร์ต×25 —
            กำไรอย่างเดียวจึงไม่พอที่จะได้อันดับหนึ่ง · คลิกแถวเพื่อสลับไปใช้กลยุทธ์นั้น
          </p>
        </>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 13. Validation pipeline
 * ------------------------------------------------------------------ */

type StageState = "pass" | "fail" | "locked" | "idle";

export function PipelinePanel({
  r,
  wf,
  mc,
  gates,
}: {
  r: LabResult;
  wf: LabWalkForward | null;
  mc: LabMonteCarlo | null;
  gates: Gate[];
}) {
  const riskPass = gates.length > 0 && gates.every((g) => g.pass);

  const stages: { label: string; en: string; state: StageState; note: string }[] = [
    {
      label: "Backtest",
      en: "ทดสอบย้อนหลัง",
      state: !r.ok ? "idle" : r.netProfit > 0 ? "pass" : "fail",
      note: r.ok ? `${r.trades.length} ไม้ · ${fmtPct(r.returnPct)}` : "ยังไม่มีผล",
    },
    {
      label: "Walk-Forward",
      en: "ทดสอบเดินหน้า",
      state: !wf ? "idle" : wf.overfit ? "fail" : "pass",
      note: wf ? `ต่างกัน ${Math.abs(wf.degradation).toFixed(0)}%` : "ยังไม่ได้รัน",
    },
    {
      label: "Monte Carlo",
      en: "จำลองสุ่มลำดับ",
      state: !mc ? "idle" : mc.riskOfRuin < 5 && mc.probProfit >= 60 ? "pass" : "fail",
      note: mc ? `ชนะ ${mc.probProfit.toFixed(0)}% · พัง ${mc.riskOfRuin.toFixed(1)}%` : "ไม้ไม่พอ",
    },
    {
      label: "Risk Review",
      en: "ตรวจโดย Risk Engine",
      state: gates.length === 0 ? "idle" : riskPass ? "pass" : "fail",
      note: gates.length ? `ผ่าน ${gates.filter((g) => g.pass).length}/${gates.length} เกณฑ์` : "—",
    },
    {
      label: "Paper Trading",
      en: "เทรดกระดาษ",
      state: riskPass ? "idle" : "locked",
      note: riskPass ? "พร้อมเริ่ม — ไปที่หน้า Live Execution" : "ล็อกจนกว่าจะผ่าน Risk Review",
    },
    {
      label: "Shadow Mode",
      en: "รันคู่ขนานเงียบ",
      state: "locked",
      note: "ต้องมีผล Paper Trading อย่างน้อย 30 วันก่อน",
    },
    {
      label: "Production",
      en: "บัญชีเงินจริง",
      state: "locked",
      note: "ระบบนี้ไม่ส่งคำสั่งจริง — ต้องอนุมัติโดยคนเท่านั้น",
    },
  ];

  const tone: Record<StageState, { dot: string; text: string; ring: string }> = {
    pass: { dot: "bg-up", text: "text-up", ring: "border-up/50" },
    fail: { dot: "bg-down", text: "text-down", ring: "border-down/50" },
    locked: { dot: "bg-[#2a3a46]", text: "text-dim", ring: "border-line" },
    idle: { dot: "bg-warn", text: "text-warn", ring: "border-warn/40" },
  };

  return (
    <Panel
      title="สายตรวจก่อนใช้งานจริง"
      titleEn="Validation Pipeline"
      right={<Tag tone={riskPass ? "up" : "warn"}>{riskPass ? "ผ่านถึง Risk Review" : "ยังไม่ผ่านทุกด่าน"}</Tag>}
      bodyClassName="p-2.5"
    >
      <ol className="flex flex-wrap items-stretch gap-1">
        {stages.map((s, i) => {
          const t = tone[s.state];
          return (
            <li key={s.label} className="flex min-w-[150px] flex-1 items-center gap-1">
              <div className={`min-w-0 flex-1 rounded border ${t.ring} bg-[#0a121a] px-2 py-1.5`}>
                <div className="flex items-center gap-1.5">
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${t.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[10.5px] font-semibold ${t.text}`}>
                      {i + 1}. {s.label}
                    </span>
                    <span className="block truncate text-[8.5px] text-dim">{s.en}</span>
                  </span>
                </div>
                <div className="mt-[2px] truncate text-[9px] text-muted">{s.note}</div>
              </div>
              {i < stages.length - 1 && <span className="shrink-0 text-[11px] text-dim">→</span>}
            </li>
          );
        })}
      </ol>

      <div className="mt-2 grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
        {gates.map((g) => (
          <div
            key={g.id}
            className={`rounded border px-2 py-1 ${
              g.pass ? "border-up/25 bg-[#0b1f1a]" : "border-down/25 bg-[#1d0f14]"
            }`}
            title={g.detail}
          >
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate text-[9.5px] text-muted">{g.label}</span>
              <span className={`text-[9px] font-bold ${g.pass ? "text-up" : "text-down"}`}>
                {g.pass ? "ผ่าน" : "ไม่ผ่าน"}
              </span>
            </div>
            <div className="num truncate text-[11px] font-semibold text-txt">
              {g.value} <span className="text-[8.5px] font-normal text-dim">/ {g.threshold}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        กลยุทธ์ที่ผ่านเพียง Backtest ยังขึ้นบัญชีจริงไม่ได้ — สามด่านสุดท้ายต้องใช้เวลาเดินจริง
        และแพลตฟอร์มนี้ไม่ส่งคำสั่งไปยังกระดานเทรดใด ๆ
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 14. Action bar
 * ------------------------------------------------------------------ */

export function ActionBar({
  ready,
  hasResult,
  onDuplicate,
  onCompare,
  onExportCsv,
  onExportPdf,
  savedCount,
}: {
  ready: boolean;
  hasResult: boolean;
  onDuplicate: () => void;
  onCompare: () => void;
  onExportCsv: () => void;
  onExportPdf: () => void;
  savedCount: number;
}) {
  const base =
    "rounded border px-2.5 py-[6px] text-[10.5px] transition-colors disabled:opacity-35 disabled:cursor-not-allowed";

  return (
    <section className="panel flex flex-wrap items-center gap-1.5 p-2.5">
      <button
        type="button"
        onClick={onDuplicate}
        disabled={!hasResult}
        className={`${base} border-line bg-[#0f1c26] text-muted hover:text-txt`}
      >
        ทำสำเนาการทดสอบ (Duplicate)
      </button>
      <button
        type="button"
        onClick={onCompare}
        className={`${base} border-line bg-[#0f1c26] text-muted hover:text-txt`}
      >
        เปรียบเทียบกลยุทธ์ (Compare)
      </button>
      <button
        type="button"
        onClick={onExportCsv}
        disabled={!hasResult}
        className={`${base} border-line bg-[#0f1c26] text-muted hover:text-txt`}
      >
        Export CSV
      </button>
      <button
        type="button"
        onClick={onExportPdf}
        disabled={!hasResult}
        className={`${base} border-line bg-[#0f1c26] text-muted hover:text-txt`}
      >
        Export PDF
      </button>

      <span className="mx-1 h-5 w-px bg-line" />

      <Link
        href="/strategies"
        className={`${base} border-brand/40 bg-[#062a38] text-brand hover:bg-[#083445]`}
      >
        ส่งต่อไป Strategy Lab
      </Link>
      <Link
        href="/execution"
        aria-disabled={!ready}
        tabIndex={ready ? 0 : -1}
        className={`${base} ${
          ready
            ? "border-up/40 bg-[#0d2b23] text-up hover:bg-[#11362c]"
            : "pointer-events-none border-line bg-[#0d1922] text-dim opacity-40"
        }`}
      >
        เริ่ม Paper Trading
      </Link>

      <span className="ml-auto text-[9px] text-dim">
        {savedCount} ชุดที่บันทึกไว้ในเซสชันนี้ ·{" "}
        {ready ? "ผ่านเกณฑ์ครบ — เปิดใช้ปุ่ม Paper Trading แล้ว" : "ปุ่ม Paper Trading ปลดล็อกเมื่อผ่านเกณฑ์ครบ"}
      </span>
    </section>
  );
}
