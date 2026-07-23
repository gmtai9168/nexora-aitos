"use client";

import { useState } from "react";
import { fmtPct } from "@/lib/format";
import {
  generateCode,
  type BacktestResult,
  type MonteCarlo,
  type OptimizeRow,
  type StrategyParams,
  type WalkForward,
} from "@/lib/strategy";
import { Panel, Tag } from "../Panel";

/** Section 10 — grid search, every row an actual backtest. */
export function OptimizerPanel({
  rows,
  running,
  onRun,
  onApply,
  current,
}: {
  rows: OptimizeRow[];
  running: boolean;
  onRun: () => void;
  onApply: (p: StrategyParams) => void;
  current: StrategyParams;
}) {
  return (
    <Panel
      title="ปรับค่าพารามิเตอร์อัตโนมัติ"
      titleEn="AI Optimizer"
      right={
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className={`rounded border px-2 py-[3px] text-[10px] font-semibold ${
            running
              ? "cursor-wait border-line bg-[#0d1922] text-dim"
              : "border-brand/50 bg-[#062a38] text-brand hover:bg-[#083545]"
          }`}
        >
          {running ? "กำลังค้นหา…" : "รัน Optimizer (81 ชุดค่า)"}
        </button>
      }
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-[10.5px] leading-relaxed text-dim">
          กด &quot;รัน Optimizer&quot; เพื่อให้ระบบทดสอบชุดพารามิเตอร์ทั้งหมด
          แล้วจัดอันดับจากผลจริง
          <br />
          <span className="text-[9px]">
            คะแนน = Profit Factor ×40 − Drawdown ×1.4 + จำนวนไม้ ×0.2 + Win Rate ×0.2
          </span>
        </p>
      ) : (
        <div className="max-h-[300px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-[9px] uppercase tracking-wide text-dim">
                <th className="px-3 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">EMA</th>
                <th className="px-2 py-1.5 text-right font-medium">Stop</th>
                <th className="px-2 py-1.5 text-right font-medium">TP</th>
                <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทน</th>
                <th className="px-2 py-1.5 text-right font-medium">PF</th>
                <th className="px-2 py-1.5 text-right font-medium">DD</th>
                <th className="px-2 py-1.5 text-right font-medium">คะแนน</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const isCurrent =
                  r.params.emaFast === current.emaFast &&
                  r.params.emaSlow === current.emaSlow &&
                  r.params.stopAtr === current.stopAtr &&
                  r.params.targetR === current.targetR;
                return (
                  <tr
                    key={i}
                    className={`border-t border-line-soft text-[10.5px] ${
                      isCurrent ? "bg-[#0e1f26]" : ""
                    }`}
                  >
                    <td className="num px-3 py-[5px] text-dim">{i + 1}</td>
                    <td className="num px-2 py-[5px]">
                      {r.params.emaFast}/{r.params.emaSlow}
                    </td>
                    <td className="num px-2 py-[5px] text-right">{r.params.stopAtr}×</td>
                    <td className="num px-2 py-[5px] text-right">{r.params.targetR}R</td>
                    <td
                      className={`num px-2 py-[5px] text-right ${
                        r.result.returnPct >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {fmtPct(r.result.returnPct)}
                    </td>
                    <td className="num px-2 py-[5px] text-right text-brand">
                      {r.result.profitFactor.toFixed(2)}
                    </td>
                    <td className="num px-2 py-[5px] text-right text-muted">
                      {r.result.maxDrawdown.toFixed(1)}%
                    </td>
                    <td className="num px-2 py-[5px] text-right font-bold">
                      {r.score.toFixed(0)}
                    </td>
                    <td className="px-3 py-[5px] text-right">
                      <button
                        type="button"
                        onClick={() => onApply(r.params)}
                        className="rounded border border-line px-1.5 py-[1px] text-[9px] text-muted hover:border-brand/40 hover:text-brand"
                      >
                        ใช้ค่านี้
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Sections 11 + 12 — paper and shadow, gated on the tests actually passing. */
export function PaperShadowPanel({
  result,
  wf,
  mc,
}: {
  result: BacktestResult;
  wf: WalkForward;
  mc: MonteCarlo | null;
}) {
  const [paper, setPaper] = useState(false);
  const [shadow, setShadow] = useState(false);

  const ready = result.profitFactor >= 1.2 && !wf.overfit && (mc?.probProfit ?? 0) >= 55;

  return (
    <Panel
      title="Paper Trading และ Shadow Mode"
      titleEn="Paper & Shadow"
      right={<Tag tone={ready ? "up" : "warn"}>{ready ? "พร้อมทดสอบสด" : "ยังไม่ผ่านเกณฑ์"}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setPaper((v) => !v)}
          disabled={!ready}
          className={`rounded border py-2 text-[10.5px] font-semibold ${
            !ready
              ? "cursor-not-allowed border-line bg-[#0d1922] text-dim"
              : paper
                ? "border-up/50 bg-[#0d2b23] text-up"
                : "border-line bg-[#0d1922] text-muted hover:text-txt"
          }`}
        >
          Paper Trading {paper ? "กำลังรัน" : "เริ่ม"}
        </button>
        <button
          type="button"
          onClick={() => setShadow((v) => !v)}
          disabled={!ready}
          className={`rounded border py-2 text-[10.5px] font-semibold ${
            !ready
              ? "cursor-not-allowed border-line bg-[#0d1922] text-dim"
              : shadow
                ? "border-warn/50 bg-[#2d2310] text-warn"
                : "border-line bg-[#0d1922] text-muted hover:text-txt"
          }`}
        >
          Shadow Mode {shadow ? "กำลังรัน" : "เริ่ม"}
        </button>
      </div>

      <ul className="space-y-[3px] text-[9.5px]">
        <li className="flex justify-between">
          <span className="text-dim">Paper — รันกับตลาดจริงแต่ไม่ใช้เงินจริง</span>
          <span className={paper ? "text-up" : "text-dim"}>{paper ? "กำลังบันทึกผล" : "ยังไม่เริ่ม"}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-dim">Shadow — รันคู่กับ Production โดยไม่ส่งคำสั่ง</span>
          <span className={shadow ? "text-warn" : "text-dim"}>
            {shadow ? "เทียบผลกับของจริงอยู่" : "ยังไม่เริ่ม"}
          </span>
        </li>
      </ul>

      <div className="grid grid-cols-3 gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[9.5px]">
        <span className="flex justify-between">
          <span className="text-dim">PF ≥ 1.2</span>
          <span className={result.profitFactor >= 1.2 ? "text-up" : "text-down"}>
            {result.profitFactor.toFixed(2)}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ไม่ Overfit</span>
          <span className={!wf.overfit ? "text-up" : "text-down"}>
            {wf.overfit ? "ไม่ผ่าน" : "ผ่าน"}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">MC ≥ 55%</span>
          <span className={(mc?.probProfit ?? 0) >= 55 ? "text-up" : "text-down"}>
            {mc ? `${mc.probProfit.toFixed(0)}%` : "—"}
          </span>
        </span>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        ปุ่มจะปลดล็อกก็ต่อเมื่อผลทดสอบจริงผ่านเกณฑ์ทั้งสามข้อ —
        ในโหมดสาธิตนี้การกดเป็นการบันทึกสถานะเท่านั้น ไม่มีการส่งคำสั่งออกไป
      </p>
    </Panel>
  );
}

/** Sections 13 + 14 + 15 — the release gate, rollback and version history. */
export function DeployPanel({
  result,
  wf,
  mc,
  version,
  onDeploy,
  onRollback,
  history,
}: {
  result: BacktestResult;
  wf: WalkForward;
  mc: MonteCarlo | null;
  version: number;
  onDeploy: () => void;
  onRollback: () => void;
  history: { version: number; note: string; pf: number }[];
}) {
  const [approved, setApproved] = useState(false);

  const checks = [
    { th: "Backtest ผ่านเกณฑ์", ok: result.profitFactor >= 1.2 && result.trades.length >= 25 },
    { th: "Walk Forward ไม่ Overfit", ok: !wf.overfit },
    { th: "Monte Carlo ≥ 55%", ok: (mc?.probProfit ?? 0) >= 55 },
    { th: "Drawdown ไม่เกิน 25%", ok: result.maxDrawdown <= 25 },
    { th: "จำนวนไม้เพียงพอ (≥25)", ok: result.trades.length >= 25 },
    { th: "ตรวจความเสี่ยงโดย Risk AI", ok: result.maxDrawdown <= 25 && result.avgR > 0 },
    { th: "ผู้ดูแลอนุมัติ", ok: approved },
  ];

  const passed = checks.filter((c) => c.ok).length;
  const ready = passed === checks.length;

  return (
    <Panel
      title="ปล่อยใช้งานและย้อนเวอร์ชัน"
      titleEn="Deploy & Rollback"
      right={<Tag tone={ready ? "up" : "warn"}>ผ่าน {passed}/{checks.length}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <ul className="space-y-[3px]">
        {checks.map((c) => (
          <li key={c.th} className="flex items-center gap-1.5 text-[10px]">
            <span
              className={`grid size-3.5 shrink-0 place-items-center rounded-full text-[8px] ${
                c.ok ? "bg-up/20 text-up" : "bg-[#1b2833] text-dim"
              }`}
            >
              {c.ok ? "✓" : "•"}
            </span>
            <span className={c.ok ? "text-muted" : "text-dim"}>{c.th}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setApproved((v) => !v)}
        className={`rounded border py-1.5 text-[10px] ${
          approved
            ? "border-up/50 bg-[#0d2b23] text-up"
            : "border-line bg-[#0d1922] text-muted hover:text-txt"
        }`}
      >
        {approved ? "ผู้ดูแลอนุมัติแล้ว" : "กดเพื่ออนุมัติในฐานะผู้ดูแล"}
      </button>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={onDeploy}
          disabled={!ready}
          className={`rounded py-2 text-[11px] font-bold ${
            ready
              ? "bg-up text-black hover:brightness-110"
              : "cursor-not-allowed bg-[#16242f] text-dim"
          }`}
        >
          Deploy เป็น V{version + 1}
        </button>
        <button
          type="button"
          onClick={onRollback}
          disabled={history.length < 2}
          className={`rounded border py-2 text-[11px] font-semibold ${
            history.length >= 2
              ? "border-down/50 bg-[#2a0f18] text-down hover:bg-[#3a1220]"
              : "cursor-not-allowed border-line bg-[#0d1922] text-dim"
          }`}
        >
          Rollback 1 คลิก
        </button>
      </div>

      <div className="border-t border-line-soft pt-1.5">
        <div className="mb-1 text-[9.5px] text-dim">ประวัติเวอร์ชัน · Strategy Timeline</div>
        <ol className="space-y-[3px]">
          {history.map((h, i) => (
            <li key={h.version} className="flex items-center gap-2 text-[9.5px]">
              <span
                className={`num w-6 shrink-0 rounded px-1 text-center ${
                  i === history.length - 1 ? "bg-brand text-black" : "bg-[#16242f] text-muted"
                }`}
              >
                V{h.version}
              </span>
              <span className="min-w-0 flex-1 truncate text-muted">{h.note}</span>
              <span className="num shrink-0 text-brand">PF {h.pf.toFixed(2)}</span>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

/** Section 16 — source generation for the exact parameter set on screen. */
export function CodeGenPanel({
  params,
  symbol,
  interval,
}: {
  params: StrategyParams;
  symbol: string;
  interval: string;
}) {
  const [lang, setLang] = useState<"python" | "typescript" | "pine">("python");
  const [copied, setCopied] = useState(false);
  const code = generateCode(params, symbol, interval, lang);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the code is still selectable on screen */
    }
  };

  return (
    <Panel
      title="สร้างโค้ดกลยุทธ์"
      titleEn="AI Code Generator"
      right={
        <div className="flex items-center gap-1">
          {(["python", "typescript", "pine"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded px-1.5 py-[2px] text-[9px] ${
                lang === l ? "bg-brand text-black" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {l === "pine" ? "Pine" : l === "typescript" ? "TS" : "Python"}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:border-brand/40 hover:text-brand"
          >
            {copied ? "คัดลอกแล้ว" : "คัดลอก"}
          </button>
        </div>
      }
      bodyClassName="p-0"
    >
      <pre className="num max-h-[340px] overflow-auto px-3 py-2 text-[9.5px] leading-relaxed text-muted">
        {code}
      </pre>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        โค้ดสร้างจากค่าพารามิเตอร์ชุดเดียวกับที่ผ่านการทดสอบบนหน้านี้
        (เวอร์ชัน Python มี unit test ติดมาด้วย) — นำไปต่อยอดในระบบจริงได้ทันที
      </p>
    </Panel>
  );
}
