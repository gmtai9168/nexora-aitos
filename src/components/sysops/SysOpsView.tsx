"use client";

import { useEffect, useMemo, useState } from "react";
import { fleetStatus, TOTAL_AGENTS } from "@/lib/agents";
import { fmtNum } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import {
  API_ROUTES,
  EMPTY_HEALTH,
  capacityTwin,
  clusterNodes,
  costModel,
  ctoAdvice,
  deployment,
  gpuCluster,
  infraServices,
  modelPlacement,
  regions,
  securityCentre,
  TWIN_SCENARIOS,
  type ApiProbe,
  type ServerHealth,
} from "@/lib/sysops";
import {
  ApiMonitorPanel,
  CapacityPanel,
  ClusterPanel,
  CostPanel,
  DeployPanel,
  GatewayPanel,
  InfraPanel,
  PlacementPanel,
  ServerHealthPanel,
} from "./SysOpsPanels";

/** Roughly how many API calls the whole dashboard issues per minute. */
const BASE_REQUESTS_PER_MIN = 42;

export function SysOpsView() {
  const { exchanges, connected, regime, tick, emergencyStop } = useMarket();

  const [health, setHealth] = useState<ServerHealth>(EMPTY_HEALTH);
  const [probes, setProbes] = useState<ApiProbe[]>([]);
  const [deployProgress, setDeployProgress] = useState(62);
  const [twinKey, setTwinKey] = useState(TWIN_SCENARIOS[0].key);

  // Real server telemetry.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data: ServerHealth = await res.json();
        if (!cancelled) setHealth(data);
      } catch {
        /* keep the last reading */
      }
      if (!cancelled) timer = setTimeout(load, 10000);
    };
    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  // Probe every endpoint the app owns, one round at a time.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const round = async () => {
      const results: ApiProbe[] = [];
      for (const route of API_ROUTES) {
        const started = performance.now();
        try {
          const res = await fetch(route.path, { cache: "no-store" });
          results.push({
            path: route.path,
            th: route.th,
            status: res.status,
            latency: Math.round(performance.now() - started),
            ok: res.ok,
          });
        } catch {
          results.push({
            path: route.path,
            th: route.th,
            status: 0,
            latency: Math.round(performance.now() - started),
            ok: false,
          });
        }
        if (cancelled) return;
      }
      if (!cancelled) setProbes(results);
      if (!cancelled) timer = setTimeout(round, 45000);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(round, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

  const online = connected && !emergencyStop;

  const fleet = useMemo(
    () => fleetStatus(online, regime.atr, tick),
    [online, regime.atr, tick],
  );
  const busyRatio = useMemo(() => {
    const busy = [...fleet.values()].filter(
      (s) => s === "thinking" || s === "voting" || s === "executing" || s === "learning",
    ).length;
    return busy / TOTAL_AGENTS;
  }, [fleet]);

  const nodes = useMemo(() => clusterNodes(busyRatio, online), [busyRatio, online]);
  const gpus = useMemo(() => gpuCluster(nodes), [nodes]);
  const placement = useMemo(() => modelPlacement(nodes), [nodes]);
  const services = useMemo(
    () => infraServices(health, probes, connected),
    [health, probes, connected],
  );
  const security = useMemo(() => {
    const https = typeof window !== "undefined" && window.location.protocol === "https:";
    return securityCentre(https, probes);
  }, [probes]);

  const stages = useMemo(() => deployment(deployProgress), [deployProgress]);
  const regionRows = useMemo(() => regions(exchanges), [exchanges]);

  const avgLatency = probes.length
    ? probes.reduce((a, p) => a + p.latency, 0) / probes.length
    : null;

  const costs = useMemo(
    () => costModel(BASE_REQUESTS_PER_MIN, nodes),
    [nodes],
  );

  const twin = useMemo(
    () =>
      TWIN_SCENARIOS.map((s) =>
        capacityTwin(s, TOTAL_AGENTS, BASE_REQUESTS_PER_MIN, avgLatency, nodes),
      ),
    [avgLatency, nodes],
  );

  const advice = useMemo(
    () => ctoAdvice(health, probes, twin, costs, exchanges),
    [health, probes, twin, costs, exchanges],
  );

  const heapPct = health.heapTotalMb ? (health.heapUsedMb / health.heapTotalMb) * 100 : 0;
  const okProbes = probes.filter((p) => p.ok).length;
  const avgGpu = nodes.length
    ? nodes.reduce((a, n) => a + n.gpuPct, 0) / nodes.length
    : 0;

  const cards = [
    {
      th: "สถานะระบบ",
      en: "System",
      value: emergencyStop ? "HALTED" : connected ? "ONLINE" : "DEGRADED",
      tone: emergencyStop ? "text-down" : connected ? "text-up" : "text-warn",
    },
    { th: "CPU เซิร์ฟเวอร์", en: "Cores", value: `${health.cpuCores || "—"}`, tone: "text-txt" },
    {
      th: "หน่วยความจำโปรเซส",
      en: "Heap",
      value: `${heapPct.toFixed(0)}%`,
      tone: heapPct > 85 ? "text-down" : "text-up",
    },
    {
      th: "หน่วยความจำระบบ",
      en: "System RAM",
      value: `${health.systemUsedPct || 0}%`,
      tone: health.systemUsedPct > 90 ? "text-down" : "text-up",
    },
    {
      th: "เส้นทาง API ปกติ",
      en: "API",
      value: probes.length ? `${okProbes}/${probes.length}` : "—",
      tone: probes.length && okProbes === probes.length ? "text-up" : "text-warn",
    },
    {
      th: "ความหน่วงเฉลี่ย",
      en: "Latency",
      value: avgLatency !== null ? `${avgLatency.toFixed(0)} ms` : "—",
      tone: avgLatency !== null && avgLatency < 800 ? "text-up" : "text-warn",
    },
    {
      th: "โหลด GPU เฉลี่ย",
      en: "GPU",
      value: `${avgGpu.toFixed(0)}%`,
    },
    {
      th: "AI ที่ทำงานอยู่",
      en: "Agents",
      value: `${online ? TOTAL_AGENTS : 0}/${TOTAL_AGENTS}`,
      tone: online ? "text-up" : "text-down",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
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

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <ServerHealthPanel health={health} />
        <ApiMonitorPanel probes={probes} />
      </div>

      <ClusterPanel nodes={nodes} gpus={gpus} />

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <PlacementPanel rows={placement} />
        <InfraPanel services={services} security={security} />
      </div>

      <GatewayPanel
        venues={exchanges.map((e) => ({
          name: e.name,
          online: e.online,
          latency: e.latency,
        }))}
        regionRows={regionRows}
      />

      <div className="grid gap-2.5 xl:grid-cols-2">
        <DeployPanel
          stages={stages}
          progress={deployProgress}
          onProgress={setDeployProgress}
        />
        <CapacityPanel outcomes={twin} selected={twinKey} onSelect={setTwinKey} />
      </div>

      <CostPanel costs={costs} advice={advice} />

      <p className="panel px-3 py-2 text-[9.5px] leading-relaxed text-dim">
        <span className="text-brand">หมายเหตุความโปร่งใส:</span>{" "}
        <span className="text-muted">
          ค่าที่วัดได้จริงคือ telemetry ของโปรเซส Node ที่ให้บริการหน้านี้ (uptime, heap, RSS,
          จำนวนคอร์, หน่วยความจำระบบ), การยิงทดสอบเส้นทาง API ทั้ง {API_ROUTES.length} เส้นทาง
          พร้อมจับเวลาไป-กลับ, ความหน่วงของ exchange และการคำนวณกำลังรองรับใน Digital Twin
        </span>{" "}
        · ส่วน GPU, คลัสเตอร์หลายภูมิภาค, ฐานข้อมูล, Kafka และระบบความปลอดภัยระดับองค์กร
        เป็นค่าจำลองที่ติดป้ายไว้ชัดเจน เพราะเบราว์เซอร์มองไม่เห็นดาต้าเซ็นเตอร์ ·
        ต้นทุนคำนวณจากปริมาณคำขอจริงที่แดชบอร์ดสร้าง ({fmtNum(BASE_REQUESTS_PER_MIN, 0)} คำขอ/นาที)
      </p>
    </div>
  );
}
