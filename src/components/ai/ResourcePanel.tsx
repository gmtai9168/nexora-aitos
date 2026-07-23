"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENTS, telemetry, type AgentStatus } from "@/lib/agents";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

function Bar({
  label,
  value,
  suffix = "%",
  max = 100,
  measured,
}: {
  label: string;
  value: number | null;
  suffix?: string;
  max?: number;
  measured?: boolean;
}) {
  const pct = value === null ? 0 : Math.min(100, (value / max) * 100);
  const tone = pct > 82 ? "#ff4a68" : pct > 58 ? "#ffb020" : "#14e2a0";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-1 text-[10px] text-muted">
          {label}
          {measured && <span className="text-[7.5px] text-up">LIVE</span>}
        </span>
        <span className="num text-[10.5px] font-semibold" style={{ color: tone }}>
          {value === null ? "—" : `${value.toFixed(0)}${suffix}`}
        </span>
      </div>
      <div className="mt-[3px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export function ResourcePanel({ statuses }: { statuses: Map<string, AgentStatus> }) {
  const { quotes, exchanges, connected } = useMarket();
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  // Our own round-trip is a real measurement; the rest of the rack is simulated.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const probe = async () => {
      const started = performance.now();
      try {
        await fetch("/api/quotes?symbols=BTCUSDT", { cache: "no-store" });
        if (!cancelled) setApiLatency(Math.round(performance.now() - started));
      } catch {
        if (!cancelled) setApiLatency(null);
      }
      if (!cancelled) timer = setTimeout(probe, 15000);
    };

    timer = setTimeout(probe, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Fleet load = the sum of each agent's cost, counted only while it is busy.
  const load = useMemo(() => {
    let cpu = 0;
    let gpu = 0;
    let ram = 0;
    let active = 0;

    for (const a of AGENTS) {
      const st = statuses.get(a.id) ?? "offline";
      if (st === "offline" || st === "paused") continue;
      const busy = st !== "online";
      const t = telemetry(a, a.symbol ? (quotes.get(a.symbol)?.changePct ?? null) : null);
      cpu += busy ? t.cpu : t.cpu * 0.25;
      gpu += busy ? t.gpu : t.gpu * 0.15;
      ram += t.ram;
      active++;
    }

    return {
      cpu: active ? cpu / active : 0,
      gpu: active ? gpu / active : 0,
      ramGb: ram / 1024,
      active,
    };
  }, [statuses, quotes]);

  const venueLatency = exchanges.filter((e) => e.online).map((e) => e.latency);
  const bestVenue = venueLatency.length ? Math.min(...venueLatency) : null;

  const services = [
    { name: "Database", ok: connected },
    { name: "Redis", ok: connected },
    { name: "Kafka", ok: connected },
    { name: "WebSocket", ok: connected },
    { name: "API Gateway", ok: apiLatency !== null },
  ];

  return (
    <Panel
      title="การใช้ทรัพยากร"
      titleEn="Resource Usage"
      right={<Tag tone="warn">บางค่าเป็นค่าจำลอง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2.5"
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Bar label="CPU เฉลี่ยต่อ AI" value={load.cpu} />
        <Bar label="GPU เฉลี่ยต่อ AI" value={load.gpu} />
        <Bar label="RAM รวม" value={load.ramGb} suffix=" GB" max={40} />
        <Bar
          label="Network / API"
          value={apiLatency}
          suffix=" ms"
          max={1200}
          measured
        />
        <Bar
          label="Exchange Latency"
          value={bestVenue}
          suffix=" ms"
          max={2000}
          measured
        />
        <Bar
          label="AI ที่ทำงานอยู่"
          value={load.active}
          suffix=""
          max={AGENTS.length}
        />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line-soft pt-2">
        {services.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-[10px]">
            <span
              className={`size-1.5 rounded-full ${s.ok ? "bg-up dot-live" : "bg-down"}`}
            />
            <span className="text-muted">{s.name}</span>
            <span className={`ml-auto ${s.ok ? "text-up" : "text-down"}`}>
              {s.ok ? "Healthy" : "Down"}
            </span>
          </span>
        ))}
      </div>
    </Panel>
  );
}
