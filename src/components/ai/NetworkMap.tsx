"use client";

import { useMemo } from "react";
import { STATUS_META, type AgentStatus } from "@/lib/agents";
import { CX, CY, HUB_R, MAP_H, MAP_W, buildLayout } from "@/lib/ai-layout";
import { Panel } from "../Panel";

const LAYOUT = buildLayout();

/** "Reinforcement Learning AI" → "Reinforcement" — node labels must stay short. */
function shortName(name: string) {
  const base = name.replace(/\s*AI$/, "");
  return base.length > 15 ? `${base.slice(0, 14)}…` : base;
}

export function NetworkMap({
  statuses,
  selected,
  onSelect,
  dimmed,
}: {
  statuses: Map<string, AgentStatus>;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Ids filtered out by search — drawn faint rather than removed. */
  dimmed: Set<string>;
}) {
  const all = useMemo(() => [...LAYOUT.nodes, ...LAYOUT.hub], []);
  const anyLive = [...statuses.values()].some((s) => s !== "offline" && s !== "paused");

  return (
    <Panel
      title="แผนผังเครือข่าย AI"
      titleEn="AI Network Map"
      right={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {(
            ["online", "thinking", "voting", "executing", "learning", "offline"] as AgentStatus[]
          ).map((s) => (
            <span key={s} className="flex items-center gap-1 text-[9px]">
              <span
                className="size-1.5 rounded-full"
                style={{ background: STATUS_META[s].color }}
              />
              <span className="text-dim">{STATUS_META[s].th}</span>
            </span>
          ))}
        </span>
      }
      bodyClassName="p-1"
    >
      <svg
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        role="group"
        aria-label="แผนผังเครือข่าย AI 50 ตัว"
      >
        <defs>
          <radialGradient id="hub-glow">
            <stop offset="0%" stopColor="#00d4ff" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#00d4ff" stopOpacity="0.06" />
            <stop offset="100%" stopColor="#00d4ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Orbit rings */}
        {[236, 322].map((r) => (
          <circle
            key={r}
            cx={CX}
            cy={CY}
            r={r}
            fill="none"
            stroke="#12202a"
            strokeWidth="1"
          />
        ))}

        {/* Spokes from the hub out to every agent */}
        {all.map((n) => {
          const st = statuses.get(n.agent.id) ?? "offline";
          const busy = st === "thinking" || st === "voting" || st === "executing";
          return (
            <line
              key={`l-${n.agent.id}`}
              x1={CX}
              y1={CY}
              x2={n.x}
              y2={n.y}
              stroke={n.color}
              strokeOpacity={dimmed.has(n.agent.id) ? 0.05 : busy ? 0.4 : 0.13}
              strokeWidth="1"
              className={busy && anyLive ? "flow-line" : undefined}
            />
          );
        })}

        {/* Pod labels on the outside */}
        {LAYOUT.labels.map((l) => (
          <text
            key={l.key}
            x={l.x}
            y={l.y}
            textAnchor={l.anchor}
            fill={l.color}
            fontSize="12.5"
            fontWeight="700"
            letterSpacing="1.2"
          >
            {l.en.toUpperCase()}
          </text>
        ))}

        {/* Hub */}
        <circle cx={CX} cy={CY} r={HUB_R * 2.6} fill="url(#hub-glow)" />
        <circle
          cx={CX}
          cy={CY}
          r={HUB_R}
          fill="#04141c"
          stroke="#00d4ff"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 10px rgba(0,212,255,0.6))" }}
        />
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          fill="#00d4ff"
          fontSize="15"
          fontWeight="800"
        >
          MASTER
        </text>
        <text x={CX} y={CY + 13} textAnchor="middle" fill="#6b8497" fontSize="9.5">
          Central Hub
        </text>

        {/* Agents */}
        {all.map((n) => {
          const st = statuses.get(n.agent.id) ?? "offline";
          const meta = STATUS_META[st];
          const isSel = selected === n.agent.id;
          const faded = dimmed.has(n.agent.id);
          const busy = st === "thinking" || st === "voting" || st === "executing";

          return (
            <g
              key={n.agent.id}
              onClick={() => onSelect(n.agent.id)}
              style={{ cursor: "pointer", opacity: faded ? 0.16 : 1 }}
              role="button"
              aria-label={`${n.agent.name} · ${meta.th}`}
            >
              <title>{`${n.agent.name} (${n.agent.nameTh}) · ${meta.th}`}</title>

              {isSel && (
                <circle cx={n.x} cy={n.y} r="27" fill="none" stroke="#00d4ff" strokeWidth="1.5" />
              )}
              <circle
                cx={n.x}
                cy={n.y}
                r="19"
                fill="#08131b"
                stroke={meta.color}
                strokeWidth={isSel ? 2.4 : 1.6}
                style={
                  busy
                    ? { filter: `drop-shadow(0 0 5px ${meta.color}aa)` }
                    : undefined
                }
              />
              <circle cx={n.x} cy={n.y} r="6" fill={meta.color} opacity={busy ? 1 : 0.75} />
              <text
                x={n.x}
                /* Inner-arc labels sit above the node, outer-arc below, so
                   neighbouring pods never write over each other. */
                y={n.ring === 1 ? n.y - 26 : n.y + 33}
                textAnchor="middle"
                fill={isSel ? "#d5e2ee" : "#6b8497"}
                fontSize="9"
              >
                {shortName(n.agent.name)}
              </text>
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
