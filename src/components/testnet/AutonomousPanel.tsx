"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ACTION_META,
  AI_LIMITS,
  DEFAULT_AI_CONFIG,
  type AiTraderConfig,
  type CycleReport,
} from "@/lib/ai-trader";
import { STRATEGY_META, type LabStrategyKind } from "@/lib/backtest-lab";
import { TESTNET_SYMBOLS } from "@/lib/testnet";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

const CYCLE_MS = 60_000;
const INTERVALS = ["1m", "5m", "15m", "1h"];

export function AutonomousPanel({ onTraded }: { onTraded: () => void }) {
  const { emergencyStop } = useMarket();
  const [config, setConfig] = useState<AiTraderConfig>(DEFAULT_AI_CONFIG);
  const [running, setRunning] = useState(false); // live auto-loop on
  const [busy, setBusy] = useState(false); // a cycle is in flight
  const [reports, setReports] = useState<CycleReport[]>([]);
  const [nextIn, setNextIn] = useState(0);

  const set = <K extends keyof AiTraderConfig>(k: K, v: AiTraderConfig[K]) =>
    setConfig((c) => ({ ...c, [k]: v }));

  const toggleSymbol = (s: string) =>
    setConfig((c) => ({
      ...c,
      symbols: c.symbols.includes(s) ? c.symbols.filter((x) => x !== s) : [...c.symbols, s],
    }));

  const runOnce = useCallback(
    async (dryRun: boolean) => {
      setBusy(true);
      try {
        const res = await fetch("/api/testnet/ai-cycle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config, dryRun }),
        });
        const report: CycleReport = await res.json();
        setReports((prev) => [report, ...prev].slice(0, 8));
        if (!dryRun && (report.opened > 0 || report.closed > 0)) onTraded();
      } catch {
        setReports((prev) => [
          { ok: false, ranAt: Date.now(), dryRun, balance: null, openPositions: 0, opened: 0, closed: 0, decisions: [], message: "เชื่อมต่อไม่สำเร็จ" },
          ...prev,
        ]);
      }
      setBusy(false);
    },
    [config, onTraded],
  );

  // The live auto-loop: fires a real cycle every minute while enabled and not
  // emergency-stopped. Toggling either re-runs this effect; the cleanup cancels
  // the pending cycle, so pulling the kill switch stops it before the next tick.
  useEffect(() => {
    if (!running || emergencyStop) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let countdown: ReturnType<typeof setInterval>;

    const tick = async () => {
      if (cancelled) return;
      await runOnce(false);
      if (cancelled) return;
      let left = CYCLE_MS / 1000;
      setNextIn(left);
      countdown = setInterval(() => {
        left -= 1;
        setNextIn(Math.max(0, left));
        if (left <= 0) clearInterval(countdown);
      }, 1000);
      timer = setTimeout(tick, CYCLE_MS);
    };
    tick();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(countdown);
    };
  }, [running, emergencyStop, runOnce]);

  const latest = reports[0];

  return (
    <Panel
      title="AI เทรดอัตโนมัติ"
      titleEn="Autonomous AI Trading"
      right={
        <Tag tone={emergencyStop ? "down" : running ? "up" : "neutral"}>
          {emergencyStop ? "หยุดฉุกเฉิน" : running ? `ทำงานอยู่ · รอบหน้า ${nextIn}s` : "ปิดอยู่"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {emergencyStop && (
        <p className="rounded border border-down/40 bg-[#1d0b12] px-2 py-1.5 text-[10px] text-down">
          ระบบอยู่ในโหมดหยุดฉุกเฉิน — AI อัตโนมัติถูกพักไว้ ยกเลิกที่ปุ่ม EMERGENCY STOP แถบซ้ายเพื่อทำงานต่อ
        </p>
      )}

      {/* Config */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">กลยุทธ์</span>
          <select
            className="w-full rounded border border-line bg-[#0a121a] px-1.5 py-[5px] text-[10.5px] text-txt"
            value={config.strategy}
            onChange={(e) => set("strategy", e.target.value as LabStrategyKind)}
          >
            {(Object.keys(STRATEGY_META) as LabStrategyKind[]).map((k) => (
              <option key={k} value={k}>{STRATEGY_META[k].th}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">Timeframe</span>
          <select
            className="w-full rounded border border-line bg-[#0a121a] px-1.5 py-[5px] text-[10.5px] text-txt"
            value={config.interval}
            onChange={(e) => set("interval", e.target.value)}
          >
            {INTERVALS.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </label>
      </div>

      <div>
        <span className="mb-[3px] block text-[9.5px] text-muted">สินทรัพย์ที่ให้ AI เทรด</span>
        <div className="flex flex-wrap gap-1">
          {TESTNET_SYMBOLS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => toggleSymbol(s)}
              className={`rounded border px-1.5 py-[3px] text-[9.5px] transition-colors ${
                config.symbols.includes(s) ? "border-brand/50 bg-[#062a38] text-brand" : "border-line bg-[#0a121a] text-muted"
              }`}
            >
              {s.replace("USDT", "")}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { k: "riskPct" as const, l: "เสี่ยง/ไม้ %", min: 0.5, max: AI_LIMITS.maxRiskPct, step: 0.5 },
          { k: "leverage" as const, l: "Leverage", min: 1, max: AI_LIMITS.maxLeverage, step: 1 },
          { k: "maxPositions" as const, l: "สถานะสูงสุด", min: 1, max: AI_LIMITS.maxPositionsCeiling, step: 1 },
          { k: "minConfidence" as const, l: "มั่นใจขั้นต่ำ %", min: 50, max: 95, step: 1 },
          { k: "takeProfitPct" as const, l: "TP % (มาร์จิน)", min: 5, max: 200, step: 5 },
          { k: "stopLossPct" as const, l: "SL % (มาร์จิน)", min: 5, max: 100, step: 5 },
        ].map((f) => (
          <label key={f.k} className="block">
            <span className="mb-[3px] block truncate text-[9px] text-muted">{f.l}</span>
            <input
              type="number"
              className="num w-full rounded border border-line bg-[#0a121a] px-1.5 py-[5px] text-[10.5px] text-txt"
              value={config[f.k]}
              min={f.min}
              max={f.max}
              step={f.step}
              onChange={(e) => set(f.k, Number(e.target.value))}
            />
          </label>
        ))}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => runOnce(true)}
          disabled={busy || config.symbols.length === 0}
          className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10px] text-muted hover:text-txt disabled:opacity-40"
        >
          {busy ? "กำลังคิด…" : "จำลอง 1 รอบ (ไม่ส่งจริง)"}
        </button>
        <button
          type="button"
          onClick={() => runOnce(false)}
          disabled={busy || emergencyStop || config.symbols.length === 0}
          className="rounded border border-brand/40 bg-[#062a38] px-2.5 py-[6px] text-[10px] text-brand hover:bg-[#083445] disabled:opacity-40"
        >
          รันจริง 1 รอบ
        </button>
        <button
          type="button"
          onClick={() => setRunning((v) => !v)}
          disabled={emergencyStop || config.symbols.length === 0}
          className={`rounded px-2.5 py-[6px] text-[10.5px] font-bold transition-colors disabled:opacity-40 ${
            running ? "bg-down text-white hover:brightness-110" : "bg-up text-black hover:brightness-110"
          }`}
        >
          {running ? "■ หยุด AI อัตโนมัติ" : "▶ เปิด AI อัตโนมัติ"}
        </button>
      </div>

      {/* Latest cycle summary */}
      {latest && (
        <div className={`rounded border px-2 py-1.5 text-[10px] ${latest.ok ? "border-line-soft bg-[#081017]" : "border-down/30 bg-[#1d0b12]"}`}>
          <div className="flex items-center justify-between">
            <span className={latest.ok ? "text-txt" : "text-down"}>
              {latest.dryRun && <span className="mr-1 rounded bg-[#1d2f3c] px-1 text-[8px] text-muted">จำลอง</span>}
              {latest.message}
            </span>
            <span className="num text-dim">
              {new Date(latest.ranAt).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false })}
            </span>
          </div>
          {latest.balance !== null && (
            <div className="mt-[2px] text-[9px] text-dim">
              ยอดใช้ได้ {latest.balance.toFixed(2)} USDT · เปิดอยู่ {latest.openPositions} สถานะ
            </div>
          )}
        </div>
      )}

      {/* Decision log */}
      {latest && latest.decisions.length > 0 && (
        <div className="rounded border border-line-soft bg-[#0a121a]">
          <div className="border-b border-line-soft px-2 py-1 text-[9px] font-semibold text-brand">
            การตัดสินใจรอบล่าสุด
          </div>
          <ul className="max-h-[220px] overflow-y-auto">
            {latest.decisions.map((d, i) => {
              const m = ACTION_META[d.action];
              const tone = m.tone === "up" ? "text-up" : m.tone === "down" ? "text-down" : m.tone === "warn" ? "text-warn" : "text-muted";
              return (
                <li key={i} className="flex items-start gap-1.5 border-b border-line-soft px-2 py-1 text-[9.5px] last:border-0">
                  <span className="w-[52px] shrink-0 text-txt">{d.symbol.replace("USDT", "")}</span>
                  <span className={`w-[92px] shrink-0 ${tone}`}>
                    {d.side && <span className="mr-1">{d.side === "LONG" ? "▲" : "▼"}</span>}
                    {m.th}
                  </span>
                  <span className="min-w-0 flex-1 text-dim">{d.detail}</span>
                  {d.confidence !== undefined && <span className="num shrink-0 text-brand">{d.confidence}%</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="text-[8.5px] leading-snug text-dim">
        AI อ่านแท่งเทียนจริงทุกรอบ (ทุก {CYCLE_MS / 1000} วินาทีเมื่อเปิดอัตโนมัติ) → สร้างสัญญาณด้วยกลยุทธ์เดียวกับ Backtest →
        ผ่าน Risk Engine → ส่งคำสั่งไปยัง Testnet · ปิดสถานะเมื่อกำไร/ขาดทุนบนมาร์จินถึงเกณฑ์ TP/SL ·
        <strong className="text-warn"> เป็นเงินปลอมทั้งหมด</strong> · ปุ่ม EMERGENCY STOP แถบซ้ายหยุดได้ทันที ·
        AI ทำงานเฉพาะขณะเปิดหน้านี้ไว้ (การทำงาน 24 ชม.แม้ปิดหน้าต้องใช้ Vercel Cron แผน Pro)
      </p>
    </Panel>
  );
}
