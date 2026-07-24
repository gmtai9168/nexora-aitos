"use client";

import { useMemo, useState } from "react";
import {
  CHANNELS,
  FREQUENCIES,
  GROUPS,
  inQuietHours,
  LIVE_RULES,
  ROLES,
  RULES,
  RULE_TYPE_TH,
  SEVERITY_META,
  SOURCE_META,
  type AlertStats,
  type ChannelId,
  type Preferences,
  type Severity,
  type TabId,
} from "@/lib/alerts";
import { Panel, Tag } from "../Panel";

const SEV_ORDER: Severity[] = ["critical", "high", "medium", "low", "info"];

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`relative h-[18px] w-[34px] shrink-0 rounded-full transition-colors ${
        on ? "bg-brand" : "bg-[#1d2f3c]"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-[left] ${
          on ? "left-[18px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * 8. Channels
 * ------------------------------------------------------------------ */

export function ChannelsPanel({
  prefs,
  onChange,
}: {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
}) {
  const [open, setOpen] = useState<ChannelId | null>(null);

  const setChannel = (id: ChannelId, patch: Partial<Preferences["channels"][ChannelId]>) =>
    onChange({
      ...prefs,
      channels: { ...prefs.channels, [id]: { ...prefs.channels[id], ...patch } },
    });

  return (
    <Panel
      title="ช่องทางการแจ้งเตือน"
      titleEn="Notification Channels"
      right={<Tag tone="warn">ส่งจริงได้ 1 จาก {CHANNELS.length}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {CHANNELS.map((c) => {
        const p = prefs.channels[c.id];
        const expanded = open === c.id;
        return (
          <div key={c.id} className="rounded border border-line-soft bg-[#0a121a]">
            <div className="flex items-center gap-2 px-2 py-1.5">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : c.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] text-txt">{c.th}</span>
                    <span className="truncate text-[9px] text-dim">{c.en}</span>
                  </span>
                  <span
                    className={`block truncate text-[8.5px] ${c.connected ? "text-up" : "text-warn"}`}
                  >
                    {c.connected ? "เชื่อมต่อแล้ว" : "ยังไม่เชื่อมต่อ"}
                  </span>
                </span>
              </button>
              <Toggle on={p.on} onChange={(v) => setChannel(c.id, { on: v })} />
            </div>

            {expanded && (
              <div className="border-t border-line-soft px-2 py-1.5">
                <label className="block">
                  <span className="mb-[3px] block text-[9px] text-muted">
                    ส่งเมื่อระดับความรุนแรงอย่างน้อย
                  </span>
                  <select
                    className="w-full rounded border border-line bg-[#081017] px-1.5 py-[4px] text-[10px] text-txt"
                    value={p.minSeverity}
                    onChange={(e) => setChannel(c.id, { minSeverity: e.target.value as Severity })}
                  >
                    {SEV_ORDER.map((s) => (
                      <option key={s} value={s}>
                        {SEVERITY_META[s].th} ขึ้นไป
                      </option>
                    ))}
                  </select>
                </label>
                <p className="mt-1 text-[9px] leading-snug text-dim">{c.note}</p>
              </div>
            )}
          </div>
        );
      })}

      <p className="rounded border border-warn/30 bg-[#20180a] px-2 py-1.5 text-[9px] leading-snug text-warn">
        มีเพียงช่องทางในระบบที่ส่งได้จริง — ช่องทางอื่นต้องมีบริการฝั่งเซิร์ฟเวอร์และคีย์ลับ
        ซึ่งแพลตฟอร์มนี้ยังไม่มี การเปิดสวิตช์จึงเก็บเป็นค่าตั้งไว้เท่านั้น ยังไม่มีข้อความถูกส่งออกไป
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 9. Rules, groups, frequency, quiet hours
 * ------------------------------------------------------------------ */

export function SettingsPanel({
  prefs,
  onChange,
  now,
}: {
  prefs: Preferences;
  onChange: (p: Preferences) => void;
  now: number;
}) {
  const [tab, setTab] = useState<"rules" | "groups" | "frequency" | "dnd" | "role">("rules");
  const quiet = inQuietHours(prefs, now);

  const setThreshold = (id: string, v: number) =>
    onChange({ ...prefs, thresholds: { ...prefs.thresholds, [id]: v } });

  const toggleRule = (id: string) =>
    onChange({
      ...prefs,
      disabledRules: prefs.disabledRules.includes(id)
        ? prefs.disabledRules.filter((x) => x !== id)
        : [...prefs.disabledRules, id],
    });

  const TABS = [
    { id: "rules", th: "กฎการแจ้งเตือน" },
    { id: "groups", th: "กลุ่มผู้รับ" },
    { id: "frequency", th: "ความถี่" },
    { id: "dnd", th: "ห้ามรบกวน" },
    { id: "role", th: "สิทธิ์" },
  ] as const;

  return (
    <Panel
      title="ตั้งค่าการแจ้งเตือน"
      titleEn="Alert Settings"
      right={
        <Tag tone={quiet ? "warn" : "neutral"}>
          {quiet ? "อยู่ในช่วงห้ามรบกวน" : `ใช้งาน ${LIVE_RULES.length - prefs.disabledRules.length} กฎ`}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <div className="mb-2 flex flex-wrap gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded px-1.5 py-[3px] text-[9.5px] transition-colors ${
              tab === t.id ? "bg-brand text-black font-semibold" : "bg-[#0d1922] text-muted hover:text-txt"
            }`}
          >
            {t.th}
          </button>
        ))}
      </div>

      {tab === "rules" && (
        <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
          {RULES.map((r) => {
            const live = r.detect !== null;
            const off = prefs.disabledRules.includes(r.id);
            const value = prefs.thresholds[r.id] ?? r.threshold;
            return (
              <div
                key={r.id}
                className={`rounded border px-2 py-1.5 ${
                  live ? "border-line-soft bg-[#0a121a]" : "border-line bg-[#080d13] opacity-70"
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="truncate text-[10.5px] text-txt">{r.th}</span>
                      <span
                        className="shrink-0 rounded px-1 text-[8px]"
                        style={{
                          color: SEVERITY_META[r.severity].color,
                          background: SEVERITY_META[r.severity].bg,
                        }}
                      >
                        {SEVERITY_META[r.severity].th}
                      </span>
                    </span>
                    <span className="block truncate text-[8.5px] text-dim">
                      {RULE_TYPE_TH[r.type]} · {SOURCE_META[r.source].en}
                    </span>
                  </span>
                  {live ? (
                    <Toggle on={!off} onChange={() => toggleRule(r.id)} />
                  ) : (
                    <span className="shrink-0 rounded border border-line px-1 py-[1px] text-[8px] text-dim">
                      ใช้ไม่ได้
                    </span>
                  )}
                </div>

                {live && r.fixed ? (
                  <p className="mt-1 text-[9px] leading-snug text-dim">
                    กฎนี้เฝ้าดูสถานะเปิด/ปิด จึงไม่มีเกณฑ์ตัวเลขให้ปรับ
                  </p>
                ) : live ? (
                  <label className="mt-1 flex items-center gap-1.5">
                    <span className="shrink-0 text-[9px] text-muted">เกณฑ์</span>
                    <input
                      type="number"
                      value={value}
                      step={value < 2 ? 0.01 : 1}
                      disabled={off}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) setThreshold(r.id, v);
                      }}
                      className="num w-[86px] rounded border border-line bg-[#081017] px-1 py-[3px] text-[10px] text-txt disabled:opacity-40"
                    />
                    <span className="shrink-0 text-[9px] text-dim">{r.unit}</span>
                    {value !== r.threshold && (
                      <button
                        type="button"
                        onClick={() => setThreshold(r.id, r.threshold)}
                        className="ml-auto shrink-0 text-[9px] text-brand"
                      >
                        คืนค่าเดิม ({r.threshold})
                      </button>
                    )}
                  </label>
                ) : null}

                {live && r.condition && (
                  <p className="mt-[3px] text-[8.5px] leading-snug text-dim">
                    {r.condition.replaceAll("N", String(value))}
                  </p>
                )}

                {!live && (
                  <p className="mt-1 text-[9px] leading-snug text-warn">{r.unavailable}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "groups" && (
        <div className="space-y-1">
          {GROUPS.map((g) => (
            <div key={g.id} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[10.5px] text-txt">{g.th}</span>
                <span
                  className="shrink-0 rounded px-1 text-[8.5px]"
                  style={{
                    color: SEVERITY_META[g.minSeverity].color,
                    background: SEVERITY_META[g.minSeverity].bg,
                  }}
                >
                  {SEVERITY_META[g.minSeverity].th} ขึ้นไป
                </span>
              </div>
              <div className="mt-[2px] text-[9px] text-dim">
                รับจาก: {g.sources.map((s) => SOURCE_META[s].en).join(", ")}
              </div>
            </div>
          ))}
          <p className="text-[9px] leading-snug text-dim">
            หนึ่งเหตุการณ์ส่งให้หลายกลุ่มได้ตามแหล่งที่มาและระดับความรุนแรง —
            การกำหนดกลุ่มที่นี่เป็นค่าตั้งไว้ ยังไม่มีการส่งออกนอกระบบ
          </p>
        </div>
      )}

      {tab === "frequency" && (
        <div className="space-y-1">
          {FREQUENCIES.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange({ ...prefs, frequency: f.id })}
              className={`flex w-full items-center justify-between gap-2 rounded border px-2 py-1.5 text-left transition-colors ${
                prefs.frequency === f.id
                  ? "border-brand/50 bg-[#062a38] text-brand"
                  : "border-line-soft bg-[#0a121a] text-muted hover:text-txt"
              }`}
            >
              <span className="truncate text-[10.5px]">{f.th}</span>
              {prefs.frequency === f.id && <span className="shrink-0 text-[10px]">✓</span>}
            </button>
          ))}
          <p className="text-[9px] leading-snug text-dim">
            ค่านี้ทำงานจริงกับการแจ้งในระบบ — เหตุการณ์เดิมที่ยังเกิดอยู่จะไม่ถูกดันขึ้นเป็น
            &ldquo;ยังไม่อ่าน&rdquo; ซ้ำจนกว่าจะครบช่วงเวลาที่เลือก
            และเหตุการณ์ที่มาจากสาเหตุเดียวกันจะถูกรวมเป็นรายการเดียวพร้อมตัวนับจำนวนครั้ง
          </p>
        </div>
      )}

      {tab === "dnd" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
            <span className="text-[10.5px] text-txt">เปิดช่วงห้ามรบกวน</span>
            <Toggle
              on={prefs.dnd.on}
              onChange={(v) => onChange({ ...prefs, dnd: { ...prefs.dnd, on: v } })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-[3px] block text-[9px] text-muted">ตั้งแต่</span>
              <input
                type="time"
                value={prefs.dnd.from}
                onChange={(e) => onChange({ ...prefs, dnd: { ...prefs.dnd, from: e.target.value } })}
                className="num w-full rounded border border-line bg-[#081017] px-1.5 py-[4px] text-[10px] text-txt"
              />
            </label>
            <label className="block">
              <span className="mb-[3px] block text-[9px] text-muted">ถึง</span>
              <input
                type="time"
                value={prefs.dnd.to}
                onChange={(e) => onChange({ ...prefs, dnd: { ...prefs.dnd, to: e.target.value } })}
                className="num w-full rounded border border-line bg-[#081017] px-1.5 py-[4px] text-[10px] text-txt"
              />
            </label>
          </div>
          <p
            className={`rounded border px-2 py-1.5 text-[9.5px] leading-snug ${
              quiet ? "border-warn/30 bg-[#20180a] text-warn" : "border-line-soft bg-[#0a121a] text-dim"
            }`}
          >
            {quiet
              ? "ขณะนี้อยู่ในช่วงห้ามรบกวน — เหตุการณ์ใหม่ที่ไม่ใช่ระดับสำคัญเร่งด่วนจะถูกบันทึกไว้เงียบ ๆ"
              : "นอกช่วงห้ามรบกวน — แจ้งเตือนทุกระดับตามปกติ"}{" "}
            ระดับสำคัญเร่งด่วนจะข้ามช่วงนี้เสมอ เวลาอ้างอิงตามเวลาไทย
          </p>
        </div>
      )}

      {tab === "role" && (
        <div className="space-y-1">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onChange({ ...prefs, role: r.id })}
              className={`flex w-full flex-col gap-[2px] rounded border px-2 py-1.5 text-left transition-colors ${
                prefs.role === r.id
                  ? "border-brand/50 bg-[#062a38]"
                  : "border-line-soft bg-[#0a121a] hover:bg-[#0d1922]"
              }`}
            >
              <span
                className={`truncate text-[10.5px] ${prefs.role === r.id ? "text-brand" : "text-txt"}`}
              >
                {r.th}
              </span>
              <span className="truncate text-[8.5px] text-dim">
                {r.sources === "all"
                  ? "เห็นทุกเหตุการณ์และตั้งนโยบายรวมได้"
                  : `เห็นเฉพาะ: ${r.sources.map((s) => SOURCE_META[s].en).join(", ")}`}
              </span>
            </button>
          ))}
          <p className="text-[9px] leading-snug text-dim">
            สิทธิ์นี้กรองรายการที่แสดงจริงในตารางตามแหล่งที่มา —
            ในระบบจริงต้องบังคับที่ฝั่งเซิร์ฟเวอร์ด้วย ไม่ใช่ที่หน้าเว็บเพียงอย่างเดียว
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 10. Last 24 hours
 * ------------------------------------------------------------------ */

const SLICES: { id: TabId; th: string; color: string; pick: (s: AlertStats) => number }[] = [
  { id: "critical", th: "สำคัญเร่งด่วน", color: "#ff4a68", pick: (s) => s.critical },
  { id: "high", th: "สำคัญ", color: "#ffb020", pick: (s) => s.high },
  { id: "general", th: "ทั่วไป", color: "#3b9dff", pick: (s) => s.general },
  { id: "done", th: "ดำเนินการแล้ว", color: "#14e2a0", pick: (s) => s.done },
];

function duration(sec: number | null): string {
  if (sec === null) return "—";
  if (sec < 60) return `${sec.toFixed(0)} วิ`;
  if (sec < 3600) return `${(sec / 60).toFixed(1)} นาที`;
  return `${(sec / 3600).toFixed(1)} ชม.`;
}

export function SummaryDonut({
  s,
  onTab,
  windowHours,
}: {
  s: AlertStats;
  onTab: (t: TabId) => void;
  windowHours: number;
}) {
  // Arc lengths and their running start offsets, resolved before rendering.
  const arcs = useMemo(() => {
    const values = SLICES.map((sl) => sl.pick(s));
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const r = 42;
    const c = 2 * Math.PI * r;

    return SLICES.reduce<
      { slice: (typeof SLICES)[number]; value: number; len: number; offset: number; c: number; r: number; pct: number }[]
    >((acc, slice, i) => {
      const prev = acc.at(-1);
      const len = (values[i] / total) * c;
      acc.push({
        slice,
        value: values[i],
        len,
        offset: prev ? prev.offset + prev.len : 0,
        c,
        r,
        pct: (values[i] / total) * 100,
      });
      return acc;
    }, []);
  }, [s]);

  const total = SLICES.reduce((a, sl) => a + sl.pick(s), 0);

  return (
    <Panel
      title={`สรุป ${windowHours} ชั่วโมงล่าสุด`}
      titleEn="Last 24 Hours"
      right={<Tag tone={s.critical ? "down" : "up"}>{s.needsPerson} รายการต้องมีคนดู</Tag>}
      bodyClassName="p-2.5"
    >
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 100 100" style={{ width: 118 }} aria-hidden="true">
          {arcs.map((a) => (
            <circle
              key={a.slice.id}
              cx="50"
              cy="50"
              r={a.r}
              fill="none"
              stroke={a.slice.color}
              strokeWidth="13"
              strokeDasharray={`${a.len.toFixed(2)} ${(a.c - a.len).toFixed(2)}`}
              strokeDashoffset={-a.offset}
              transform="rotate(-90 50 50)"
            />
          ))}
          <text x="50" y="48" textAnchor="middle" fill="#d5e2ee" fontSize="19" fontWeight="700">
            {total}
          </text>
          <text x="50" y="61" textAnchor="middle" fill="#6b8497" fontSize="7.5">
            ทั้งหมด
          </text>
        </svg>

        <ul className="min-w-0 flex-1 space-y-[3px]">
          {arcs.map((a) => (
            <li key={a.slice.id}>
              <button
                type="button"
                onClick={() => onTab(a.slice.id)}
                className="flex w-full items-center gap-1.5 rounded px-1 py-[2px] text-left hover:bg-[#0f1c26]"
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: a.slice.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[10px] text-muted">{a.slice.th}</span>
                <span className="num shrink-0 text-[10px] text-txt">
                  {a.value} ({a.pct.toFixed(0)}%)
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {[
          { l: "เวลาเฉลี่ยจนรับทราบ", v: duration(s.mtta), en: "MTTA" },
          { l: "เวลาเฉลี่ยจนปิดเหตุการณ์", v: duration(s.mttr), en: "MTTR" },
          { l: "เหตุการณ์ซ้ำที่ถูกรวม", v: `${s.repeats} ครั้ง`, en: "Deduplicated" },
          { l: "ระบบแก้ไขเอง", v: `${s.autoResolved} รายการ`, en: "Auto-resolved" },
        ].map((x) => (
          <div key={x.en} className="min-w-0 rounded border border-line-soft bg-[#0a121a] px-2 py-1">
            <div className="truncate text-[9px] text-muted">{x.l}</div>
            <div className="truncate text-[8px] text-dim">{x.en}</div>
            <div className="num truncate text-[12px] font-bold text-txt">{x.v}</div>
          </div>
        ))}
      </div>

      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        คลิกที่สีเพื่อกรองตาราง · เวลาเฉลี่ยคำนวณจากเวลาจริงระหว่างการตรวจพบ การรับทราบ
        และการปิดเหตุการณ์ในเซสชันนี้
      </p>
    </Panel>
  );
}
