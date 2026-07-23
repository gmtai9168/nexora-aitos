"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AGENTS,
  GROUPS,
  STATUS_META,
  TOTAL_AGENTS,
  fleetStatus,
  type AgentStatus,
} from "@/lib/agents";
import { useMarket } from "@/lib/market-context";
import { Panel } from "./Panel";

export function AINetworkPanel() {
  const { connected, regime, tick, emergencyStop } = useMarket();
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const live = connected && !emergencyStop;
  const statuses = useMemo(
    () => fleetStatus(live, regime.atr, tick),
    [live, regime.atr, tick],
  );

  const counts = useMemo(() => {
    const c: Record<AgentStatus, number> = {
      online: 0,
      thinking: 0,
      voting: 0,
      executing: 0,
      learning: 0,
      waiting: 0,
      paused: 0,
      offline: 0,
    };
    for (const s of statuses.values()) c[s]++;
    return c;
  }, [statuses]);

  const onlineCount = TOTAL_AGENTS - counts.offline - counts.paused;

  return (
    <Panel
      title="สถานะเครือข่าย AI"
      titleEn="AI Network"
      right={
        <Link href="/ai-network" className="text-[10px] text-brand hover:underline">
          ดูทั้งหมด
        </Link>
      }
      bodyClassName="p-2.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="size-[86px] -rotate-90">
            <circle cx="50" cy="50" r="42" stroke="#16242f" strokeWidth="8" fill="none" />
            <circle
              cx="50"
              cy="50"
              r="42"
              stroke={live ? "#10e08a" : "#ff4a68"}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${(onlineCount / TOTAL_AGENTS) * 264} 264`}
              style={{
                filter: `drop-shadow(0 0 6px ${live ? "rgba(16,224,138,0.6)" : "rgba(255,74,104,0.6)"})`,
              }}
            />
          </svg>
          <span className="absolute inset-0 grid place-content-center text-center leading-none">
            <span
              className={`num block text-[20px] font-extrabold ${live ? "text-up" : "text-down"}`}
            >
              {onlineCount}
            </span>
            <span className="mt-0.5 block text-[8px] text-dim">/ {TOTAL_AGENTS} ONLINE</span>
          </span>
        </div>

        <ul className="min-w-0 flex-1 space-y-[3px]">
          {(Object.keys(STATUS_META) as AgentStatus[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: STATUS_META[s].color }}
              />
              <span className="text-muted">{STATUS_META[s].th}</span>
              <span className="num ml-auto" style={{ color: STATUS_META[s].color }}>
                {counts[s]}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="space-y-[3px] border-t border-line-soft pt-2">
        {GROUPS.map((g) => {
          const members = AGENTS.filter((a) => a.group === g.key);
          const open = openGroup === g.key;
          return (
            <div key={g.key}>
              <button
                type="button"
                onClick={() => setOpenGroup(open ? null : g.key)}
                className="flex w-full items-center gap-2 rounded px-1 py-[3px] text-left hover:bg-[#0e1a24]"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: g.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted">
                  {g.th} <span className="text-[9px] text-dim">{g.en}</span>
                </span>
                <span className="flex shrink-0 gap-[2px]">
                  {members.map((m) => (
                    <span
                      key={m.id}
                      title={`${m.name} · ${STATUS_META[statuses.get(m.id) ?? "offline"].th}`}
                      className="size-[6px] rounded-[1px]"
                      style={{
                        background: STATUS_META[statuses.get(m.id) ?? "offline"].color,
                      }}
                    />
                  ))}
                </span>
                <span className="num w-4 shrink-0 text-right text-[10px] text-dim">
                  {g.count}
                </span>
              </button>

              {open && (
                <ul className="mb-1 ml-3.5 space-y-[2px] border-l border-line-soft pl-2">
                  {members.map((m) => {
                    const st = statuses.get(m.id) ?? "offline";
                    return (
                      <li key={m.id} className="flex items-center gap-1.5 text-[9.5px]">
                        <span
                          className="size-1 shrink-0 rounded-full"
                          style={{ background: STATUS_META[st].color }}
                        />
                        <span className="min-w-0 flex-1 truncate text-muted">{m.name}</span>
                        <span
                          className="shrink-0 text-[9px]"
                          style={{ color: STATUS_META[st].color }}
                        >
                          {STATUS_META[st].th}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
