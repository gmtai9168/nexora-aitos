"use client";

import { useState } from "react";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import type {
  BoardSeat,
  CompanyTwin,
  Financials,
  ForecastRow,
  GlobalKpi,
  InvestorSegment,
  StrategicMove,
  TwinDecision,
} from "@/lib/executive";
import { EXECUTIVE_COMMANDS } from "@/lib/executive";
import { Panel, Tag } from "../Panel";
import { RingGauge } from "../viz";

const col = (v: number) => (v >= 0 ? "#14e2a0" : "#ff4a68");

/** Section 1 + 3 — the headline and the AI-written summary. */
export function ExecutiveOverview({
  health,
  summary,
  cards,
}: {
  health: number;
  summary: string;
  cards: { th: string; en: string; value: string; tone?: string }[];
}) {
  return (
    <Panel
      title="ภาพรวมผู้บริหาร"
      titleEn="Executive Overview"
      right={
        <Tag tone={health >= 75 ? "up" : health >= 55 ? "warn" : "down"}>
          สุขภาพองค์กร {health}/100
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2.5 lg:flex-row"
    >
      <div className="flex shrink-0 flex-col items-center justify-center">
        <RingGauge
          value={health}
          size={130}
          label={`${health}`}
          sub="Company Health"
          color={health >= 75 ? "#14e2a0" : health >= 55 ? "#ffb020" : "#ff4a68"}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-5">
          {cards.map((c) => (
            <div key={c.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
              <div className="truncate text-[9px] text-dim">
                {c.th} <span className="text-[8px]">{c.en}</span>
              </div>
              <div className={`num truncate text-[13.5px] font-bold ${c.tone ?? "text-txt"}`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className="dot-live size-1.5 rounded-full bg-brand" />
            <span className="text-[9.5px] text-brand">AI Digital CEO สรุปให้</span>
          </div>
          <p className="text-[10.5px] leading-relaxed text-muted">{summary}</p>
        </div>
      </div>
    </Panel>
  );
}

/** Section 6 — company P&L. */
export function FinancialPanel({ fin }: { fin: Financials }) {
  const income: [string, number][] = [
    ["ค่าบริหารจัดการ", fin.managementFee],
    ["ค่าธรรมเนียมตามผลงาน", fin.performanceFee],
    ["รายได้อื่น", fin.otherIncome],
  ];
  const cost: [string, number][] = [
    ["บุคลากร", -fin.people],
    ["โครงสร้างพื้นฐาน", -fin.infrastructure],
    ["ค่าธรรมเนียม Exchange", -fin.exchangeFees],
    ["ข้อมูลและฟีด", -fin.dataAndFeeds],
  ];

  return (
    <Panel
      title="ศูนย์การเงินองค์กร"
      titleEn="Financial Center"
      right={
        <Tag tone={fin.ebitda >= 0 ? "up" : "down"}>
          EBITDA {fmtCompact(fin.ebitda)}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-up">รายได้ต่อเดือน</div>
        {income.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-line-soft py-[4px] text-[10px]">
            <span className="truncate text-muted">{k}</span>
            <span className="num text-up">{fmtCompact(v)}</span>
          </div>
        ))}
        <div className="flex justify-between py-[5px] text-[10.5px] font-bold">
          <span className="text-dim">รวมรายได้</span>
          <span className="num text-up">{fmtCompact(fin.totalRevenue)}</span>
        </div>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-down">ต้นทุนต่อเดือน</div>
        {cost.map(([k, v]) => (
          <div key={k} className="flex justify-between border-b border-line-soft py-[4px] text-[10px]">
            <span className="truncate text-muted">{k}</span>
            <span className="num text-down">{fmtCompact(v)}</span>
          </div>
        ))}
        <div className="flex justify-between py-[5px] text-[10.5px] font-bold">
          <span className="text-dim">รวมต้นทุน</span>
          <span className="num text-down">{fmtCompact(-fin.totalCost)}</span>
        </div>
      </div>

      <div className="col-span-full grid grid-cols-2 gap-1.5 border-t border-line-soft pt-2 sm:grid-cols-4">
        {[
          { th: "EBITDA", v: fmtCompact(fin.ebitda), tone: fin.ebitda >= 0 ? "text-up" : "text-down" },
          { th: "อัตรากำไร", v: `${fin.ebitdaMarginPct.toFixed(1)}%` },
          { th: "กำไรสุทธิ", v: fmtCompact(fin.netProfit), tone: fin.netProfit >= 0 ? "text-up" : "text-down" },
          {
            th: "Runway",
            v: fin.runwayMonths === Infinity ? "ไม่จำกัด" : `${fin.runwayMonths.toFixed(1)} เดือน`,
            tone: fin.runwayMonths === Infinity ? "text-up" : "text-warn",
          },
        ].map((c) => (
          <div key={c.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
            <div className="truncate text-[9px] text-dim">{c.th}</div>
            <div className={`num truncate text-[13px] font-bold ${c.tone ?? "text-txt"}`}>{c.v}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Section 7 — investor segments. */
export function InvestorIntelPanel({ rows }: { rows: InvestorSegment[] }) {
  return (
    <Panel
      title="ข้อมูลเชิงลึกของนักลงทุน"
      titleEn="Investor Intelligence"
      right={<Tag tone="warn">DEMO</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {rows.map((r) => (
          <li key={r.type} className="px-3 py-[7px]">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold">
                {r.type}
              </span>
              <span className="num shrink-0 text-[10px] text-muted">{r.count} ราย</span>
              <span className="num w-[62px] shrink-0 text-right text-[10.5px]">
                {fmtCompact(r.capital)}
              </span>
              <span className="num w-10 shrink-0 text-right text-[10px] font-bold text-brand">
                {r.sharePct.toFixed(1)}%
              </span>
            </div>
            <div className="mt-[3px] h-[3px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full bg-brand/70"
                style={{ width: `${r.sharePct}%` }}
              />
            </div>
            <p className="mt-0.5 truncate text-[9px] text-dim">{r.behaviourTh}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 8 — company forecast. */
export function ForecastPanel({ rows }: { rows: ForecastRow[] }) {
  return (
    <Panel
      title="คาดการณ์อนาคตของบริษัท"
      titleEn="Future Forecast"
      right={<Tag tone="warn">ช่วงความเป็นไปได้ ไม่ใช่การทำนาย</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">ช่วงเวลา</th>
              <th className="px-2 py-1.5 text-right font-medium">AUM (Bear)</th>
              <th className="px-2 py-1.5 text-right font-medium">AUM (Base)</th>
              <th className="px-2 py-1.5 text-right font-medium">AUM (Bull)</th>
              <th className="px-2 py-1.5 text-right font-medium">รายได้/เดือน</th>
              <th className="px-3 py-1.5 text-right font-medium">นักลงทุน</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.horizonTh} className="border-t border-line-soft text-[10.5px]">
                <td className="px-3 py-[6px] text-muted">{r.horizonTh}</td>
                <td className="num px-2 py-[6px] text-right text-down">
                  {fmtCompact(r.aum.bear)}
                </td>
                <td className="num px-2 py-[6px] text-right font-semibold text-txt">
                  {fmtCompact(r.aum.base)}
                </td>
                <td className="num px-2 py-[6px] text-right text-up">
                  {fmtCompact(r.aum.bull)}
                </td>
                <td className="num px-2 py-[6px] text-right text-muted">
                  {fmtCompact(r.revenue.base)}
                </td>
                <td className="num px-3 py-[6px] text-right text-dim">
                  {r.clients.base} ราย
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ทบต้นจากผลตอบแทนรายเดือนที่วัดได้จริงของกองทุน บวกสมมติฐานเงินไหลเข้า 2.5%/เดือน ·
        กรอบ Bull/Bear กว้างตามความผันผวนที่วัดได้ ไม่ใช่ตัวเลขที่ตั้งขึ้นเอง
      </p>
    </Panel>
  );
}

/** Section 9 — the digital board room. */
export function BoardRoomPanel({
  seats,
  ceoPlanTh,
}: {
  seats: BoardSeat[];
  ceoPlanTh: string;
}) {
  const TONE = {
    เพิ่ม: "up" as const,
    ลด: "down" as const,
    คงไว้: "neutral" as const,
    ระวัง: "warn" as const,
  };

  return (
    <Panel
      title="ห้องประชุมบอร์ดดิจิทัล"
      titleEn="Digital Board Room"
      right={<Tag tone="neutral">{seats.length} ที่นั่ง</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {seats.map((s) => (
          <li key={s.officer} className="flex items-start gap-2 px-3 py-[7px]">
            <span className="w-[92px] shrink-0">
              <span className="block truncate text-[10px] font-semibold text-brand">
                {s.officer}
              </span>
              <span className="block truncate text-[8.5px] text-dim">{s.role}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] text-txt">{s.proposalTh}</span>
              <span className="block truncate text-[9px] text-dim">{s.reasonTh}</span>
            </span>
            <Tag tone={TONE[s.stance]}>{s.stance}</Tag>
          </li>
        ))}
      </ul>
      <div className="border-t border-line-soft bg-[#062028] px-3 py-2">
        <div className="mb-0.5 text-[9.5px] text-brand">Digital CEO สรุปมติ</div>
        <p className="text-[10.5px] leading-relaxed text-muted">{ceoPlanTh}</p>
      </div>
    </Panel>
  );
}

/** Section 11 — the company digital twin. */
export function CompanyTwinPanel({
  twins,
  selected,
  onSelect,
  decisions,
}: {
  twins: CompanyTwin[];
  selected: string;
  onSelect: (k: string) => void;
  decisions: TwinDecision[];
}) {
  const active = twins.find((t) => t.decision.key === selected) ?? twins[0];

  return (
    <Panel
      title="บริษัทจำลอง"
      titleEn="Company Digital Twin"
      right={<Tag tone="up">ทดลองก่อนตัดสินใจจริง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex flex-wrap gap-1">
        {decisions.map((d) => {
          const t = twins.find((x) => x.decision.key === d.key);
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelect(d.key)}
              className={`rounded border px-2 py-1 text-[9.5px] transition-colors ${
                selected === d.key
                  ? "border-brand/60 bg-[#062a38] text-brand"
                  : t && !t.ok && d.key !== "none"
                    ? "border-warn/40 bg-[#2d2310] text-warn"
                    : "border-line bg-[#0d1922] text-muted hover:text-txt"
              }`}
            >
              {d.th}
            </button>
          );
        })}
      </div>

      {active && (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
            {[
              { th: "AUM", v: fmtCompact(active.aum) },
              { th: "รายได้/เดือน", v: fmtCompact(active.revenue) },
              { th: "ต้นทุน/เดือน", v: fmtCompact(active.cost) },
              {
                th: "EBITDA",
                v: fmtCompact(active.ebitda),
                tone: active.ebitda >= 0 ? "text-up" : "text-down",
              },
              {
                th: "Δ EBITDA",
                v: `${active.ebitdaDelta >= 0 ? "+" : ""}${fmtCompact(active.ebitdaDelta)}`,
                tone: active.ebitdaDelta >= 0 ? "text-up" : "text-down",
              },
            ].map((c) => (
              <div key={c.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
                <div className="truncate text-[9px] text-dim">{c.th}</div>
                <div className={`num truncate text-[13px] font-bold ${c.tone ?? "text-txt"}`}>
                  {c.v}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[9.5px]">
            <span className="flex justify-between">
              <span className="text-dim">โหนดที่ต้องใช้</span>
              <span className="num text-muted">
                {active.nodesNeeded} / {active.nodesAvailable}
              </span>
            </span>
            <span className="flex justify-between">
              <span className="text-dim">ความเสี่ยงเพิ่ม</span>
              <span className={`num ${active.riskDelta > 0 ? "text-warn" : "text-up"}`}>
                +{active.riskDelta}
              </span>
            </span>
            <span className="flex justify-between">
              <span className="text-dim">บุคลากรเพิ่ม</span>
              <span className="num text-muted">{active.headcountDelta} คน</span>
            </span>
          </div>

          <p
            className={`rounded border px-2.5 py-2 text-[10px] leading-snug ${
              active.decision.key === "none"
                ? "border-line-soft bg-[#08111a] text-muted"
                : active.ok
                  ? "border-up/40 bg-[#0d2b23] text-up"
                  : "border-warn/40 bg-[#2d2310] text-warn"
            }`}
          >
            {active.verdictTh}
          </p>
          <p className="text-[9px] leading-snug text-dim">
            ทุกสถานการณ์คำนวณด้วยสูตรรายได้ ต้นทุน และความต้องการโหนดชุดเดียวกับที่ใช้จริงในหน้านี้
            — เปรียบเทียบกันได้ตรงไปตรงมา
          </p>
        </>
      )}
    </Panel>
  );
}

/** Section 5 — strategic moves. */
export function StrategyPanel({ moves }: { moves: StrategicMove[] }) {
  return (
    <Panel
      title="ข้อเสนอเชิงกลยุทธ์จาก AI"
      titleEn="AI Strategic Recommendation"
      right={<Tag tone="neutral">{moves.length} ข้อ</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {moves.map((m) => (
          <li key={m.th} className="px-3 py-[7px]">
            <div className="flex items-center gap-2">
              <span
                className={`shrink-0 rounded border px-1.5 py-[1px] text-[8.5px] ${
                  m.priority === "สูง"
                    ? "border-down/40 text-down"
                    : m.priority === "กลาง"
                      ? "border-warn/40 text-warn"
                      : "border-line text-dim"
                }`}
              >
                {m.priority}
              </span>
              <span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-txt">
                {m.th}
              </span>
              <span className="shrink-0 text-[9px] text-dim">{m.horizonTh}</span>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-snug text-muted">{m.reasonTh}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 12 — the global KPI board. */
export function GlobalKpiPanel({ rows }: { rows: GlobalKpi[] }) {
  return (
    <Panel
      title="ตัวชี้วัดหลักขององค์กร"
      titleEn="Global KPI"
      right={<Tag tone="neutral">{rows.length} ตัวชี้วัด</Tag>}
      bodyClassName="p-2.5 grid gap-x-3 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-4"
    >
      {rows.map((k) => (
        <div key={k.en}>
          <div className="flex justify-between text-[10px]">
            <span className="truncate text-muted">
              {k.th} <span className="text-[8.5px] text-dim">{k.en}</span>
            </span>
            <span className="num shrink-0 font-bold text-txt">{k.value}</span>
          </div>
          <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${k.scorePct}%`,
                background:
                  k.scorePct >= 70 ? "#14e2a0" : k.scorePct >= 45 ? "#ffb020" : "#ff4a68",
              }}
            />
          </div>
        </div>
      ))}
    </Panel>
  );
}

/** Sections 10 + 13 + 14 — vision, commands and report export. */
export function CommandPanel({
  vision,
  onCommand,
  active,
  onExport,
}: {
  vision: string;
  onCommand: (k: string) => void;
  active: Record<string, boolean>;
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
      title="วิสัยทัศน์และคำสั่งระดับผู้บริหาร"
      titleEn="AI Vision & Executive Command"
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
              รายงานบอร์ด {k}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
        <div className="mb-0.5 text-[9.5px] text-brand">AI Vision · 12 เดือนข้างหน้า</div>
        <p className="text-[10.5px] leading-relaxed text-muted">{vision}</p>
      </div>

      <div className="grid gap-1.5 sm:grid-cols-3">
        {EXECUTIVE_COMMANDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onCommand(c.key)}
            className={`rounded border px-2 py-1.5 text-left transition-colors ${
              active[c.key]
                ? c.tone === "down"
                  ? "border-down/50 bg-[#2a0f18] text-down"
                  : c.tone === "warn"
                    ? "border-warn/50 bg-[#2d2310] text-warn"
                    : "border-up/50 bg-[#0d2b23] text-up"
                : "border-line bg-[#0d1922] text-muted hover:text-txt"
            }`}
          >
            <span className="block truncate text-[10.5px] font-semibold">{c.th}</span>
            <span className="block truncate text-[8.5px] text-dim">{c.detailTh}</span>
          </button>
        ))}
      </div>

      <p className="text-[9px] leading-snug text-dim">
        คำสั่งของผู้บริหารมีผลกับทั้งแพลตฟอร์ม · &quot;โหมดฉุกเฉิน&quot;
        ผูกกับปุ่ม EMERGENCY STOP เดียวกันทุกหน้า และทุกคำสั่งถูกบันทึกไว้ตรวจสอบย้อนหลัง
      </p>
    </Panel>
  );
}

export { fmtNum, fmtPct, col };
