"use client";

import { useState } from "react";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import type {
  Allocation,
  BoardProposal,
  ComplianceRow,
  Investor,
  Projection,
  RevenueRow,
  SimResult,
  TreasuryRow,
} from "@/lib/fund";
import { Panel, Tag } from "../Panel";
import { Donut, RingGauge } from "../viz";

const col = (v: number) => (v >= 0 ? "#14e2a0" : "#ff4a68");

export function FundKpis({
  cards,
}: {
  cards: { th: string; en: string; value: string; tone?: string; sub?: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {cards.map((c) => (
        <div key={c.th} className="panel min-w-0 flex-1 px-2.5 py-1.5">
          <div className="truncate text-[9px] tracking-wide text-dim">
            {c.th} <span className="text-[8px]">{c.en}</span>
          </div>
          <div className={`num truncate text-[15px] font-bold ${c.tone ?? "text-txt"}`}>
            {c.value}
          </div>
          {c.sub && <div className="truncate text-[8.5px] text-dim">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Sections 2 + 4 — the AI-CIO's capital allocation. */
export function AllocationPanel({ alloc, aum }: { alloc: Allocation; aum: number }) {
  const slices = [
    ...alloc.sleeves
      .filter((s) => s.capital > 0)
      .map((s) => ({ label: s.name, value: s.capital, color: s.color })),
    { label: "เงินสดสำรอง", value: alloc.cash, color: "#33505f" },
  ];

  return (
    <Panel
      title="การจัดสรรทุนโดย AI-CIO"
      titleEn="Capital Allocation"
      right={<Tag tone="up">ใช้ทุน {alloc.utilisationPct.toFixed(1)}%</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <Donut slices={slices} size={128} thickness={17} />
        <ul className="min-w-0 flex-1 space-y-[3px]">
          {alloc.sleeves.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5 text-[10px]">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted">{s.name}</span>
              <span className="num shrink-0 text-dim">{fmtCompact(s.capital)}</span>
              <span className="num w-10 shrink-0 text-right font-bold text-txt">
                {s.weightPct.toFixed(1)}%
              </span>
            </li>
          ))}
          <li className="flex items-center gap-1.5 border-t border-line-soft pt-1 text-[10px]">
            <span className="size-2 shrink-0 rounded-full bg-[#33505f]" />
            <span className="min-w-0 flex-1 truncate text-muted">เงินสดสำรอง</span>
            <span className="num shrink-0 text-dim">{fmtCompact(alloc.cash)}</span>
            <span className="num w-10 shrink-0 text-right font-bold text-txt">
              {alloc.cashPct.toFixed(1)}%
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
        <div className="mb-0.5 text-[9.5px] text-brand">AI-CIO อธิบายการจัดสรร</div>
        <p className="text-[10px] leading-relaxed text-muted">{alloc.noteTh}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="py-1 font-medium">กลยุทธ์</th>
              <th className="py-1 text-right font-medium">ทุนที่ได้</th>
              <th className="py-1 text-right font-medium">งบความเสี่ยง</th>
              <th className="py-1 text-right font-medium">ผลตอบแทน</th>
              <th className="py-1 font-medium">คำวินิจฉัย</th>
            </tr>
          </thead>
          <tbody>
            {alloc.sleeves.map((s) => (
              <tr key={s.id} className="border-t border-line-soft text-[10px]">
                <td className="py-[4px] text-muted">{s.name}</td>
                <td className="num py-[4px] text-right">{fmtCompact(s.capital)}</td>
                <td className="num py-[4px] text-right text-dim">
                  {s.riskBudgetPct.toFixed(1)}%
                </td>
                <td
                  className="num py-[4px] text-right font-semibold"
                  style={{ color: col(s.returnPct) }}
                >
                  {fmtPct(s.returnPct)}
                </td>
                <td className="py-[4px] text-[9px] text-dim">{s.verdictTh}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[9px] text-dim">
        AUM ที่ใช้คำนวณ {fmtNum(aum, 0)} USD · จัดสรรตามผลตอบแทนต่อ Drawdown ของแต่ละกลยุทธ์
      </p>
    </Panel>
  );
}

/** Section 3 — the investor book. */
export function InvestorPanel({ rows }: { rows: Investor[] }) {
  const total = rows.reduce((a, r) => a + r.capital, 0);

  return (
    <Panel
      title="ทะเบียนนักลงทุน"
      titleEn="Investor Dashboard"
      right={<Tag tone="warn">DEMO · {rows.length} ราย</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">นักลงทุน</th>
              <th className="px-2 py-1.5 font-medium">ประเภท</th>
              <th className="px-2 py-1.5 text-right font-medium">เงินลงทุน</th>
              <th className="px-2 py-1.5 text-right font-medium">สัดส่วน</th>
              <th className="px-2 py-1.5 text-right font-medium">ผลตอบแทนสุทธิ</th>
              <th className="px-3 py-1.5 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line-soft text-[10.5px]">
                <td className="px-3 py-[6px]">
                  <span className="block truncate">{r.name}</span>
                  <span className="block truncate text-[8.5px] text-dim">
                    เข้าลงทุน {r.since}
                  </span>
                </td>
                <td className="px-2 py-[6px] text-[9.5px] text-dim">{r.type}</td>
                <td className="num px-2 py-[6px] text-right">{fmtCompact(r.capital)}</td>
                <td className="num px-2 py-[6px] text-right text-dim">
                  {((r.capital / total) * 100).toFixed(1)}%
                </td>
                <td
                  className="num px-2 py-[6px] text-right font-semibold"
                  style={{ color: col(r.returnPct) }}
                >
                  {fmtPct(r.returnPct)}
                  <span className="ml-1 text-[9px] font-normal text-dim">
                    {fmtCompact(r.profit)}
                  </span>
                </td>
                <td className="px-3 py-[6px]">
                  <Tag
                    tone={
                      r.status === "Active" ? "up" : r.status === "Lock-up" ? "neutral" : "warn"
                    }
                  >
                    {r.status}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        รายชื่อและยอดเงินเป็นชุดสาธิต ไม่มีข้อมูลบุคคลจริง ·
        ผลตอบแทนสุทธิคำนวณจากผลงานจริงของพอร์ตหักค่าธรรมเนียมตามผลงาน 20% และค่าบริหาร 2% ต่อปี
      </p>
    </Panel>
  );
}

/** Sections 5 + 6 — treasury and liquidity. */
export function TreasuryPanel({
  rows,
  alloc,
}: {
  rows: TreasuryRow[];
  alloc: Allocation;
}) {
  const liquidityScore = Math.min(100, alloc.cashPct * 2.6);

  return (
    <Panel
      title="คลังเงินและสภาพคล่อง"
      titleEn="Treasury & Liquidity"
      right={
        <Tag tone={liquidityScore >= 60 ? "up" : liquidityScore >= 40 ? "warn" : "down"}>
          สภาพคล่อง {liquidityScore.toFixed(0)}%
        </Tag>
      }
      bodyClassName="p-2.5 flex items-center gap-3"
    >
      <div className="shrink-0">
        <RingGauge
          value={liquidityScore}
          size={116}
          label={`${alloc.cashPct.toFixed(0)}%`}
          sub="เงินสดสำรอง"
          color={liquidityScore >= 60 ? "#14e2a0" : liquidityScore >= 40 ? "#ffb020" : "#ff4a68"}
        />
      </div>
      <div className="min-w-0 flex-1">
        {rows.map((r) => (
          <div
            key={r.en}
            className="flex items-center justify-between border-b border-line-soft py-[4px] text-[10px] last:border-0"
          >
            <span className="truncate text-muted">
              {r.th} <span className="text-[8.5px] text-dim">{r.en}</span>
            </span>
            <span
              className="num shrink-0 font-semibold"
              style={{
                color: r.kind === "in" ? "#14e2a0" : r.kind === "out" ? "#ff4a68" : "#d5e2ee",
              }}
            >
              {r.value >= 0 ? "+" : ""}
              {fmtCompact(r.value)}
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Section 7 — revenue and cost. */
export function RevenuePanel({
  income,
  expense,
  totalIncome,
  totalExpense,
  net,
}: {
  income: RevenueRow[];
  expense: RevenueRow[];
  totalIncome: number;
  totalExpense: number;
  net: number;
}) {
  return (
    <Panel
      title="รายได้และต้นทุน"
      titleEn="Revenue & Fee"
      right={
        <Tag tone={net >= 0 ? "up" : "down"}>สุทธิ {fmtCompact(net)}</Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-up">รายได้ต่อเดือน</div>
        {income.map((r) => (
          <div
            key={r.en}
            className="flex justify-between border-b border-line-soft py-[4px] text-[10px]"
          >
            <span className="truncate text-muted">{r.th}</span>
            <span className="num text-up">{fmtCompact(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between py-[5px] text-[10.5px] font-bold">
          <span className="text-dim">รวมรายได้</span>
          <span className="num text-up">{fmtCompact(totalIncome)}</span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-down">ต้นทุนต่อเดือน</div>
        {expense.map((r) => (
          <div
            key={r.en}
            className="flex justify-between border-b border-line-soft py-[4px] text-[10px]"
          >
            <span className="truncate text-muted">{r.th}</span>
            <span className="num text-down">{fmtCompact(r.value)}</span>
          </div>
        ))}
        <div className="flex justify-between py-[5px] text-[10.5px] font-bold">
          <span className="text-dim">รวมต้นทุน</span>
          <span className="num text-down">{fmtCompact(totalExpense)}</span>
        </div>
      </div>

      <p className="col-span-full text-[9px] leading-snug text-dim">
        ค่าธรรมเนียมตามผลงานคิดเฉพาะเมื่อกองทุนมีกำไรเท่านั้น — เดือนที่ขาดทุนจะเป็นศูนย์
        ตามหลักการของกองทุนจริง · ค่าธรรมเนียม Exchange ผูกกับจำนวนไม้ที่เทรดจริง
      </p>
    </Panel>
  );
}

/** Section 8 — compliance board. */
export function CompliancePanel({ rows }: { rows: ComplianceRow[] }) {
  const passed = rows.filter((r) => r.pass).length;

  return (
    <Panel
      title="การกำกับดูแลและปฏิบัติตามนโยบาย"
      titleEn="Compliance"
      right={
        <Tag tone={passed === rows.length ? "up" : "down"}>
          ผ่าน {passed}/{rows.length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {rows.map((r) => (
          <li key={r.en} className="flex items-start gap-2 px-3 py-[6px]">
            <span
              className={`mt-[2px] grid size-3.5 shrink-0 place-items-center rounded-full text-[8px] font-bold ${
                r.pass ? "bg-up/20 text-up" : "bg-down/20 text-down"
              }`}
            >
              {r.pass ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] text-txt">
                {r.th} <span className="text-[8.5px] text-dim">{r.en}</span>
              </span>
              <span className="block truncate text-[9px] text-dim">{r.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 10 — AUM projection. */
export function ProjectionPanel({ rows }: { rows: Projection[] }) {
  return (
    <Panel
      title="คาดการณ์การเติบโตของกองทุน"
      titleEn="Fund Growth Projection"
      right={<Tag tone="warn">ความน่าจะเป็น ไม่ใช่การรับประกัน</Tag>}
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">ช่วงเวลา</th>
            <th className="px-2 py-1.5 text-right font-medium">Bear</th>
            <th className="px-2 py-1.5 text-right font-medium">Base</th>
            <th className="px-3 py-1.5 text-right font-medium">Bull</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.horizonTh} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px] text-muted">{r.horizonTh}</td>
              <td className="num px-2 py-[6px] text-right text-down">{fmtCompact(r.bear)}</td>
              <td className="num px-2 py-[6px] text-right font-semibold text-txt">
                {fmtCompact(r.base)}
              </td>
              <td className="num px-3 py-[6px] text-right text-up">{fmtCompact(r.bull)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ทบต้นจากผลตอบแทนรายเดือนที่วัดได้จริงของกองทุน โดยกรอบ Bull/Bear
        กว้างตามความผันผวนที่วัดได้ — ไม่ใช่ตัวเลขที่ตั้งขึ้นเอง
      </p>
    </Panel>
  );
}

/** Section 13 — the capital simulator. */
export function SimulatorPanel({
  delta,
  onDelta,
  result,
  aum,
}: {
  delta: number;
  onDelta: (v: number) => void;
  result: SimResult;
  aum: number;
}) {
  const rows: [string, string][] = [
    ["AUM ใหม่", fmtCompact(result.newAum)],
    ["ทุนที่ปล่อยลงตลาด", fmtCompact(result.deployed)],
    ["เงินสดสำรอง", `${fmtCompact(result.cash)} (${result.cashPct.toFixed(1)}%)`],
    ["อัตราการใช้ทุน", `${result.utilisation.toFixed(1)}%`],
    ["กำไรคาดหวังต่อเดือน", fmtCompact(result.expectedMonthlyProfit)],
    ["อัตราส่วนสภาพคล่อง", `${result.liquidityRatio.toFixed(2)}x`],
  ];

  return (
    <Panel
      title="จำลองการเพิ่ม/ถอนทุน"
      titleEn="Fund Allocation Simulator"
      right={
        <Tag tone={delta >= 0 ? "up" : "down"}>
          {delta >= 0 ? "+" : ""}
          {fmtCompact(delta)}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div>
        <div className="flex justify-between text-[10px]">
          <span className="text-dim">ปรับเงินทุน</span>
          <span className="num text-txt">
            {delta >= 0 ? "+" : ""}
            {fmtNum(delta / 1e6, 1)}M USD
          </span>
        </div>
        <input
          type="range"
          min={-Math.round(aum * 0.3)}
          max={Math.round(aum * 0.5)}
          step={1_000_000}
          value={delta}
          onChange={(e) => onDelta(Number(e.target.value))}
          className="w-full accent-[#00d4ff]"
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3">
        {rows.map(([k, v]) => (
          <span
            key={k}
            className="flex justify-between border-b border-line-soft py-[4px] text-[10px]"
          >
            <span className="truncate text-dim">{k}</span>
            <span className="num truncate pl-1 font-semibold text-txt">{v}</span>
          </span>
        ))}
      </div>

      <p className="text-[9px] leading-snug text-dim">
        เงินทุนใหม่จะถูกจัดสรรตามนโยบายเงินสดปัจจุบัน ({result.cashPct.toFixed(1)}%)
        ไม่ใช่ตามน้ำหนักเดิม — เพื่อไม่ให้การเพิ่มทุนไปเพิ่มความเสี่ยงโดยอัตโนมัติ
      </p>
    </Panel>
  );
}

/** Section 14 — the daily AI board meeting. */
export function BoardPanel({
  proposals,
  masterPlanTh,
}: {
  proposals: BoardProposal[];
  masterPlanTh: string;
}) {
  const TONE = {
    เพิ่ม: "up" as const,
    ลด: "down" as const,
    คงไว้: "neutral" as const,
    ระวัง: "warn" as const,
  };

  return (
    <Panel
      title="ที่ประชุมบอร์ด AI ประจำวัน"
      titleEn="AI Board Meeting"
      right={<Tag tone="neutral">{proposals.length} ข้อเสนอ</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {proposals.map((p) => (
          <li key={p.ai} className="flex items-start gap-2 px-3 py-[7px]">
            <span className="w-[96px] shrink-0 truncate text-[10px] text-brand">{p.ai}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] text-txt">{p.th}</span>
              <span className="block truncate text-[9px] text-dim">{p.reason}</span>
            </span>
            <Tag tone={TONE[p.stance]}>{p.stance}</Tag>
          </li>
        ))}
      </ul>
      <div className="border-t border-line-soft bg-[#062028] px-3 py-2">
        <div className="mb-0.5 text-[9.5px] text-brand">Master AI สรุปแผนของวัน</div>
        <p className="text-[10.5px] leading-relaxed text-muted">{masterPlanTh}</p>
      </div>
    </Panel>
  );
}

/** Sections 9 + 15 — the CEO one-pager. */
export function CeoPanel({
  kpis,
  summary,
  onExport,
}: {
  kpis: { th: string; value: string; tone?: string }[];
  summary: string;
  onExport: (kind: string) => void;
}) {
  const [done, setDone] = useState<string | null>(null);

  const run = (kind: string) => {
    onExport(kind);
    setDone(kind);
    setTimeout(() => setDone(null), 2500);
  };

  return (
    <Panel
      title="สรุปสำหรับผู้บริหารและนักลงทุน"
      titleEn="CEO Dashboard & Investor Report"
      right={
        <div className="flex items-center gap-1">
          {done && <span className="text-[9px] text-up">ดาวน์โหลด {done} แล้ว</span>}
          {["CSV", "JSON"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => run(k)}
              className="rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:border-brand/40 hover:text-brand"
            >
              รายงาน {k}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-x-3 sm:grid-cols-5">
        {kpis.map((k) => (
          <div key={k.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
            <div className="truncate text-[9px] text-dim">{k.th}</div>
            <div className={`num truncate text-[13px] font-bold ${k.tone ?? "text-txt"}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
        <div className="mb-0.5 text-[9.5px] text-brand">AI Executive Summary</div>
        <p className="text-[10.5px] leading-relaxed text-muted">{summary}</p>
      </div>
    </Panel>
  );
}
