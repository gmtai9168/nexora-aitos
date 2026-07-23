"use client";

import { STATUS_META, TOTAL_AGENTS, type AgentStatus } from "@/lib/agents";
import { IconSearch } from "../icons";

const SHOWN: AgentStatus[] = [
  "thinking",
  "voting",
  "executing",
  "learning",
  "waiting",
  "paused",
  "offline",
];

export function SummaryBar({
  counts,
  query,
  onQuery,
  groupFilter,
  onGroupFilter,
  groups,
}: {
  counts: Record<AgentStatus, number>;
  query: string;
  onQuery: (v: string) => void;
  groupFilter: string;
  onGroupFilter: (v: string) => void;
  groups: { key: string; th: string; en: string; count: number }[];
}) {
  const online = TOTAL_AGENTS - counts.offline - counts.paused;

  return (
    <section className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
      <div className="flex items-center gap-2.5">
        <span className="relative grid size-[42px] place-items-center">
          <svg viewBox="0 0 40 40" className="size-[42px] -rotate-90">
            <circle cx="20" cy="20" r="17" stroke="#16242f" strokeWidth="4" fill="none" />
            <circle
              cx="20"
              cy="20"
              r="17"
              stroke={online === TOTAL_AGENTS ? "#10e08a" : "#ffb020"}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(online / TOTAL_AGENTS) * 106.8} 106.8`}
              style={{ filter: "drop-shadow(0 0 5px rgba(16,224,138,0.5))" }}
            />
          </svg>
        </span>
        <span className="leading-tight">
          <span className="block text-[9px] tracking-wide text-dim">AI ONLINE</span>
          <span
            className={`num block text-[20px] font-extrabold ${
              online === TOTAL_AGENTS ? "text-up" : "text-warn"
            }`}
          >
            {online} / {TOTAL_AGENTS}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l border-line pl-4">
        {SHOWN.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="size-1.5 rounded-full"
              style={{ background: STATUS_META[s].color }}
            />
            <span className="text-[10px] text-dim">{STATUS_META[s].th}</span>
            <span
              className="num text-[13px] font-bold"
              style={{ color: STATUS_META[s].color }}
            >
              {counts[s]}
            </span>
          </span>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <label className="chip flex w-[190px] items-center gap-1.5 px-2 py-[5px]">
          <IconSearch size={13} className="shrink-0 text-dim" />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="ค้นหา AI…"
            className="w-full bg-transparent text-[11px] text-txt outline-none placeholder:text-dim"
          />
        </label>

        <select
          value={groupFilter}
          onChange={(e) => onGroupFilter(e.target.value)}
          className="chip px-2 py-[5px] text-[11px] text-txt outline-none"
        >
          <option value="">ทุกกลุ่ม ({TOTAL_AGENTS})</option>
          {groups.map((g) => (
            <option key={g.key} value={g.key}>
              {g.th} · {g.en} ({g.count})
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
