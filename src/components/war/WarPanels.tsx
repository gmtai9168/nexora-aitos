"use client";

import { bkkTime, fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import type {
  CrisisResult,
  DefenceLine,
  Dialogue,
  Incident,
  MissionObjective,
  Tactic,
  Threat,
  WarModeAction,
} from "@/lib/warroom";
import type { RegionPulse } from "@/lib/global-intel";
import { Panel, Tag } from "../Panel";
import { RingGauge } from "../viz";

const SEV_TONE = {
  LOW: "up" as const,
  MEDIUM: "warn" as const,
  HIGH: "down" as const,
  CRITICAL: "down" as const,
};

const pctColor = (v: number | null) =>
  v === null ? "#47616f" : v > 0 ? "#14e2a0" : v < 0 ? "#ff4a68" : "#6b8497";

/** Section 15 — the biggest switch in the platform. */
export function WarModePanel({
  active,
  auto,
  onToggle,
  actions,
  objective,
}: {
  active: boolean;
  auto: boolean;
  onToggle: () => void;
  actions: WarModeAction[];
  objective: MissionObjective;
}) {
  return (
    <Panel
      title="โหมดสงคราม"
      titleEn="War Mode"
      right={
        <Tag tone={active ? "down" : "up"}>
          {active ? (auto ? "เปิดอัตโนมัติ" : "เปิดใช้งาน") : "ปิดอยู่"}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-lg py-4 text-[16px] font-extrabold tracking-wider transition-all ${
            active
              ? "bg-gradient-to-b from-[#c02040] to-[#8c1730] text-white shadow-[0_0_24px_rgba(255,74,104,0.4)]"
              : "border border-line bg-[#0d1922] text-muted hover:border-down/50 hover:text-down"
          }`}
        >
          WAR MODE {active ? "ON" : "OFF"}
        </button>

        {auto && active && (
          <p className="rounded border border-down/40 bg-[#1d0b12] px-2 py-1.5 text-[9.5px] leading-snug text-down">
            ระบบเปิด WAR MODE ให้อัตโนมัติเพราะตรวจพบสัญญาณเหตุการณ์ผิดปกติ —
            ปิดเองได้แต่จะเปิดซ้ำหากเงื่อนไขยังอยู่
          </p>
        )}

        <ul className="space-y-[3px]">
          {actions.map((a) => (
            <li key={a.th} className="flex items-start gap-1.5 text-[10px]">
              <span
                className={`mt-[3px] grid size-3 shrink-0 place-items-center rounded-full text-[7px] font-bold ${
                  a.done ? "bg-down/25 text-down" : "bg-[#1b2833] text-dim"
                }`}
              >
                {a.done ? "✓" : "•"}
              </span>
              <span className={a.done ? "text-muted" : "text-dim"}>{a.th}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="text-[9.5px] text-dim">ภารกิจของวันนี้ · Mission Objective</div>
        {[
          { th: "เป้าหมายหลัก", v: objective.primaryTh, tone: "text-up" },
          { th: "เป้าหมายรอง", v: objective.secondaryTh, tone: "text-txt" },
          { th: "สิ่งที่ต้องเลี่ยง", v: objective.avoidTh, tone: "text-down" },
          { th: "ตัวชี้วัด", v: objective.targetTh, tone: "text-brand" },
        ].map((r) => (
          <div
            key={r.th}
            className="flex items-baseline justify-between gap-2 border-b border-line-soft py-[4px]"
          >
            <span className="shrink-0 text-[10px] text-dim">{r.th}</span>
            <span className={`truncate text-[10.5px] font-semibold ${r.tone}`}>{r.v}</span>
          </div>
        ))}
        <p className="mt-1 text-[9px] leading-snug text-dim">{objective.reasonTh}</p>
      </div>
    </Panel>
  );
}

/** Section 2 — the global risk map. */
export function RiskMapPanel({ regions }: { regions: RegionPulse[] }) {
  const POS: Record<string, { x: number; y: number }> = {
    us: { x: 17, y: 34 },
    uk: { x: 41, y: 18 },
    eu: { x: 53, y: 36 },
    jp: { x: 89, y: 26 },
    hk: { x: 82, y: 52 },
    th: { x: 68, y: 70 },
  };

  const level = (v: number | null) =>
    v === null ? "ไม่มีข้อมูล" : Math.abs(v) > 2 ? "วิกฤต" : Math.abs(v) > 1.2 ? "เฝ้าระวัง" : "ปกติ";

  return (
    <Panel
      title="แผนที่ความเสี่ยงทั่วโลก"
      titleEn="Global Risk Map"
      right={
        <Tag tone={regions.some((r) => r.hot) ? "warn" : "up"}>
          เฝ้าระวัง {regions.filter((r) => r.hot).length} ภูมิภาค
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <div className="relative h-[220px] w-full overflow-hidden rounded border border-line-soft bg-[#060d14]">
        <svg viewBox="0 0 100 52" className="absolute inset-0 size-full" aria-hidden="true">
          {Array.from({ length: 26 }).map((_, r) =>
            Array.from({ length: 50 }).map((__, c) => {
              const x = c * 2 + 1;
              const y = r * 2 + 1;
              const land =
                (x > 8 && x < 30 && y > 8 && y < 34) ||
                (x > 24 && x < 34 && y > 30 && y < 46) ||
                (x > 42 && x < 56 && y > 8 && y < 24) ||
                (x > 44 && x < 58 && y > 24 && y < 40) ||
                (x > 58 && x < 90 && y > 10 && y < 34) ||
                (x > 78 && x < 92 && y > 34 && y < 46);
              return land ? (
                <circle key={`${r}-${c}`} cx={x} cy={y} r="0.42" fill="#16303f" />
              ) : null;
            }),
          )}
        </svg>

        {regions.map((r) => {
          const p = POS[r.key];
          const color = pctColor(r.changePct);
          return (
            <div
              key={r.key}
              className="absolute -translate-x-1/2 -translate-y-1/2 text-center"
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <span className="relative mx-auto block size-3">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: color, opacity: 0.9 }}
                />
                {r.hot && (
                  <span
                    className="dot-live absolute -inset-1 rounded-full"
                    style={{ boxShadow: `0 0 10px ${color}` }}
                  />
                )}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-[8px] text-muted">
                {r.th}
              </span>
              <span
                className="num block whitespace-nowrap text-[9px] font-bold"
                style={{ color }}
              >
                {r.changePct === null ? "—" : fmtPct(r.changePct)}
              </span>
            </div>
          );
        })}
      </div>

      <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
        {regions.map((r) => (
          <li key={r.key} className="flex items-center gap-1.5 text-[9px]">
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: pctColor(r.changePct) }}
            />
            <span className="min-w-0 flex-1 truncate text-dim">{r.th}</span>
            <span className="shrink-0 text-muted">{level(r.changePct)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 1 — threat board. */
export function ThreatPanel({ rows }: { rows: Threat[] }) {
  return (
    <Panel
      title="เฝ้าระวังภัยคุกคาม"
      titleEn="Threat Monitoring"
      right={
        <Tag tone={rows.some((r) => r.severity === "CRITICAL" || r.severity === "HIGH") ? "down" : "up"}>
          ระดับสูง {rows.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL").length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">ภัยคุกคาม</th>
            <th className="px-2 py-1.5 font-medium">ระดับ</th>
            <th className="px-2 py-1.5 text-right font-medium">ผลกระทบ</th>
            <th className="px-3 py-1.5 font-medium">การรับมือ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[6px]">
                <span className="block truncate">{r.th}</span>
                <span className="block truncate text-[8.5px] text-dim">{r.detail}</span>
              </td>
              <td className="px-2 py-[6px]">
                <Tag tone={SEV_TONE[r.severity]}>{r.severity}</Tag>
              </td>
              <td className="px-2 py-[6px] text-right">
                <span className="flex items-center justify-end gap-1.5">
                  <span className="h-[3px] w-8 overflow-hidden rounded-full bg-[#16242f]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${r.impactPct}%`,
                        background:
                          r.impactPct >= 50 ? "#ff4a68" : r.impactPct >= 25 ? "#ffb020" : "#14e2a0",
                      }}
                    />
                  </span>
                  <span className="num w-8 text-right">{r.impactPct.toFixed(0)}%</span>
                </span>
              </td>
              <td className="px-3 py-[6px] text-brand">{r.response}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/** Section — defence line. */
export function DefencePanel({
  rows,
  overall,
}: {
  rows: DefenceLine[];
  overall: number;
}) {
  return (
    <Panel
      title="แนวป้องกันของระบบ"
      titleEn="AI Strategy Defense Line"
      right={
        <Tag tone={overall >= 75 ? "up" : overall >= 55 ? "warn" : "down"}>
          ความแข็งแกร่ง {overall}%
        </Tag>
      }
      bodyClassName="p-2.5 flex items-center gap-3"
    >
      <div className="shrink-0">
        <RingGauge
          value={overall}
          size={118}
          label={`${overall}`}
          sub="Defense Score"
          color={overall >= 75 ? "#14e2a0" : overall >= 55 ? "#ffb020" : "#ff4a68"}
        />
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted">
                {r.th} <span className="text-[8.5px] text-dim">{r.en}</span>
              </span>
              <span className="num font-semibold text-txt">{r.score.toFixed(0)}%</span>
            </div>
            <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${r.score}%`,
                  background: r.score >= 75 ? "#14e2a0" : r.score >= 55 ? "#ffb020" : "#ff4a68",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Sections 3 + 13 — the AI conversation feed. */
export function DialoguePanel({ lines, at }: { lines: Dialogue[]; at: number | null }) {
  return (
    <Panel
      title="AI สื่อสารกันเอง"
      titleEn="AI Communication"
      right={<Tag tone="up">LIVE</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {lines.map((l, i) => (
          <li key={l.ai} className="flex items-start gap-2 px-3 py-[7px]">
            <span className="num shrink-0 pt-[2px] text-[9px] text-dim">
              {at ? bkkTime(new Date(at - (lines.length - i) * 1200)) : "--:--:--"}
            </span>
            <span
              className="w-[76px] shrink-0 truncate text-[10px] font-semibold"
              style={{ color: l.color }}
            >
              {l.ai}
            </span>
            <span className="min-w-0 flex-1 text-[10.5px] leading-snug text-muted">
              &quot;{l.textTh}&quot;
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ทุกประโยคอ้างอิงตัวเลขที่ระบบวัดได้จริง — ใช้ตรวจสอบย้อนกลับได้ว่ามติสุดท้ายมาจากอะไร
      </p>
    </Panel>
  );
}

/** Section 8 — tactical proposals. */
export function TacticPanel({ rows }: { rows: Tactic[] }) {
  const TONE = {
    เปลี่ยน: "warn" as const,
    ลด: "down" as const,
    เพิ่ม: "up" as const,
    คงไว้: "neutral" as const,
  };

  return (
    <Panel
      title="ยุทธวิธีที่ AI เสนอ"
      titleEn="AI Tactical Decision"
      right={<Tag tone="neutral">{rows.length} ข้อ</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {rows.map((t) => (
          <li key={t.th} className="flex items-start gap-2 px-3 py-[7px]">
            <Tag tone={TONE[t.stance]}>{t.stance}</Tag>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10.5px] text-txt">{t.th}</span>
              <span className="block truncate text-[9px] text-dim">{t.reasonTh}</span>
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 12 — incident log. */
export function IncidentPanel({ rows }: { rows: Incident[] }) {
  const active = rows.filter((r) => r.active);

  return (
    <Panel
      title="ศูนย์บันทึกเหตุการณ์ผิดปกติ"
      titleEn="Incident Center"
      right={
        <Tag tone={active.length ? "down" : "up"}>
          {active.length ? `กำลังเกิด ${active.length}` : "ไม่มีเหตุการณ์"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {rows.map((r) => (
          <li key={r.key} className="flex items-start gap-2 px-3 py-[6px]">
            <span
              className={`mt-1 size-1.5 shrink-0 rounded-full ${
                !r.active
                  ? "bg-[#33505f]"
                  : r.severity === "critical"
                    ? "bg-down dot-live"
                    : r.severity === "warn"
                      ? "bg-warn dot-live"
                      : "bg-brand"
              }`}
            />
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[10.5px] ${
                  r.active ? "font-semibold text-txt" : "text-muted"
                }`}
              >
                {r.th}
              </span>
              <span className="block truncate text-[9px] text-dim">{r.detail}</span>
            </span>
            <Tag tone={r.active ? (r.severity === "critical" ? "down" : "warn") : "up"}>
              {r.active ? "กำลังเกิด" : "ปกติ"}
            </Tag>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** The Crisis Simulator. */
export function CrisisPanel({
  results,
  selected,
  onSelect,
}: {
  results: CrisisResult[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  const active = results.find((r) => r.scenario.key === selected) ?? results[0];

  return (
    <Panel
      title="จำลองสถานการณ์วิกฤต"
      titleEn="AI Crisis Simulator"
      right={
        <Tag tone={results.every((r) => r.survives) ? "up" : "down"}>
          รอดได้ {results.filter((r) => r.survives).length}/{results.length}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex flex-wrap gap-1">
        {results.map((r) => (
          <button
            key={r.scenario.key}
            type="button"
            onClick={() => onSelect(r.scenario.key)}
            className={`rounded border px-2 py-1 text-[9.5px] transition-colors ${
              selected === r.scenario.key
                ? "border-brand/60 bg-[#062a38] text-brand"
                : r.survives
                  ? "border-line bg-[#0d1922] text-muted hover:text-txt"
                  : "border-down/40 bg-[#1d0b12] text-down"
            }`}
          >
            {r.scenario.th}
          </button>
        ))}
      </div>

      {active && (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[
              {
                th: "ผลกระทบต่อพอร์ต",
                v: fmtPct(active.equityPct),
                tone: active.equityPct >= 0 ? "text-up" : "text-down",
              },
              { th: "พอร์ตคงเหลือ", v: fmtCompact(active.equity) },
              {
                th: "Margin หลังเหตุการณ์",
                v: active.marginRatio > 500 ? "—" : `${active.marginRatio.toFixed(1)}%`,
                tone: active.marginRatio > 60 ? "text-down" : "text-warn",
              },
              {
                th: "สภาพคล่องรองรับ",
                v: `${active.liquidityCover.toFixed(2)}x`,
                tone: active.liquidityCover >= 2 ? "text-up" : "text-down",
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

          <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[9.5px] text-brand">แผนรับมือตามลำดับขั้น</span>
              <Tag tone={active.survives ? "up" : "down"}>
                {active.survives ? "ระบบรอดได้" : "ต้องแทรกแซงทันที"}
              </Tag>
            </div>
            <ol className="space-y-1">
              {active.playbookTh.map((p, i) => (
                <li key={p} className="text-[10px] leading-snug text-muted">
                  <span className="mr-1 text-brand">{i + 1}.</span>
                  {p}
                </li>
              ))}
            </ol>
            <p className="mt-1.5 border-t border-line-soft pt-1.5 text-[9px] text-dim">
              {active.scenario.detailTh} · จำลองทั้งการช็อกราคา {active.scenario.shockPct}%
              และการหายไปของสภาพคล่อง {(active.scenario.liquidityHit * 100).toFixed(0)}%
            </p>
          </div>
        </>
      )}
    </Panel>
  );
}

/** Section 10 — the command console. */
export function CommandConsole({
  actions,
  active,
  onToggle,
}: {
  actions: { key: string; th: string; detail: string; tone: "up" | "warn" | "down" }[];
  active: Record<string, boolean>;
  onToggle: (k: string) => void;
}) {
  return (
    <Panel
      title="แผงสั่งการ"
      titleEn="Command Console"
      right={
        <Tag tone={Object.values(active).some(Boolean) ? "warn" : "up"}>
          บังคับใช้ {Object.values(active).filter(Boolean).length}
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-1.5 sm:grid-cols-2"
    >
      {actions.map((a) => (
        <button
          key={a.key}
          type="button"
          onClick={() => onToggle(a.key)}
          className={`rounded border px-2 py-1.5 text-left transition-colors ${
            active[a.key]
              ? a.tone === "down"
                ? "border-down/50 bg-[#2a0f18] text-down"
                : a.tone === "warn"
                  ? "border-warn/50 bg-[#2d2310] text-warn"
                  : "border-up/50 bg-[#0d2b23] text-up"
              : "border-line bg-[#0d1922] text-muted hover:text-txt"
          }`}
        >
          <span className="block truncate text-[10.5px] font-semibold">{a.th}</span>
          <span className="block truncate text-[8.5px] text-dim">{a.detail}</span>
        </button>
      ))}
      <p className="col-span-full text-[9px] leading-snug text-dim">
        คำสั่งทั้งหมดถูกบันทึกลง Mission Recorder · EMERGENCY STOP ผูกกับปุ่มเดียวกันทั้งระบบ
        และมีผลกับทุกหน้าทันที
      </p>
    </Panel>
  );
}

export { fmtNum };
