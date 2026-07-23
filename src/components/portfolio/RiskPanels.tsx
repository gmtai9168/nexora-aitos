"use client";

import { useState } from "react";
import { fmtNum, fmtPct } from "@/lib/format";
import type { Recommendation, RiskItem, ScenarioResult, TwinResult } from "@/lib/portfolio-intel";
import { Panel, Tag } from "../Panel";
import { ArcGauge } from "../viz";

const tone = (v: number) => (v >= 67 ? "#ff4a68" : v >= 34 ? "#ffb020" : "#14e2a0");

/** Section 5 — the correlation heatmap across the book plus benchmarks. */
export function CorrelationMatrix({
  symbols,
  matrix,
  loading,
}: {
  symbols: string[];
  matrix: (number | null)[][];
  loading: boolean;
}) {
  const label = (s: string) =>
    s.replace(/USDT$/, "").replace("^IXIC", "NDX").replace("GC=F", "GOLD").replace("^SET.BK", "SET");

  const cellColor = (v: number | null) => {
    if (v === null) return "#0e1a24";
    if (v > 0) return `rgba(255,74,104,${0.12 + v * 0.5})`;
    return `rgba(20,226,160,${0.12 + Math.abs(v) * 0.5})`;
  };

  const hot = matrix.flatMap((row, i) =>
    row.map((v, j) => (i < j && v !== null && v > 0.85 ? { a: symbols[i], b: symbols[j], v } : null)),
  ).filter(Boolean) as { a: string; b: string; v: number }[];

  return (
    <Panel
      title="ความสัมพันธ์ระหว่างสินทรัพย์"
      titleEn="Correlation Matrix"
      right={<Tag tone={hot.length ? "warn" : "up"}>{hot.length ? `สูง ${hot.length} คู่` : "ปกติ"}</Tag>}
      bodyClassName="p-2.5"
    >
      {loading || matrix.length === 0 ? (
        <p className="py-10 text-center text-[11px] text-dim">กำลังคำนวณสหสัมพันธ์ 120 วัน…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="text-[9px] text-dim">
                  <th className="px-1 py-1" />
                  {symbols.map((s) => (
                    <th key={s} className="px-1 py-1 font-medium">
                      {label(s)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={symbols[i]}>
                    <td className="px-1 py-1 text-left text-[9px] text-dim">
                      {label(symbols[i])}
                    </td>
                    {row.map((v, j) => (
                      <td key={`${i}-${j}`} className="p-[2px]">
                        <span
                          className="num block rounded py-[3px] text-[9.5px]"
                          style={{
                            background: i === j ? "#12303a" : cellColor(v),
                            color: v === null ? "#47616f" : "#d5e2ee",
                          }}
                        >
                          {v === null ? "—" : v.toFixed(2)}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 border-t border-line-soft pt-1.5 text-[9.5px] leading-snug text-dim">
            {hot.length > 0
              ? `AI เตือน: ${hot.map((h) => `${label(h.a)}–${label(h.b)} ${h.v.toFixed(2)}`).join(" · ")} — ไม่ควรเปิดเพิ่มทั้งคู่พร้อมกัน`
              : "ไม่มีคู่ใดมีสหสัมพันธ์เกิน 0.85 — การกระจายความเสี่ยงยังใช้ได้"}
            {" "}· คำนวณจากผลตอบแทนรายวัน 120 วันจริง
          </p>
        </>
      )}
    </Panel>
  );
}

/** Section 7 — the eight risk dials. */
export function RiskMonitorPanel({ items }: { items: RiskItem[] }) {
  const overall = items.length ? items.reduce((a, r) => a + r.level, 0) / items.length : 0;

  return (
    <Panel
      title="เฝ้าระวังความเสี่ยง"
      titleEn="Risk Monitor"
      right={
        <Tag tone={overall >= 67 ? "down" : overall >= 34 ? "warn" : "up"}>
          {overall >= 67 ? "เสี่ยงสูง" : overall >= 34 ? "เฝ้าระวัง" : "ปลอดภัย"}
        </Tag>
      }
      bodyClassName="p-2.5 flex items-center gap-3"
    >
      <div className="shrink-0">
        <ArcGauge
          value={overall}
          max={100}
          size={140}
          label={overall.toFixed(0)}
          sub="Portfolio Risk"
        />
      </div>
      <ul className="min-w-0 flex-1 space-y-[3px]">
        {items.map((r) => (
          <li key={r.en} className="flex items-center gap-1.5">
            <span className="w-[92px] shrink-0 truncate text-[9.5px] text-muted">{r.th}</span>
            <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${r.level}%`, background: tone(r.level) }}
              />
            </span>
            <span
              className="w-[38px] shrink-0 text-right text-[9px] font-bold"
              style={{ color: tone(r.level) }}
            >
              {r.label}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Sections 6 + 10 — recommendations you can accept or dismiss. */
export function RecommendationPanel({ items }: { items: Recommendation[] }) {
  const [decided, setDecided] = useState<Record<string, "approved" | "rejected">>({});

  return (
    <Panel
      title="คำแนะนำการปรับพอร์ตจาก AI"
      titleEn="AI Portfolio Recommendation"
      right={<Tag tone="warn">ต้องกดอนุมัติก่อนเสมอ</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((r) => {
          const state = decided[r.id];
          return (
            <li key={r.id} className="px-3 py-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    r.severity === "critical"
                      ? "bg-down"
                      : r.severity === "warn"
                        ? "bg-warn"
                        : "bg-up"
                  }`}
                />
                <span className="text-[11px] font-semibold text-txt">{r.th}</span>
                <Tag
                  tone={
                    r.severity === "critical" ? "down" : r.severity === "warn" ? "warn" : "up"
                  }
                >
                  {r.action}
                </Tag>

                <span className="ml-auto flex gap-1">
                  {state ? (
                    <span
                      className={`text-[10px] ${
                        state === "approved" ? "text-up" : "text-dim"
                      }`}
                    >
                      {state === "approved" ? "อนุมัติแล้ว (สาธิต)" : "ปฏิเสธแล้ว"}
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setDecided((p) => ({ ...p, [r.id]: "approved" }))}
                        className="rounded border border-up/50 bg-[#0d2b23] px-2 py-[2px] text-[9.5px] text-up hover:bg-[#124035]"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecided((p) => ({ ...p, [r.id]: "rejected" }))}
                        className="rounded border border-line bg-[#0d1922] px-2 py-[2px] text-[9.5px] text-muted hover:text-txt"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-0.5 text-[9.5px] leading-snug text-muted">
                <span className="text-brand">เหตุผล:</span> {r.reason}
              </p>
              <p className="text-[9.5px] leading-snug text-dim">
                <span className="text-dim">ผลที่คาด:</span> {r.impact}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        คำแนะนำทุกข้อเกิดจากเกณฑ์ที่ตัวเลขจริงในพอร์ตข้ามผ่าน — การกด Approve
        ในโหมดสาธิตจะบันทึกการตัดสินใจไว้เท่านั้น ไม่มีคำสั่งถูกส่งออก
      </p>
    </Panel>
  );
}

/** Sections 11 + 12 — shock the book and see what breaks. */
export function StressTestPanel({
  results,
  onShock,
  shock,
}: {
  results: ScenarioResult[];
  onShock: (v: number) => void;
  shock: number;
}) {
  return (
    <Panel
      title="ทดสอบภาวะวิกฤตและจำลองสถานการณ์"
      titleEn="Stress Test & Scenario"
      right={
        <Tag tone={results.some((r) => r.liquidation) ? "down" : "up"}>
          {results.some((r) => r.liquidation) ? "พบจุดเสี่ยงถูกบังคับปิด" : "ผ่านทุกสถานการณ์"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="py-1 font-medium">สถานการณ์</th>
              <th className="py-1 text-right font-medium">กำไร/ขาดทุน</th>
              <th className="py-1 text-right font-medium">พอร์ตคงเหลือ</th>
              <th className="py-1 text-right font-medium">Margin</th>
              <th className="py-1 text-right font-medium">บังคับปิด</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label} className="border-t border-line-soft text-[10.5px]">
                <td className="py-[5px] text-muted">{r.label}</td>
                <td className={`num py-[5px] text-right ${r.pnl >= 0 ? "text-up" : "text-down"}`}>
                  {fmtNum(r.pnl, 0)}
                  <span className="ml-1 text-[9px]">{fmtPct(r.equityPct)}</span>
                </td>
                <td className="num py-[5px] text-right">{fmtNum(r.equity, 0)}</td>
                <td
                  className={`num py-[5px] text-right ${
                    r.marginRatio > 60 ? "text-down" : r.marginRatio > 35 ? "text-warn" : "text-muted"
                  }`}
                >
                  {r.marginRatio > 500 ? "—" : `${r.marginRatio.toFixed(1)}%`}
                </td>
                <td className="py-[5px] text-right">
                  <Tag tone={r.liquidation ? "down" : "up"}>
                    {r.liquidation ? "เกิด" : "ไม่เกิด"}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-line-soft pt-2">
        <div className="flex items-baseline justify-between text-[10px]">
          <span className="text-dim">จำลองเอง — ราคาทุกสินทรัพย์เปลี่ยน</span>
          <span className={`num font-bold ${shock >= 0 ? "text-up" : "text-down"}`}>
            {shock >= 0 ? "+" : ""}
            {shock}%
          </span>
        </div>
        <input
          type="range"
          min={-30}
          max={30}
          step={1}
          value={shock}
          onChange={(e) => onShock(Number(e.target.value))}
          className="w-full accent-[#00d4ff]"
        />
      </div>
    </Panel>
  );
}

/** The Digital Twin — test a change in the clone before touching the book. */
export function DigitalTwinPanel({ results }: { results: TwinResult[] }) {
  return (
    <Panel
      title="พอร์ตจำลอง (Digital Twin)"
      titleEn="Portfolio Digital Twin"
      right={<Tag tone="up">ทดลองก่อนทำจริง</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">การปรับที่จำลอง</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ ความเสี่ยง</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ Leverage</th>
            <th className="px-2 py-1.5 text-right font-medium">Δ Drawdown</th>
            <th className="px-3 py-1.5 font-medium">ผลลัพธ์</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px] text-muted">{r.th}</td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  r.deltaRisk <= 0 ? "text-up" : "text-down"
                }`}
              >
                {r.deltaRisk >= 0 ? "+" : ""}
                {r.deltaRisk.toFixed(2)}%
              </td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  r.deltaLeverage <= 0 ? "text-up" : "text-down"
                }`}
              >
                {r.deltaLeverage >= 0 ? "+" : ""}
                {r.deltaLeverage.toFixed(2)}x
              </td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  r.deltaDrawdown <= 0 ? "text-up" : "text-down"
                }`}
              >
                {r.deltaDrawdown >= 0 ? "+" : ""}
                {r.deltaDrawdown.toFixed(2)}%
              </td>
              <td className="px-3 py-[6px]">
                <Tag tone={r.verdict === "ดีขึ้น" ? "up" : r.verdict === "แย่ลง" ? "down" : "neutral"}>
                  {r.verdict}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ทุกการปรับถูกทดลองในพอร์ตจำลองที่โคลนจากพอร์ตจริงก่อน — ระบบจะเสนอให้อนุมัติ
        เฉพาะการปรับที่ผลจำลองผ่านเกณฑ์ความเสี่ยงเท่านั้น
      </p>
    </Panel>
  );
}
