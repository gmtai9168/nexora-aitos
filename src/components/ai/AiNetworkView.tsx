"use client";

import { useMemo, useState } from "react";
import {
  AGENTS,
  AGENT_BY_ID,
  GROUPS,
  fleetStatus,
  type AgentStatus,
} from "@/lib/agents";
import { useMarket } from "@/lib/market-context";
import { MasterDecision } from "../MasterDecision";
import { AgentDetails } from "./AgentDetails";
import { NetworkMap } from "./NetworkMap";
import { RankingPanel } from "./RankingPanel";
import { RelationshipGraph } from "./RelationshipGraph";
import { ResourcePanel } from "./ResourcePanel";
import { SummaryBar } from "./SummaryBar";
import { TimelinePanel } from "./TimelinePanel";
import { VotingPanel } from "./VotingPanel";

const EMPTY_COUNTS: Record<AgentStatus, number> = {
  online: 0,
  thinking: 0,
  voting: 0,
  executing: 0,
  learning: 0,
  waiting: 0,
  paused: 0,
  offline: 0,
};

export function AiNetworkView() {
  const { connected, regime, tick, emergencyStop } = useMarket();
  const [selected, setSelected] = useState<string | null>("smart-1");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [paused, setPaused] = useState<Set<string>>(new Set());

  const live = connected && !emergencyStop;
  const statuses = useMemo(
    () => fleetStatus(live, regime.atr, tick, paused),
    [live, regime.atr, tick, paused],
  );

  const counts = useMemo(() => {
    const c = { ...EMPTY_COUNTS };
    for (const s of statuses.values()) c[s]++;
    return c;
  }, [statuses]);

  // Non-matching agents stay on the map but fade out, so the shape of the
  // network never changes while you search.
  const dimmed = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !groupFilter) return new Set<string>();
    return new Set(
      AGENTS.filter((a) => {
        if (groupFilter && a.group !== groupFilter) return true;
        if (!q) return false;
        return !(
          a.name.toLowerCase().includes(q) ||
          a.nameTh.includes(query.trim()) ||
          a.group.includes(q)
        );
      }).map((a) => a.id),
    );
  }, [query, groupFilter]);

  const agent = selected ? (AGENT_BY_ID.get(selected) ?? null) : null;
  const status = selected ? (statuses.get(selected) ?? "offline") : "offline";

  const togglePause = () => {
    if (!selected) return;
    setPaused((prev) => {
      const next = new Set(prev);
      if (next.has(selected)) next.delete(selected);
      else next.add(selected);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-2.5">
      <SummaryBar
        counts={counts}
        query={query}
        onQuery={setQuery}
        groupFilter={groupFilter}
        onGroupFilter={setGroupFilter}
        groups={GROUPS}
      />

      {/* items-start so the map keeps its own height instead of stretching
          to match the right rail and leaving dead space inside the panel. */}
      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_336px]">
        <NetworkMap
          statuses={statuses}
          selected={selected}
          onSelect={setSelected}
          dimmed={dimmed}
        />

        <div className="flex min-w-0 flex-col gap-2.5">
          <AgentDetails
            agent={agent}
            status={status}
            paused={selected ? paused.has(selected) : false}
            onTogglePause={togglePause}
          />
          <MasterDecision />
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <TimelinePanel />
        <VotingPanel />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ResourcePanel statuses={statuses} />
        <RankingPanel onSelect={setSelected} selected={selected} />
      </div>

      <RelationshipGraph />
    </div>
  );
}
