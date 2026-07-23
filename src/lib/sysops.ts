import { AGENTS, GROUPS } from "./agents";
import type { ExchangeHealth } from "./market-context";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

export type ServerHealth = {
  uptimeSec: number;
  node: string;
  platform: string;
  arch: string;
  cpuCores: number;
  cpuModel: string;
  loadAvg: number[] | null;
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  systemTotalMb: number;
  systemFreeMb: number;
  systemUsedPct: number;
  ts: number;
};

export const EMPTY_HEALTH: ServerHealth = {
  uptimeSec: 0,
  node: "—",
  platform: "—",
  arch: "—",
  cpuCores: 0,
  cpuModel: "—",
  loadAvg: null,
  heapUsedMb: 0,
  heapTotalMb: 0,
  rssMb: 0,
  externalMb: 0,
  systemTotalMb: 0,
  systemFreeMb: 0,
  systemUsedPct: 0,
  ts: 0,
};

/** The app's own API surface — every one of these is probed for real. */
export const API_ROUTES: { path: string; th: string }[] = [
  { path: "/api/quotes?symbols=BTCUSDT", th: "ราคาตลาด" },
  { path: "/api/candles?symbol=BTCUSDT&tf=1h&limit=5", th: "แท่งเทียน" },
  { path: "/api/microstructure?symbol=BTCUSDT", th: "สมุดคำสั่ง" },
  { path: "/api/context?symbol=BTCUSDT", th: "ข้อมูลฟิวเจอร์ส" },
  { path: "/api/exchanges", th: "สถานะ Exchange" },
  { path: "/api/onchain?symbol=BTCUSDT", th: "ข้อมูลออนเชน" },
  { path: "/api/news", th: "ข่าวสาร" },
  { path: "/api/health", th: "สุขภาพเซิร์ฟเวอร์" },
];

export type ApiProbe = {
  path: string;
  th: string;
  status: number;
  latency: number;
  ok: boolean;
};

export type NodeInfo = {
  id: string;
  name: string;
  region: string;
  role: string;
  agents: number;
  cpuPct: number;
  gpuPct: number;
  ramPct: number;
  online: boolean;
};

const REGIONS = ["Singapore SG-1", "Tokyo AP-1", "Frankfurt EU-1", "Virginia US-1"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/**
 * AI cluster layout.
 *
 * SIMULATED — a browser cannot see a datacenter. Node load is a stable
 * function of the node id plus the real fleet activity level, so it behaves
 * like a real cluster without pretending to be measured. The one real input is
 * `busyRatio`, which comes from how many agents are actually mid-computation.
 */
export function clusterNodes(busyRatio: number, online: boolean): NodeInfo[] {
  const podsPerNode = 2;
  const nodes: NodeInfo[] = [];

  for (let i = 0; i < Math.ceil(GROUPS.length / podsPerNode); i++) {
    const pods = GROUPS.slice(i * podsPerNode, i * podsPerNode + podsPerNode);
    const agents = pods.reduce((a, p) => a + p.count, 0);
    const seed = hash(`node-${i}`);
    const seed2 = hash(`node-${i}-b`);

    nodes.push({
      id: `AI-${String(i + 1).padStart(2, "0")}`,
      name: pods.map((p) => p.en).join(" + "),
      region: REGIONS[i % REGIONS.length],
      role: pods[0]?.en ?? "General",
      agents,
      cpuPct: online ? clamp(14 + seed * 26 + busyRatio * 34) : 0,
      gpuPct: online ? clamp(18 + seed2 * 32 + busyRatio * 40) : 0,
      ramPct: online ? clamp(26 + seed * 34) : 0,
      online,
    });
  }

  return nodes;
}

export type GpuInfo = { id: string; load: number; memPct: number; assigned: string };

export function gpuCluster(nodes: NodeInfo[]): GpuInfo[] {
  return nodes.map((n, i) => ({
    id: `GPU-${String(i + 1).padStart(2, "0")}`,
    load: n.gpuPct,
    memPct: clamp(n.ramPct * 0.9 + 8),
    assigned: n.name,
  }));
}

export type ModelPlacement = {
  agent: string;
  pod: string;
  node: string;
  device: string;
  color: string;
};

/** Which agent runs where — derived from the real pod registry. */
export function modelPlacement(nodes: NodeInfo[]): ModelPlacement[] {
  const byPod = new Map<string, { node: string; device: string }>();
  nodes.forEach((n, i) => {
    for (const pod of n.name.split(" + ")) {
      byPod.set(pod, {
        node: n.id,
        device: pod.includes("Execution") ? "CPU Cluster" : `GPU-${String(i + 1).padStart(2, "0")}`,
      });
    }
  });

  return AGENTS.slice(0, 12).map((a) => {
    const group = GROUPS.find((g) => g.key === a.group)!;
    const place = byPod.get(group.en) ?? { node: nodes[0]?.id ?? "AI-01", device: "CPU" };
    return {
      agent: a.name,
      pod: group.en,
      node: place.node,
      device: place.device,
      color: group.color,
    };
  });
}

export type InfraService = { th: string; en: string; ok: boolean; detail: string; measured: boolean };

/**
 * Infrastructure board. Services the app really talks to are measured; the
 * rest are marked as simulated so the two are never confused.
 */
export function infraServices(
  health: ServerHealth,
  probes: ApiProbe[],
  connected: boolean,
): InfraService[] {
  const apiOk = probes.length > 0 && probes.every((p) => p.ok);
  const heapPct = health.heapTotalMb ? (health.heapUsedMb / health.heapTotalMb) * 100 : 0;

  return [
    {
      th: "เซิร์ฟเวอร์แอปพลิเคชัน",
      en: "App Server",
      ok: health.uptimeSec > 0,
      detail: health.uptimeSec ? `Node ${health.node} · ทำงานมา ${Math.floor(health.uptimeSec / 60)} นาที` : "ไม่มีข้อมูล",
      measured: true,
    },
    {
      th: "หน่วยความจำของโปรเซส",
      en: "Process Memory",
      ok: heapPct < 90,
      detail: `Heap ${health.heapUsedMb}/${health.heapTotalMb} MB · RSS ${health.rssMb} MB`,
      measured: true,
    },
    {
      th: "หน่วยความจำระบบ",
      en: "System Memory",
      ok: health.systemUsedPct < 92,
      detail: `ใช้ไป ${health.systemUsedPct}% จาก ${(health.systemTotalMb / 1024).toFixed(1)} GB`,
      measured: true,
    },
    {
      th: "API Gateway",
      en: "API Gateway",
      ok: apiOk,
      detail: `${probes.filter((p) => p.ok).length}/${probes.length} เส้นทางตอบสนองปกติ`,
      measured: true,
    },
    {
      th: "ฟีดข้อมูลตลาด",
      en: "Market Feed",
      ok: connected,
      detail: connected ? "รับข้อมูลต่อเนื่อง" : "ขาดการเชื่อมต่อ",
      measured: true,
    },
    { th: "ฐานข้อมูล", en: "Database", ok: connected, detail: "จำลอง — ระบบสาธิตยังไม่ต่อฐานข้อมูล", measured: false },
    { th: "Redis / Cache", en: "Cache", ok: connected, detail: "จำลอง", measured: false },
    { th: "Kafka / Message Queue", en: "Queue", ok: connected, detail: "จำลอง", measured: false },
    { th: "WebSocket Gateway", en: "WebSocket", ok: connected, detail: "จำลอง — หน้านี้ใช้ REST polling", measured: false },
    { th: "CDN / Static", en: "CDN", ok: true, detail: "จำลอง", measured: false },
  ];
}

export type SecurityRow = { th: string; en: string; ok: boolean; detail: string; measured: boolean };

export function securityCentre(https: boolean, probes: ApiProbe[]): SecurityRow[] {
  return [
    {
      th: "ไม่มีการเก็บ API Key",
      en: "No Stored Credentials",
      ok: true,
      detail: "ระบบสาธิตไม่รับและไม่เก็บคีย์ของ exchange",
      measured: true,
    },
    {
      th: "การเชื่อมต่อเข้ารหัส",
      en: "TLS",
      ok: https,
      detail: https ? "ให้บริการผ่าน HTTPS" : "กำลังรันบน localhost (HTTP)",
      measured: true,
    },
    {
      th: "เส้นทาง API ตอบสนองปกติ",
      en: "Endpoint Integrity",
      ok: probes.every((p) => p.ok),
      detail: `${probes.filter((p) => p.ok).length}/${probes.length} เส้นทาง`,
      measured: true,
    },
    { th: "Firewall / WAF", en: "Firewall", ok: true, detail: "จำลอง", measured: false },
    { th: "ป้องกัน DDoS", en: "DDoS Protection", ok: true, detail: "จำลอง", measured: false },
    { th: "Secret Manager / Vault", en: "Vault", ok: true, detail: "จำลอง", measured: false },
    { th: "ยืนยันตัวตนสองชั้น", en: "2FA", ok: true, detail: "จำลอง", measured: false },
    { th: "บันทึกความปลอดภัย (SIEM)", en: "SIEM", ok: true, detail: "จำลอง", measured: false },
  ];
}

export type DeployStage = { th: string; en: string; pct: number; state: "done" | "active" | "wait" };

export function deployment(progress: number): DeployStage[] {
  const stages = [
    { th: "สร้างอิมเมจ", en: "Build" },
    { th: "ทดสอบอัตโนมัติ", en: "Test" },
    { th: "ปล่อยแบบ Canary", en: "Canary" },
    { th: "สลับ Blue-Green", en: "Blue-Green" },
    { th: "ขึ้น Production", en: "Production" },
  ];

  return stages.map((s, i) => {
    const start = (i / stages.length) * 100;
    const end = ((i + 1) / stages.length) * 100;
    const pct = clamp(((progress - start) / (end - start)) * 100);
    return {
      ...s,
      pct,
      state: pct >= 100 ? "done" : pct > 0 ? "active" : "wait",
    };
  });
}

export type Region = {
  name: string;
  role: "primary" | "standby" | "backup";
  roleTh: string;
  latencyMs: number | null;
  online: boolean;
};

/** DR topology — venue latency stands in for real inter-region measurement. */
export function regions(exchanges: ExchangeHealth[]): Region[] {
  const best = exchanges.filter((e) => e.online).map((e) => e.latency);
  const base = best.length ? Math.min(...best) : null;

  return [
    { name: "Singapore SG-1", role: "primary", roleTh: "ศูนย์หลัก", latencyMs: base, online: true },
    { name: "Tokyo AP-1", role: "standby", roleTh: "สำรองพร้อมใช้", latencyMs: base ? base + 38 : null, online: true },
    { name: "Frankfurt EU-1", role: "standby", roleTh: "สำรองพร้อมใช้", latencyMs: base ? base + 165 : null, online: true },
    { name: "Virginia US-1", role: "backup", roleTh: "สำรองข้อมูล", latencyMs: base ? base + 210 : null, online: true },
  ];
}

export type CostRow = { th: string; en: string; monthly: number; note: string };

/**
 * Cost model driven by the traffic this app actually generates: every panel
 * polls on a known cadence, so the request volume is countable rather than
 * guessed.
 */
export function costModel(requestsPerMin: number, nodes: NodeInfo[]): CostRow[] {
  const monthlyRequests = requestsPerMin * 60 * 24 * 30;
  const gpuHours = nodes.length * 24 * 30;

  return [
    { th: "GPU (อนุมานโมเดล)", en: "GPU", monthly: gpuHours * 0.42, note: `${nodes.length} โหนด × 24 ชม.` },
    { th: "CPU / คอนเทนเนอร์", en: "Compute", monthly: nodes.length * 96, note: `${nodes.length} โหนด` },
    { th: "ฐานข้อมูล", en: "Database", monthly: 480, note: "คลัสเตอร์ 3 โหนด" },
    { th: "แบนด์วิดท์", en: "Bandwidth", monthly: (monthlyRequests / 1e6) * 42, note: `${(monthlyRequests / 1e6).toFixed(2)}M คำขอ/เดือน` },
    { th: "พื้นที่จัดเก็บ", en: "Storage", monthly: 210, note: "ข้อมูลย้อนหลังและบันทึก" },
    { th: "ฟีดข่าวและออนเชน", en: "Data Feeds", monthly: 0, note: "ใช้ public API ที่ไม่มีค่าใช้จ่าย" },
  ];
}

export type TwinScenario = {
  key: string;
  th: string;
  agentsDelta: number;
  usersDelta: number;
};

export type TwinOutcome = {
  scenario: TwinScenario;
  agents: number;
  requestsPerMin: number;
  nodesNeeded: number;
  nodesAvailable: number;
  headroomPct: number;
  projectedLatency: number;
  verdictTh: string;
  ok: boolean;
};

export const TWIN_SCENARIOS: TwinScenario[] = [
  { key: "now", th: "โหลดปัจจุบัน", agentsDelta: 0, usersDelta: 0 },
  { key: "agents30", th: "เพิ่ม AI อีก 30 ตัว", agentsDelta: 30, usersDelta: 0 },
  { key: "users10k", th: "ผู้ใช้พร้อมกัน 10,000 คน", agentsDelta: 0, usersDelta: 10000 },
  { key: "both", th: "เพิ่ม AI 30 ตัว + ผู้ใช้ 10,000 คน", agentsDelta: 30, usersDelta: 10000 },
];

/**
 * System Digital Twin.
 *
 * Capacity is projected from the measured cost of one request: the real API
 * latency observed on this machine, scaled by how many concurrent users and
 * agents the scenario adds. It answers "would we survive this" with arithmetic
 * rather than a guess.
 */
export function capacityTwin(
  scenario: TwinScenario,
  baseAgents: number,
  baseRequestsPerMin: number,
  measuredLatencyMs: number | null,
  nodes: NodeInfo[],
): TwinOutcome {
  const agents = baseAgents + scenario.agentsDelta;
  // Each concurrent user adds roughly one dashboard poll every 6 seconds.
  const userLoad = scenario.usersDelta * 10;
  const requestsPerMin = baseRequestsPerMin * (agents / Math.max(baseAgents, 1)) + userLoad;

  const latency = measuredLatencyMs ?? 250;
  // One node handles as many requests/min as its latency allows, at 60% target.
  const perNodeCapacity = Math.max(60, (60_000 / latency) * 0.6 * 60);
  const nodesNeeded = Math.ceil(requestsPerMin / perNodeCapacity);
  const nodesAvailable = nodes.length;
  const headroomPct = ((nodesAvailable - nodesNeeded) / Math.max(nodesAvailable, 1)) * 100;

  // Latency degrades once demand passes available capacity.
  const overload = Math.max(1, nodesNeeded / Math.max(nodesAvailable, 1));
  const projectedLatency = latency * overload;

  const ok = nodesNeeded <= nodesAvailable;

  return {
    scenario,
    agents,
    requestsPerMin,
    nodesNeeded,
    nodesAvailable,
    headroomPct,
    projectedLatency,
    verdictTh: ok
      ? `รองรับได้ · เหลือกำลังสำรอง ${headroomPct.toFixed(0)}%`
      : `ต้องเพิ่มอีก ${nodesNeeded - nodesAvailable} โหนด มิฉะนั้นความหน่วงจะขึ้นเป็น ${projectedLatency.toFixed(0)} ms`,
    ok,
  };
}

export type CtoAdvice = { th: string; reason: string; priority: "สูง" | "กลาง" | "ต่ำ" };

/** The AI-CTO's backlog, driven by measured conditions. */
export function ctoAdvice(
  health: ServerHealth,
  probes: ApiProbe[],
  twin: TwinOutcome[],
  costs: CostRow[],
  exchanges: ExchangeHealth[],
): CtoAdvice[] {
  const out: CtoAdvice[] = [];
  const heapPct = health.heapTotalMb ? (health.heapUsedMb / health.heapTotalMb) * 100 : 0;
  const slow = probes.filter((p) => p.latency > 1200);
  const failing = probes.filter((p) => !p.ok);
  const down = exchanges.filter((e) => !e.online);
  const tight = twin.filter((t) => !t.ok);

  if (failing.length > 0) {
    out.push({
      th: `แก้ไขเส้นทาง API ที่ล้มเหลว ${failing.length} เส้นทาง`,
      reason: failing.map((f) => `${f.th} (${f.status || "timeout"})`).join(" · "),
      priority: "สูง",
    });
  }

  if (slow.length > 0) {
    out.push({
      th: "เพิ่มแคชให้เส้นทางที่ตอบช้า",
      reason: `${slow.map((s) => `${s.th} ${s.latency}ms`).join(" · ")} — เกินเกณฑ์ 1200 ms`,
      priority: "กลาง",
    });
  }

  if (heapPct > 75) {
    out.push({
      th: "ตรวจสอบการใช้หน่วยความจำของโปรเซส",
      reason: `Heap ใช้ไป ${heapPct.toFixed(0)}% (${health.heapUsedMb}/${health.heapTotalMb} MB)`,
      priority: "สูง",
    });
  }

  if (down.length > 0) {
    out.push({
      th: `กำหนดเส้นทางสำรองสำหรับ ${down.map((d) => d.name).join(", ")}`,
      reason: "venue เหล่านี้เชื่อมต่อไม่ได้จากเครือข่ายปัจจุบัน",
      priority: "กลาง",
    });
  }

  if (tight.length > 0) {
    out.push({
      th: "วางแผนขยายคลัสเตอร์ล่วงหน้า",
      reason: `สถานการณ์ "${tight[0].scenario.th}" ต้องใช้ ${tight[0].nodesNeeded} โหนด แต่มีอยู่ ${tight[0].nodesAvailable}`,
      priority: "สูง",
    });
  }

  const biggest = [...costs].sort((a, b) => b.monthly - a.monthly)[0];
  if (biggest) {
    out.push({
      th: `ทบทวนต้นทุนก้อนใหญ่ที่สุด: ${biggest.th}`,
      reason: `คิดเป็น ${(
        (biggest.monthly / costs.reduce((a, c) => a + c.monthly, 0)) * 100
      ).toFixed(0)}% ของค่าใช้จ่ายรวมต่อเดือน`,
      priority: "กลาง",
    });
  }

  if (out.length === 0) {
    out.push({
      th: "ไม่มีงานด้านโครงสร้างพื้นฐานเร่งด่วน",
      reason: "ทุกเส้นทาง API ตอบสนองปกติและกำลังสำรองยังเพียงพอ",
      priority: "ต่ำ",
    });
  }

  return out;
}
