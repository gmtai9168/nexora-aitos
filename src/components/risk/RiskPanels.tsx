"use client";

import { useState } from "react";
import type { BookSummary } from "@/lib/book";
import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { ScenarioResult } from "@/lib/portfolio-intel";
import {
  BAND_META,
  type BlackSwan,
  type CommitteeVote,
  type DynamicLeverage,
  type GlobalRisk,
  type MarketRisk,
  type PositionRisk,
  type RiskRecommendation,
} from "@/lib/risk-engine";
import { Panel, Tag } from "../Panel";
import { ArcGauge } from "../viz";

const tone = (v: number) => (v >= 67 ? "#ff4a68" : v >= 34 ? "#ffb020" : "#14e2a0");

/** Section 1 — the headline score and Capital Preservation Mode. */
export function GlobalRiskPanel({
  global,
  verdict,
  summaryTh,
}: {
  global: GlobalRisk;
  verdict: string;
  summaryTh: string;
}) {
  const meta = BAND_META[global.band];

  return (
    <Panel
      title="คะแนนความเสี่ยงรวม"
      titleEn="Global Risk Score"
      right={
        <Tag
          tone={
            verdict === "APPROVED" ? "up" : verdict === "REDUCED" ? "warn" : "down"
          }
        >
          คณะกรรมการ: {verdict}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 lg:grid-cols-[190px_minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex flex-col items-center">
        <ArcGauge
          value={global.score}
          max={100}
          size={172}
          label={`${global.score}`}
          sub="/ 100"
        />
        <div
          className="-mt-1 text-[13px] font-extrabold"
          style={{ color: meta.color }}
        >
          {meta.en}
        </div>
        <div className="text-[10px] text-dim">{meta.th}</div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[9.5px] text-dim">องค์ประกอบของคะแนน</div>
        {global.parts.map((p) => (
          <div key={p.en}>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted">
                {p.th} <span className="text-[8.5px] text-dim">×{p.weight.toFixed(2)}</span>
              </span>
              <span className="num font-semibold" style={{ color: tone(p.value) }}>
                {p.value.toFixed(0)}
              </span>
            </div>
            <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full"
                style={{ width: `${p.value}%`, background: tone(p.value) }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <div
          className={`rounded border px-2.5 py-2 ${
            global.preservationMode
              ? "border-warn/50 bg-[#2d2310]"
              : "border-up/40 bg-[#0d2b23]"
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`size-1.5 rounded-full ${
                global.preservationMode ? "bg-warn dot-live" : "bg-up"
              }`}
            />
            <span
              className={`text-[11px] font-bold ${
                global.preservationMode ? "text-warn" : "text-up"
              }`}
            >
              Capital Preservation Mode: {global.preservationMode ? "เปิดใช้งาน" : "ปิด"}
            </span>
          </div>
          <p className="mt-1 text-[9.5px] leading-snug text-muted">
            {global.preservationReasonTh}
          </p>
          {global.preservationMode && (
            <ul className="mt-1 space-y-[1px] text-[9px] text-dim">
              <li>· ลดขนาดสถานะและเลเวอเรจอัตโนมัติ</li>
              <li>· เพิ่มสัดส่วนเงินสด</li>
              <li>· จำกัดจำนวนสถานะที่เปิดพร้อมกัน</li>
              <li>· รอจนสภาพตลาดกลับสู่เกณฑ์ปกติ</li>
            </ul>
          )}
        </div>

        <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
          <div className="text-[9.5px] text-brand">มติคณะกรรมการความเสี่ยง</div>
          <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{summaryTh}</p>
        </div>
      </div>
    </Panel>
  );
}

/** Section 15 — the ten-vote risk committee. */
export function CommitteePanel({
  votes,
  verdict,
}: {
  votes: CommitteeVote[];
  verdict: string;
}) {
  return (
    <Panel
      title="คณะกรรมการความเสี่ยง AI"
      titleEn="AI Risk Committee"
      right={
        <Tag tone={verdict === "APPROVED" ? "up" : verdict === "REDUCED" ? "warn" : "down"}>
          {verdict === "APPROVED" ? "อนุมัติ" : verdict === "REDUCED" ? "ลดขนาด" : "ปฏิเสธ"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {votes.map((v) => (
          <li key={v.id} className="flex items-center gap-2 px-3 py-[6px]">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: tone(v.score) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px]">{v.name}</span>
              <span className="block truncate text-[9px] text-dim">{v.reason}</span>
            </span>
            <span className="h-[3px] w-[46px] shrink-0 overflow-hidden rounded-full bg-[#16242f]">
              <span
                className="block h-full rounded-full"
                style={{ width: `${v.score}%`, background: tone(v.score) }}
              />
            </span>
            <span
              className={`w-[54px] shrink-0 text-right text-[9.5px] font-bold ${
                v.vote === "APPROVE"
                  ? "text-up"
                  : v.vote === "REDUCE"
                    ? "text-warn"
                    : "text-down"
              }`}
            >
              {v.vote}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        คำสั่งจะผ่านก็ต่อเมื่อได้เสียงข้างมาก — หากมี REJECT ตั้งแต่ 2 เสียง
        หรือ Guardian AI คัดค้าน ระบบจะปฏิเสธทันทีแม้ Master AI จะมั่นใจ 99%
      </p>
    </Panel>
  );
}

/** Sections 3 + 6 — per-position risk and the liquidation monitor. */
export function PositionRiskPanel({
  rows,
  book,
}: {
  rows: PositionRisk[];
  book: BookSummary;
}) {
  const { setSymbol } = useMarket();
  const closest = [...rows].sort((a, b) => a.liqDistancePct - b.liqDistancePct)[0];

  return (
    <Panel
      title="ความเสี่ยงรายสถานะ"
      titleEn="Position Risk & Liquidation Monitor"
      right={
        <Tag tone={closest && closest.liqDistancePct < 8 ? "down" : "up"}>
          ใกล้สุด {closest ? `${closest.liqDistancePct.toFixed(1)}%` : "—"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">สินทรัพย์</th>
              <th className="px-2 py-1.5 font-medium">ทิศทาง</th>
              <th className="px-2 py-1.5 text-right font-medium">ขนาด</th>
              <th className="px-2 py-1.5 text-right font-medium">ราคาบังคับปิด</th>
              <th className="px-2 py-1.5 text-right font-medium">ระยะห่าง</th>
              <th className="px-2 py-1.5 text-right font-medium">คะแนนเสี่ยง</th>
              <th className="px-3 py-1.5 font-medium">AI แนะนำ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.symbol}
                onClick={() => setSymbol(r.symbol)}
                className="cursor-pointer border-t border-line-soft text-[10.5px] hover:bg-[#0e1a24]"
              >
                <td className="px-3 py-[7px]">{r.symbol.replace("USDT", "")}</td>
                <td className="px-2 py-[7px]">
                  <Tag tone={r.side === "LONG" ? "up" : "down"}>{r.side}</Tag>
                </td>
                <td className="num px-2 py-[7px] text-right text-muted">
                  {fmtCompact(r.notional)}
                </td>
                <td className="num px-2 py-[7px] text-right text-down/80">
                  {fmtPrice(r.liqPrice)}
                </td>
                <td
                  className={`num px-2 py-[7px] text-right font-semibold ${
                    r.liqDistancePct < 8 ? "text-down" : r.liqDistancePct < 15 ? "text-warn" : "text-up"
                  }`}
                >
                  {r.liqDistancePct.toFixed(1)}%
                </td>
                <td className="px-2 py-[7px]">
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="h-[3px] w-8 overflow-hidden rounded-full bg-[#16242f]">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${r.score}%`, background: tone(r.score) }}
                      />
                    </span>
                    <span
                      className="num w-[38px] text-right text-[10px] font-bold"
                      style={{ color: tone(r.score) }}
                    >
                      {r.level}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-[7px] text-muted">{r.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        ราคาบังคับปิดคำนวณจากราคาเข้าจริงและเลเวอเรจ {book.configuredLeverage}X
        บวกมาร์จิ้นรักษาสถานะ 0.5% · คะแนนเสี่ยงรวมระยะห่าง ความผันผวน การกระจุกตัว และผลขาดทุนปัจจุบัน
      </p>
    </Panel>
  );
}

/** Section 4 — the market-condition scoreboard. */
export function MarketRiskPanel({ items }: { items: MarketRisk[] }) {
  const avg = items.reduce((a, m) => a + m.score, 0) / Math.max(items.length, 1);

  return (
    <Panel
      title="ความเสี่ยงจากสภาพตลาด"
      titleEn="Market Risk"
      right={
        <Tag tone={avg >= 67 ? "down" : avg >= 34 ? "warn" : "up"}>
          เฉลี่ย {avg.toFixed(0)}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-x-3 gap-y-1.5 sm:grid-cols-2"
    >
      {items.map((m) => (
        <div key={m.key}>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted">
              {m.th} <span className="text-[8.5px] text-dim">{m.en}</span>
            </span>
            <span className="num font-semibold" style={{ color: tone(m.score) }}>
              {m.score.toFixed(0)}
            </span>
          </div>
          <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
            <div
              className="h-full rounded-full"
              style={{ width: `${m.score}%`, background: tone(m.score) }}
            />
          </div>
          <div className="truncate text-[8.5px] text-dim">{m.verdict}</div>
        </div>
      ))}
    </Panel>
  );
}

/** Sections 7 + 8 + 9 — leverage, margin and drawdown in one column. */
export function LeverageMarginPanel({
  book,
  lev,
  drawdown,
}: {
  book: BookSummary;
  lev: DynamicLeverage;
  drawdown: number;
}) {
  const rows: [string, string, string, string?][] = [
    ["เลเวอเรจใช้จริง", "Effective", `${book.leverage.toFixed(2)}x`, book.leverage > 3 ? "text-warn" : "text-up"],
    ["เพดานที่ตั้งไว้", "Configured", `${lev.max}X`],
    ["มาร์จิ้นคงเหลือ", "Available", fmtCompact(book.availableMargin), "text-up"],
    ["มาร์จิ้นที่ใช้", "Used", fmtCompact(book.marginUsed)],
    ["Margin Ratio", "", `${book.marginRatio.toFixed(2)}%`, book.marginRatio > 45 ? "text-warn" : "text-up"],
    ["Drawdown ปัจจุบัน", "Current", `${drawdown.toFixed(2)}%`, drawdown > 6 ? "text-down" : "text-up"],
    ["ขาดทุนวันนี้", "Day P/L", fmtPct(book.dayPnlPct), book.dayPnlPct < 0 ? "text-down" : "text-up"],
  ];

  return (
    <Panel
      title="เลเวอเรจ มาร์จิ้น และ Drawdown"
      titleEn="Dynamic Leverage & Margin"
      right={
        <Tag tone={lev.suggested === 0 ? "down" : lev.suggested < lev.max ? "warn" : "up"}>
          AI แนะนำ {lev.suggested === 0 ? "หยุดเทรด" : `${lev.suggested}X`}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
        <div className="flex items-baseline justify-between">
          <span className="text-[9.5px] text-dim">เลเวอเรจที่ระบบอนุญาตตอนนี้</span>
          <span
            className={`num text-[20px] font-extrabold ${
              lev.suggested === 0 ? "text-down" : lev.suggested < lev.max ? "text-warn" : "text-up"
            }`}
          >
            {lev.suggested === 0 ? "หยุด" : `${lev.suggested}X`}
          </span>
        </div>
        <div className="mt-1 h-[5px] overflow-hidden rounded-full bg-[#16242f]">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${(lev.suggested / lev.max) * 100}%` }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[8.5px] text-dim">
          <span>ต่ำสุด {lev.min}X</span>
          <span>เพดาน {lev.max}X</span>
        </div>
        <p className="mt-1 text-[9.5px] leading-snug text-muted">{lev.reasonTh}</p>
      </div>

      {rows.map(([th, en, v, t]) => (
        <div
          key={th}
          className="flex items-center justify-between border-b border-line-soft py-[4px] text-[10.5px] last:border-0"
        >
          <span className="text-muted">
            {th} {en && <span className="text-[9px] text-dim">{en}</span>}
          </span>
          <span className={`num font-semibold ${t ?? "text-txt"}`}>{v}</span>
        </div>
      ))}
    </Panel>
  );
}

/** Section 12 — the black-swan board. */
export function BlackSwanPanel({ items }: { items: BlackSwan[] }) {
  const hit = items.filter((i) => i.triggered);

  return (
    <Panel
      title="เฝ้าระวังเหตุการณ์ผิดปกติ"
      titleEn="Black Swan Detector"
      right={
        <Tag tone={hit.length ? "down" : "up"}>
          {hit.length ? `พบ ${hit.length} สัญญาณ` : "ไม่พบสัญญาณ"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((s) => (
          <li key={s.key} className="flex items-start gap-2 px-3 py-[6px]">
            <span
              className={`mt-1 size-1.5 shrink-0 rounded-full ${
                s.triggered ? "bg-down dot-live" : "bg-[#33505f]"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[10.5px] ${
                  s.triggered ? "font-semibold text-down" : "text-muted"
                }`}
              >
                {s.th}
              </span>
              <span className="block truncate text-[9px] text-dim">{s.detail}</span>
            </span>
            <Tag tone={s.triggered ? "down" : "up"}>{s.triggered ? "เตือน" : "ปกติ"}</Tag>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 10 — what the engine wants done about it. */
export function RiskRecommendationPanel({ items }: { items: RiskRecommendation[] }) {
  return (
    <Panel
      title="คำแนะนำจาก Risk Engine"
      titleEn="AI Risk Recommendation"
      right={<Tag tone="neutral">{items.length} ข้อ</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.map((r) => (
          <li key={r.id} className="px-3 py-[7px]">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  r.severity === "critical"
                    ? "bg-down"
                    : r.severity === "warn"
                      ? "bg-warn"
                      : "bg-up"
                }`}
              />
              <span className="truncate text-[10.5px] font-semibold text-txt">{r.th}</span>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-snug text-muted">{r.reason}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 11 — the stress scenarios. */
export function StressPanel({ results }: { results: ScenarioResult[] }) {
  return (
    <Panel
      title="ทดสอบภาวะวิกฤต"
      titleEn="Stress Test Scenarios"
      right={
        <Tag tone={results.some((r) => r.liquidation) ? "down" : "up"}>
          {results.some((r) => r.liquidation) ? "พบจุดถูกบังคับปิด" : "ผ่านทุกฉาก"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">สถานการณ์</th>
            <th className="px-2 py-1.5 text-right font-medium">ผลกระทบ</th>
            <th className="px-2 py-1.5 text-right font-medium">Margin</th>
            <th className="px-3 py-1.5 text-right font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.label} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px] text-muted">{r.label}</td>
              <td className={`num px-2 py-[6px] text-right ${r.pnl >= 0 ? "text-up" : "text-down"}`}>
                {fmtPct(r.equityPct)}
              </td>
              <td
                className={`num px-2 py-[6px] text-right ${
                  r.marginRatio > 60 ? "text-down" : r.marginRatio > 35 ? "text-warn" : "text-muted"
                }`}
              >
                {r.marginRatio > 500 ? "—" : `${r.marginRatio.toFixed(1)}%`}
              </td>
              <td className="px-3 py-[6px] text-right">
                <Tag tone={r.liquidation ? "down" : r.equityPct < -12 ? "warn" : "up"}>
                  {r.liquidation ? "ถูกบังคับปิด" : r.equityPct < -12 ? "เสี่ยงสูง" : "รอดได้"}
                </Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Section 14 — the kill switch, with selectable actions. */
export function KillSwitchPanel() {
  const { emergencyStop, setEmergencyStop } = useMarket();
  const [opts, setOpts] = useState<Record<string, boolean>>({
    newOrders: true,
    cancelPending: true,
    closeHighRisk: false,
    closeAll: false,
    disableAi: true,
    lockApi: false,
    notify: true,
  });

  const ACTIONS: { key: string; th: string }[] = [
    { key: "newOrders", th: "หยุดเปิดคำสั่งใหม่" },
    { key: "cancelPending", th: "ยกเลิกคำสั่งที่ค้างอยู่" },
    { key: "closeHighRisk", th: "ปิดสถานะที่เสี่ยงสูง" },
    { key: "closeAll", th: "ปิดสถานะทั้งหมด" },
    { key: "disableAi", th: "ปิดการทำงานของ AI" },
    { key: "lockApi", th: "ล็อก API Key" },
    { key: "notify", th: "แจ้งเตือนทีมงาน" },
  ];

  return (
    <Panel
      title="ศูนย์หยุดฉุกเฉิน"
      titleEn="Kill Switch Center"
      right={<Tag tone={emergencyStop ? "down" : "up"}>{emergencyStop ? "ทำงานอยู่" : "พร้อมใช้"}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <ul className="space-y-[2px]">
        {ACTIONS.map((a) => (
          <li key={a.key}>
            <button
              type="button"
              onClick={() => setOpts((p) => ({ ...p, [a.key]: !p[a.key] }))}
              className="flex w-full items-center justify-between py-[3px] text-[10px]"
            >
              <span className={opts[a.key] ? "text-txt" : "text-dim"}>{a.th}</span>
              <span
                className={`relative h-[14px] w-[26px] rounded-full transition-colors ${
                  opts[a.key] ? "bg-down/70" : "bg-[#1b2833]"
                }`}
              >
                <span
                  className={`absolute top-[2px] size-[10px] rounded-full bg-white transition-all ${
                    opts[a.key] ? "left-[14px]" : "left-[2px]"
                  }`}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setEmergencyStop(!emergencyStop)}
        className={`rounded py-2.5 text-[12px] font-bold ${
          emergencyStop
            ? "border border-up/50 bg-[#0d2b23] text-up"
            : "bg-gradient-to-b from-[#c02040] to-[#8c1730] text-white hover:brightness-110"
        }`}
      >
        {emergencyStop ? "ยกเลิกการหยุดฉุกเฉิน" : "EMERGENCY STOP"}
      </button>

      <p className="text-[9px] leading-snug text-dim">
        การกดจะสั่งหยุดทั่วทั้งแอป — แผง AI ทุกหน้าจะเปลี่ยนเป็นออฟไลน์
        และหน้า Live Execution จะปฏิเสธคำสั่งใหม่ทันที
        (ในโหมดสาธิตยังไม่มีการเชื่อมต่อ API key จริง)
      </p>
    </Panel>
  );
}
