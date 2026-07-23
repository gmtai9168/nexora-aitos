"use client";

import { bkkTime, fmtNum, fmtPct } from "@/lib/format";
import type {
  Article,
  BrainState,
  Goal,
  HealthRow,
  MissionRecord,
  QueueItem,
} from "@/lib/autonomous";
import { MODES, OVERRIDES, type AutonomyMode } from "@/lib/autonomous";
import type { CommitteeVote } from "@/lib/risk-engine";
import { Panel, Tag } from "../Panel";

/** Section 10 — the five-mode selector, the platform's main control. */
export function ModeSelector({
  mode,
  onMode,
}: {
  mode: AutonomyMode;
  onMode: (m: AutonomyMode) => void;
}) {
  const active = MODES.find((m) => m.key === mode)!;

  return (
    <Panel
      title="โหมดการทำงานอัตโนมัติ"
      titleEn="Autonomous Control"
      right={
        <Tag tone={mode === "emergency" ? "down" : mode === "full" ? "up" : "warn"}>
          {active.en.toUpperCase()}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid gap-1.5 sm:grid-cols-5">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onMode(m.key)}
            className="rounded border px-2 py-2 text-left transition-colors"
            style={{
              borderColor: mode === m.key ? `${m.color}88` : "#16242f",
              background: mode === m.key ? `${m.color}18` : "#0a121a",
              boxShadow: mode === m.key ? `0 0 12px ${m.color}33` : undefined,
            }}
          >
            <span
              className="block truncate text-[10.5px] font-bold"
              style={{ color: mode === m.key ? m.color : "#6b8497" }}
            >
              {m.th}
            </span>
            <span className="block truncate text-[8.5px] text-dim">{m.en}</span>
          </button>
        ))}
      </div>
      <p className="rounded border border-line-soft bg-[#08111a] px-2.5 py-1.5 text-[10px] leading-snug text-muted">
        <span style={{ color: active.color }}>{active.th}:</span> {active.detail}
      </p>
    </Panel>
  );
}

/** Section 4 — the Master AI's own state, in plain language. */
export function MasterBrain({ brain }: { brain: BrainState }) {
  const rows: [string, string][] = [
    ["เป้าหมายปัจจุบัน", brain.objectiveTh],
    ["โหมดความเสี่ยง", brain.riskModeTh],
    ["สภาวะตลาด", brain.marketModeTh],
    ["รูปแบบการเทรด", brain.tradingModeTh],
    ["กำลังโฟกัส", brain.focus],
    ["ความมั่นใจ", `${brain.confidence}%`],
    ["Expected RR", brain.expectedRR ? `1 : ${brain.expectedRR}` : "—"],
    ["Expected Win", brain.expectedWin ? `${brain.expectedWin}%` : "—"],
  ];

  return (
    <Panel
      title="สมองของ MASTER AI"
      titleEn="Master AI Brain"
      right={<Tag tone="up">คิดจากข้อมูลจริง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
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

      <div className="rounded border border-brand/30 bg-[#062028] px-2.5 py-2">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="dot-live size-1.5 rounded-full bg-brand" />
          <span className="text-[9.5px] text-brand">Master AI กำลังคิดว่า</span>
        </div>
        <p className="text-[10.5px] leading-relaxed text-muted">
          &quot;{brain.narrativeTh}&quot;
        </p>
      </div>
    </Panel>
  );
}

/** Section 3 — the approval queue. */
export function DecisionQueue({ items }: { items: QueueItem[] }) {
  const TONE = {
    approved: "up" as const,
    waiting: "warn" as const,
    rejected: "down" as const,
    pending: "neutral" as const,
  };

  return (
    <Panel
      title="คิวการตัดสินใจของ AI"
      titleEn="AI Decision Queue"
      right={
        <Tag tone="neutral">
          รออนุมัติ {items.filter((i) => i.status === "waiting").length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {items.length === 0 && (
          <li className="px-3 py-8 text-center text-[11px] text-dim">กำลังรวบรวมสัญญาณ…</li>
        )}
        {items.map((q) => (
          <li key={q.symbol} className="px-3 py-[7px]">
            <div className="flex items-center gap-2">
              <span className="w-[52px] shrink-0 text-[10.5px] font-semibold">
                {q.symbol.replace("USDT", "")}
              </span>
              <Tag tone={q.side === "LONG" ? "up" : "down"}>{q.side}</Tag>
              <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                <span
                  className="block h-full rounded-full bg-brand"
                  style={{ width: `${q.confidence}%` }}
                />
              </span>
              <span className="num w-8 shrink-0 text-right text-[10px] text-brand">
                {q.confidence}%
              </span>
              <Tag tone={TONE[q.status]}>{q.statusTh}</Tag>
            </div>
            <p className="mt-0.5 truncate text-[9px] text-dim">{q.reason}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Section 5 — the live committee tally. */
export function CommitteeVoting({
  votes,
  verdict,
}: {
  votes: CommitteeVote[];
  verdict: string;
}) {
  const yes = votes.filter((v) => v.vote === "APPROVE").length;

  return (
    <Panel
      title="การลงมติของคณะ AI"
      titleEn="AI Committee Voting"
      right={
        <Tag tone={verdict === "APPROVED" ? "up" : verdict === "REDUCED" ? "warn" : "down"}>
          {yes}/{votes.length} เห็นชอบ
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-x-3 gap-y-1 sm:grid-cols-2"
    >
      {votes.map((v) => (
        <div key={v.id} className="flex items-center gap-1.5">
          <span
            className={`grid size-3.5 shrink-0 place-items-center rounded-full text-[8px] font-bold ${
              v.vote === "APPROVE"
                ? "bg-up/20 text-up"
                : v.vote === "REDUCE"
                  ? "bg-warn/20 text-warn"
                  : "bg-down/20 text-down"
            }`}
          >
            {v.vote === "APPROVE" ? "✓" : v.vote === "REDUCE" ? "!" : "✕"}
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-muted">{v.name}</span>
          <span
            className={`shrink-0 text-[9.5px] font-bold ${
              v.vote === "APPROVE"
                ? "text-up"
                : v.vote === "REDUCE"
                  ? "text-warn"
                  : "text-down"
            }`}
          >
            {v.vote === "APPROVE" ? "YES" : v.vote === "REDUCE" ? "ลดขนาด" : "NO"}
          </span>
        </div>
      ))}
      <div className="col-span-full mt-1 border-t border-line-soft pt-1.5 text-[10px]">
        <span className="text-dim">มติสุดท้ายของ Master AI: </span>
        <span
          className={
            verdict === "APPROVED" ? "text-up" : verdict === "REDUCED" ? "text-warn" : "text-down"
          }
        >
          {verdict === "APPROVED" ? "อนุมัติ" : verdict === "REDUCED" ? "อนุมัติแบบลดขนาด" : "ปฏิเสธ"}
        </span>
      </div>
    </Panel>
  );
}

/** Section 11 — the goal board. */
export function GoalPanel({ goals }: { goals: Goal[] }) {
  return (
    <Panel
      title="เป้าหมายที่ตั้งให้ AI"
      titleEn="AI Goal Manager"
      right={<Tag tone="warn">เป้าหมาย ไม่ใช่การรับประกัน</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {goals.map((g) => {
        const pct = g.inverse
          ? Math.max(0, Math.min(100, (1 - g.actual / g.target) * 100))
          : Math.max(0, Math.min(100, (g.actual / g.target) * 100));
        const ok = g.inverse ? g.actual <= g.target : g.actual >= g.target;

        return (
          <div key={g.key}>
            <div className="flex justify-between text-[10px]">
              <span className="text-muted">
                {g.th}{" "}
                <span className="text-[8.5px] text-dim">
                  {g.inverse ? "ไม่เกิน" : "เป้า"} {g.target}
                  {g.unit}
                </span>
              </span>
              <span className={`num font-semibold ${ok ? "text-up" : "text-warn"}`}>
                {g.actual >= 0 && !g.inverse ? "+" : ""}
                {g.actual.toFixed(2)}
                {g.unit}
              </span>
            </div>
            <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: ok ? "#14e2a0" : "#ffb020" }}
              />
            </div>
          </div>
        );
      })}
      <p className="mt-1 text-[9px] leading-snug text-dim">
        AI จะพยายามดำเนินกลยุทธ์ให้อยู่ในกรอบนี้ แต่ไม่รับประกันผลลัพธ์ในทุกสภาวะตลาด —
        เพดาน Drawdown และมาร์จิ้นเป็นข้อจำกัดที่ Risk Engine บังคับใช้จริง
      </p>
    </Panel>
  );
}

/** Section 12 — the human override switches. */
export function OverridePanel({
  active,
  onToggle,
}: {
  active: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const count = Object.values(active).filter(Boolean).length;

  return (
    <Panel
      title="ศูนย์สั่งการโดยมนุษย์"
      titleEn="Human Override Center"
      right={<Tag tone={count ? "warn" : "up"}>{count ? `บังคับใช้ ${count}` : "ไม่มีการแทรกแซง"}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-1"
    >
      {OVERRIDES.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onToggle(o.key)}
          className="flex items-center justify-between gap-2 rounded px-1 py-[4px] text-left hover:bg-[#0e1a24]"
        >
          <span className="min-w-0">
            <span
              className={`block truncate text-[10px] ${active[o.key] ? "text-warn" : "text-muted"}`}
            >
              {o.th}
            </span>
            <span className="block truncate text-[8.5px] text-dim">{o.effect}</span>
          </span>
          <span
            className={`relative h-[14px] w-[26px] shrink-0 rounded-full transition-colors ${
              active[o.key] ? "bg-warn/70" : "bg-[#1b2833]"
            }`}
          >
            <span
              className={`absolute top-[2px] size-[10px] rounded-full bg-white transition-all ${
                active[o.key] ? "left-[14px]" : "left-[2px]"
              }`}
            />
          </span>
        </button>
      ))}
      <p className="mt-1 text-[9px] leading-snug text-dim">
        แม้อยู่ในโหมดอัตโนมัติเต็มรูปแบบ ผู้ดูแลยังสั่งทับ AI ได้ทุกเมื่อ —
        ทุกการสั่งทับถูกบันทึกลง Mission Recorder เช่นกัน
      </p>
    </Panel>
  );
}

/** Sections 13 — the black box. */
export function MissionRecorder({ records }: { records: MissionRecord[] }) {
  return (
    <Panel
      title="กล่องดำบันทึกภารกิจ"
      titleEn="Mission Recorder"
      right={<Tag tone="neutral">{records.length} รายการ</Tag>}
      bodyClassName="p-0"
    >
      {records.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">
          กำลังเริ่มบันทึก — ทุกการตัดสินใจจะถูกเก็บพร้อมเหตุผลและผลลัพธ์
        </p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-[9px] uppercase tracking-wide text-dim">
                <th className="px-3 py-1.5 font-medium">เวลา</th>
                <th className="px-2 py-1.5 font-medium">ผู้ตัดสินใจ</th>
                <th className="px-2 py-1.5 font-medium">การกระทำ</th>
                <th className="px-2 py-1.5 text-right font-medium">มั่นใจ</th>
                <th className="px-3 py-1.5 font-medium">เหตุผล</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={`${r.at}-${i}`} className="border-t border-line-soft text-[10px]">
                  <td className="num px-3 py-[5px] text-dim">{bkkTime(new Date(r.at))}</td>
                  <td className="px-2 py-[5px] text-brand">{r.actor}</td>
                  <td className="px-2 py-[5px] text-txt">{r.action}</td>
                  <td className="num px-2 py-[5px] text-right text-muted">
                    {r.confidence ? `${r.confidence}%` : "—"}
                  </td>
                  <td className="px-3 py-[5px] text-muted">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        บันทึกอยู่ในเซสชันนี้เท่านั้น — ระบบจริงจะเก็บลงฐานข้อมูลเพื่อค้นย้อนหลังได้หลายปี
      </p>
    </Panel>
  );
}

/** Section 14 — the constitution and its live compliance. */
export function ConstitutionPanel({ articles }: { articles: Article[] }) {
  const passed = articles.filter((a) => a.pass).length;

  return (
    <Panel
      title="รัฐธรรมนูญของ AI"
      titleEn="AI Constitution & Governance"
      right={
        <Tag tone={passed === articles.length ? "up" : "down"}>
          ผ่าน {passed}/{articles.length}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {articles.map((a, i) => (
          <li key={a.id} className="flex items-start gap-2 px-3 py-[7px]">
            <span
              className={`mt-[2px] grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                a.pass ? "bg-up/20 text-up" : "bg-down/20 text-down"
              }`}
            >
              {a.pass ? "✓" : "✕"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10.5px] text-txt">
                <span className="text-dim">มาตรา {i + 1} · </span>
                {a.th}
              </span>
              <span className="block truncate text-[9px] text-dim">{a.evidence}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        กฎเหล่านี้อยู่เหนือทุกโมเดลในระบบ และถูกตรวจสอบกับสถานะจริงทุกครั้งที่หน้าอัปเดต —
        ไม่ใช่ข้อความประกาศ แต่เป็นผลการตรวจสอบ
      </p>
    </Panel>
  );
}

/** Section 9 — infrastructure health. */
export function HealthPanel({ rows }: { rows: HealthRow[] }) {
  const ok = rows.filter((r) => r.ok).length;

  return (
    <Panel
      title="สุขภาพระบบ"
      titleEn="System Health"
      right={
        <Tag tone={ok === rows.length ? "up" : "warn"}>
          {ok}/{rows.length} ปกติ
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-x-3 gap-y-1 sm:grid-cols-2"
    >
      {rows.map((r) => (
        <span key={r.en} className="flex items-center gap-1.5 text-[10px]">
          <span className={`size-1.5 shrink-0 rounded-full ${r.ok ? "bg-up dot-live" : "bg-down"}`} />
          <span className="min-w-0 flex-1 truncate text-muted">{r.th}</span>
          <span className={`num shrink-0 ${r.ok ? "text-up" : "text-down"}`}>{r.value}</span>
        </span>
      ))}
    </Panel>
  );
}

/** Section 1 — the global status strip. */
export function GlobalStatusStrip({
  cards,
}: {
  cards: { th: string; en: string; value: string; tone?: string }[];
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
        </div>
      ))}
    </div>
  );
}

/** Section 8 — the owner-level summary. */
export function OwnerRecommendation({
  lines,
}: {
  lines: { th: string; detail: string; tone: "up" | "down" | "warn" | "neutral" }[];
}) {
  return (
    <Panel
      title="สรุปให้เจ้าของระบบ"
      titleEn="AI Recommendation"
      right={<Tag tone="neutral">วันนี้</Tag>}
      bodyClassName="p-0"
    >
      <ul className="divide-y divide-line-soft">
        {lines.map((l) => (
          <li key={l.th} className="px-3 py-[7px]">
            <div className="flex items-center gap-1.5">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  l.tone === "up"
                    ? "bg-up"
                    : l.tone === "down"
                      ? "bg-down"
                      : l.tone === "warn"
                        ? "bg-warn"
                        : "bg-[#33505f]"
                }`}
              />
              <span className="text-[10.5px] font-semibold text-txt">{l.th}</span>
            </div>
            <p className="mt-0.5 text-[9.5px] leading-snug text-muted">{l.detail}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export { fmtNum, fmtPct };
