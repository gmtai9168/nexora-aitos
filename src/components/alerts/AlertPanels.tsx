"use client";

import {
  SEVERITY_META,
  SOURCE_META,
  STATUS_META,
  TABS,
  type Alert,
  type AlertFilters,
  type AlertKind,
  type AlertStats,
  type TabId,
} from "@/lib/alerts";
import { Panel, Tag } from "../Panel";

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

/** Execution and infrastructure events need millisecond resolution. */
export function eventTime(ms: number, precise: boolean): string {
  const d = new Date(ms);
  const base = d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Bangkok",
    hour12: false,
  });
  return precise ? `${base}.${String(d.getMilliseconds()).padStart(3, "0")}` : base;
}

export function eventDate(ms: number): string {
  return new Date(ms).toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function relative(ms: number, now: number): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return `${s} วินาทีก่อน`;
  if (s < 3600) return `${Math.round(s / 60)} นาทีก่อน`;
  if (s < 86400) return `${Math.round(s / 3600)} ชั่วโมงก่อน`;
  return `${Math.round(s / 86400)} วันก่อน`;
}

const KIND_GLYPH: Record<AlertKind, { ch: string; color: string; bg: string }> = {
  critical: { ch: "⚑", color: "#ff4a68", bg: "#2c1119" },
  warning: { ch: "⚠", color: "#ffb020", bg: "#2d2310" },
  pending: { ch: "◴", color: "#facc15", bg: "#241f0d" },
  info: { ch: "i", color: "#3b9dff", bg: "#0e1c2c" },
  done: { ch: "✓", color: "#14e2a0", bg: "#0d2b23" },
  ai: { ch: "◈", color: "#a78bfa", bg: "#1b1430" },
  shield: { ch: "⛨", color: "#22d3ee", bg: "#0b2430" },
};

export function KindIcon({ kind, size = 30 }: { kind: AlertKind; size?: number }) {
  const g = KIND_GLYPH[kind];
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full border font-bold"
      style={{
        width: size,
        height: size,
        color: g.color,
        background: g.bg,
        borderColor: `${g.color}55`,
        fontSize: size * 0.46,
      }}
      aria-hidden="true"
    >
      {g.ch}
    </span>
  );
}

function SeverityChip({ severity }: { severity: Alert["severity"] }) {
  const m = SEVERITY_META[severity];
  return (
    <span
      className="inline-block whitespace-nowrap rounded border px-1.5 py-[1px] text-[9px] font-semibold"
      style={{ color: m.color, background: m.bg, borderColor: `${m.color}55` }}
    >
      {m.th}
    </span>
  );
}

function StatusDot({ status }: { status: Alert["status"] }) {
  const m = STATUS_META[status];
  return (
    <span className="flex items-center gap-1 whitespace-nowrap">
      <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: m.color }} />
      <span className="text-[10px]" style={{ color: m.color }}>
        {m.th}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Summary cards
 * ------------------------------------------------------------------ */

export function SummaryCards({
  s,
  tab,
  onTab,
}: {
  s: AlertStats;
  tab: TabId;
  onTab: (t: TabId) => void;
}) {
  const cards: { id: TabId; th: string; sub: string; value: number; kind: AlertKind }[] = [
    { id: "all", th: "ทั้งหมด", sub: "การแจ้งเตือน", value: s.total, kind: "critical" },
    { id: "critical", th: "สำคัญเร่งด่วน", sub: "ต้องดำเนินการ", value: s.critical, kind: "warning" },
    { id: "high", th: "สำคัญ", sub: "รอการตรวจสอบ", value: s.high, kind: "pending" },
    { id: "general", th: "ทั่วไป", sub: "ข้อมูลเพื่อทราบ", value: s.general, kind: "info" },
    { id: "done", th: "ดำเนินการแล้ว", sub: "ปิดเหตุการณ์แล้ว", value: s.done, kind: "done" },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {cards.map((c) => {
        const on = tab === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onTab(c.id)}
            className={`panel flex items-center gap-2.5 p-2.5 text-left transition-colors ${
              on ? "border-brand/50 bg-[#0a1c26]" : "hover:bg-[#0d1922]"
            }`}
          >
            <KindIcon kind={c.kind} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-[10.5px] text-muted">{c.th}</span>
              <span className="num block text-[22px] font-extrabold leading-tight text-txt">
                {c.value.toLocaleString()}
              </span>
              <span className="block truncate text-[9px] text-dim">{c.sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 3. List / card views
 * ------------------------------------------------------------------ */

export function AlertToolbar({
  tab,
  onTab,
  counts,
  view,
  onView,
  filtersOpen,
  onFilters,
  activeFilters,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  counts: Record<TabId, number>;
  view: "list" | "card";
  onView: (v: "list" | "card") => void;
  filtersOpen: boolean;
  onFilters: () => void;
  activeFilters: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-2.5 py-2">
      <div className="flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={`rounded px-2 py-[4px] text-[10.5px] transition-colors ${
              tab === t.id
                ? "bg-brand text-black font-semibold"
                : "text-muted hover:bg-[#0f1c26] hover:text-txt"
            }`}
          >
            {t.th}
            <span className={`num ml-1 text-[9px] ${tab === t.id ? "text-black/60" : "text-dim"}`}>
              {counts[t.id]}
            </span>
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[9.5px] text-dim">มุมมอง</span>
        {(["list", "card"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-label={v === "list" ? "มุมมองรายการ" : "มุมมองการ์ด"}
            className={`rounded px-2 py-[4px] text-[11px] transition-colors ${
              view === v ? "bg-brand text-black" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
            }`}
          >
            {v === "list" ? "≡" : "⊞"}
          </button>
        ))}
        <button
          type="button"
          onClick={onFilters}
          className={`rounded border px-2 py-[4px] text-[10px] transition-colors ${
            filtersOpen || activeFilters
              ? "border-brand/50 bg-[#062a38] text-brand"
              : "border-line bg-[#0f1c26] text-muted hover:text-txt"
          }`}
        >
          ตัวกรอง{activeFilters ? ` (${activeFilters})` : ""}
        </button>
      </div>
    </div>
  );
}

function ListRow({
  a,
  now,
  active,
  onSelect,
}: {
  a: Alert;
  now: number;
  active: boolean;
  onSelect: () => void;
}) {
  const precise = a.source === "sysops" || a.source === "exchange" || a.source === "execution";
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-t border-line-soft transition-colors ${
        active ? "bg-[#0e1f26]" : "hover:bg-[#0d1922]"
      }`}
    >
      <td className="num whitespace-nowrap px-2.5 py-2 align-top text-[10px] text-muted">
        <span className="block">{eventDate(a.lastSeen)}</span>
        <span className="block text-dim">{eventTime(a.lastSeen, precise)}</span>
      </td>
      <td className="px-1.5 py-2 align-top">
        <KindIcon kind={a.kind} size={26} />
      </td>
      <td className="px-1.5 py-2 align-top">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[11px] font-semibold text-txt">{a.title}</span>
          {a.occurrences > 1 && (
            <span className="num shrink-0 rounded border border-line bg-[#111e28] px-1 text-[8.5px] text-muted">
              ×{a.occurrences}
            </span>
          )}
          {a.suppressedByDnd && (
            <span className="shrink-0 rounded border border-line bg-[#111e28] px-1 text-[8.5px] text-dim">
              ห้ามรบกวน
            </span>
          )}
        </span>
        <span className="mt-[2px] block truncate text-[10px] text-muted">{a.detail}</span>
      </td>
      <td className="whitespace-nowrap px-1.5 py-2 align-top text-[10px] text-muted">
        {SOURCE_META[a.source].en}
      </td>
      <td className="px-1.5 py-2 align-top">
        <SeverityChip severity={a.severity} />
      </td>
      <td className="px-1.5 py-2 align-top">
        <StatusDot status={a.status} />
        <span className="mt-[2px] block whitespace-nowrap text-[9px] text-dim">
          {relative(a.lastSeen, now)}
        </span>
      </td>
      <td className="px-2 py-2 text-right align-top">
        <span className="text-[13px] text-dim">···</span>
      </td>
    </tr>
  );
}

function CardItem({
  a,
  now,
  active,
  onSelect,
}: {
  a: Alert;
  now: number;
  active: boolean;
  onSelect: () => void;
}) {
  const m = SEVERITY_META[a.severity];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col gap-1.5 rounded border p-2.5 text-left transition-colors ${
        active ? "border-brand/50 bg-[#0e1f26]" : "border-line bg-[#0a121a] hover:bg-[#0d1922]"
      }`}
      style={{ borderLeftWidth: 3, borderLeftColor: m.color }}
    >
      <span className="flex items-start gap-2">
        <KindIcon kind={a.kind} size={28} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11.5px] font-semibold text-txt">{a.title}</span>
          <span className="block text-[10px] leading-snug text-muted">{a.detail}</span>
        </span>
        <SeverityChip severity={a.severity} />
      </span>

      <span className="grid grid-cols-2 gap-1">
        <span className="rounded border border-line-soft bg-[#081017] px-1.5 py-[3px]">
          <span className="block text-[8.5px] text-dim">ค่าที่ตรวจพบ</span>
          <span className="num block truncate text-[10.5px] text-txt">{a.observed}</span>
        </span>
        <span className="rounded border border-line-soft bg-[#081017] px-1.5 py-[3px]">
          <span className="block text-[8.5px] text-dim">เกณฑ์ที่ตั้งไว้</span>
          <span className="num block truncate text-[10.5px] text-muted">{a.threshold}</span>
        </span>
      </span>

      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] text-dim">
        <StatusDot status={a.status} />
        <span>· {SOURCE_META[a.source].en}</span>
        {a.entity.symbol && <span>· {a.entity.symbol}</span>}
        {a.entity.venue && <span>· {a.entity.venue}</span>}
        {a.occurrences > 1 && <span className="num">· เกิดซ้ำ {a.occurrences} ครั้ง</span>}
        <span className="ml-auto">{relative(a.lastSeen, now)}</span>
      </span>
    </button>
  );
}

export function AlertList({
  alerts,
  now,
  view,
  activeId,
  onSelect,
  page,
  pageSize,
  onPage,
  header,
}: {
  alerts: Alert[];
  now: number;
  view: "list" | "card";
  activeId: string | null;
  onSelect: (a: Alert) => void;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  header: React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(alerts.length / pageSize));
  const safePage = Math.min(page, pages);
  const shown = alerts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const nums: number[] = [];
  const from = Math.max(1, safePage - 2);
  for (let p = from; p < from + 5 && p <= pages; p++) nums.push(p);

  return (
    <section className="panel flex min-w-0 flex-col">
      {header}

      {alerts.length === 0 ? (
        <p className="py-14 text-center text-[11px] text-dim">
          ไม่มีการแจ้งเตือนที่ตรงกับเงื่อนไขนี้ — ระบบยังตรวจอยู่ทุกรอบการดึงข้อมูล
        </p>
      ) : view === "list" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="px-2.5 py-1.5 font-medium">เวลา</th>
                <th className="px-1.5 py-1.5 font-medium">ประเภท</th>
                <th className="px-1.5 py-1.5 font-medium">ข้อความแจ้งเตือน</th>
                <th className="px-1.5 py-1.5 font-medium">แหล่งที่มา</th>
                <th className="px-1.5 py-1.5 font-medium">ความรุนแรง</th>
                <th className="px-1.5 py-1.5 font-medium">สถานะ</th>
                <th className="px-2 py-1.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {shown.map((a) => (
                <ListRow
                  key={a.id}
                  a={a}
                  now={now}
                  active={activeId === a.id}
                  onSelect={() => onSelect(a)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-2 p-2.5 sm:grid-cols-2">
          {shown.map((a) => (
            <CardItem
              key={a.id}
              a={a}
              now={now}
              active={activeId === a.id}
              onSelect={() => onSelect(a)}
            />
          ))}
        </div>
      )}

      {alerts.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-2.5 py-1.5">
          <span className="text-[9px] text-dim">
            แสดง {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, alerts.length)} จาก{" "}
            {alerts.length} รายการ · คลิกเพื่อเปิดรายละเอียด
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onPage(Math.max(1, safePage - 1))}
              disabled={safePage === 1}
              className="rounded border border-line px-2 py-[3px] text-[9.5px] text-muted hover:text-txt disabled:opacity-30"
            >
              ‹
            </button>
            {nums.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={`num rounded px-2 py-[3px] text-[9.5px] transition-colors ${
                  p === safePage ? "bg-brand text-black font-bold" : "text-muted hover:bg-[#0f1c26]"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onPage(Math.min(pages, safePage + 1))}
              disabled={safePage === pages}
              className="rounded border border-line px-2 py-[3px] text-[9.5px] text-muted hover:text-txt disabled:opacity-30"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * 6. Filters
 * ------------------------------------------------------------------ */

const SELECT =
  "w-full rounded border border-line bg-[#0a121a] px-1.5 py-[5px] text-[10.5px] text-txt outline-none focus:border-brand/60";

export type FilterPreset = { id: string; name: string; filters: AlertFilters };

export function FiltersBar({
  f,
  onChange,
  onReset,
  symbols,
  assignees,
  presets,
  onSavePreset,
  onApplyPreset,
}: {
  f: AlertFilters;
  onChange: (f: AlertFilters) => void;
  onReset: () => void;
  symbols: string[];
  assignees: string[];
  presets: FilterPreset[];
  onSavePreset: () => void;
  onApplyPreset: (p: FilterPreset) => void;
}) {
  const set = <K extends keyof AlertFilters>(k: K, v: AlertFilters[K]) => onChange({ ...f, [k]: v });

  return (
    <div className="border-b border-line-soft bg-[#081017] p-2.5">
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">คำสำคัญ</span>
          <input
            className={SELECT}
            placeholder="ค้นหาในหัวข้อและรายละเอียด"
            value={f.search}
            onChange={(e) => set("search", e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">ความรุนแรง</span>
          <select className={SELECT} value={f.severity} onChange={(e) => set("severity", e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {(Object.keys(SEVERITY_META) as (keyof typeof SEVERITY_META)[]).map((k) => (
              <option key={k} value={k}>
                {SEVERITY_META[k].th}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">สถานะ</span>
          <select className={SELECT} value={f.status} onChange={(e) => set("status", e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[]).map((k) => (
              <option key={k} value={k}>
                {STATUS_META[k].th}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">แหล่งที่มา</span>
          <select className={SELECT} value={f.source} onChange={(e) => set("source", e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {(Object.keys(SOURCE_META) as (keyof typeof SOURCE_META)[]).map((k) => (
              <option key={k} value={k}>
                {SOURCE_META[k].en}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">สินทรัพย์</span>
          <select className={SELECT} value={f.symbol} onChange={(e) => set("symbol", e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">ผู้รับผิดชอบ</span>
          <select className={SELECT} value={f.assignee} onChange={(e) => set("assignee", e.target.value)}>
            <option value="all">ทั้งหมด</option>
            {assignees.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted">
          <input
            type="checkbox"
            checked={f.actionableOnly}
            onChange={(e) => set("actionableOnly", e.target.checked)}
            className="accent-[#00d4ff]"
          />
          เฉพาะเหตุการณ์ที่ต้องดำเนินการ
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted">
          <input
            type="checkbox"
            checked={f.autoResolvedOnly}
            onChange={(e) => set("autoResolvedOnly", e.target.checked)}
            className="accent-[#00d4ff]"
          />
          เฉพาะที่ระบบแก้ไขเอง
        </label>

        <span className="ml-auto flex flex-wrap items-center gap-1">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p)}
              className="rounded border border-line bg-[#0f1c26] px-1.5 py-[3px] text-[9.5px] text-muted hover:text-txt"
            >
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={onSavePreset}
            className="rounded border border-brand/40 bg-[#062a38] px-1.5 py-[3px] text-[9.5px] text-brand"
          >
            บันทึกเป็นชุดตัวกรอง
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-line px-1.5 py-[3px] text-[9.5px] text-muted hover:text-txt"
          >
            ล้าง
          </button>
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Workflow strip — what the detector actually does each cycle
 * ------------------------------------------------------------------ */

export function WorkflowStrip({ lastRun, nextIn }: { lastRun: number; nextIn: number }) {
  const steps = [
    "ตลาด · AI · กระดานเทรด · โครงสร้างพื้นฐาน",
    "ตรวจจับเหตุการณ์",
    "ประเมินตามกฎ",
    "จัดระดับ + รวมรายการซ้ำ + เลือกช่องทาง",
    "แจ้งในระบบ",
    "รับทราบหรือระบบตอบสนอง",
    "ปิดเหตุการณ์ + บันทึกตรวจสอบ",
  ];

  return (
    <Panel
      title="ลำดับการทำงานของระบบแจ้งเตือน"
      titleEn="Detection Workflow"
      right={
        <Tag tone="up">
          ตรวจล่าสุด {lastRun ? eventTime(lastRun, false) : "—"} · รอบถัดไปใน {nextIn} วิ
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span className="rounded border border-line bg-[#0a121a] px-2 py-[4px] text-[9.5px] text-muted">
              <span className="num mr-1 text-brand">{i + 1}</span>
              {s}
            </span>
            {i < steps.length - 1 && <span className="text-[11px] text-dim">→</span>}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
