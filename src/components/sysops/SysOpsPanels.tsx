"use client";

import { fmtNum } from "@/lib/format";
import type {
  ApiProbe,
  CostRow,
  CtoAdvice,
  DeployStage,
  GpuInfo,
  InfraService,
  ModelPlacement,
  NodeInfo,
  Region,
  SecurityRow,
  ServerHealth,
  TwinOutcome,
} from "@/lib/sysops";
import { Panel, Tag } from "../Panel";
import { RingGauge } from "../viz";

const loadColor = (v: number) => (v >= 85 ? "#ff4a68" : v >= 60 ? "#ffb020" : "#14e2a0");

function Bar({ value }: { value: number }) {
  return (
    <span className="h-[4px] w-full overflow-hidden rounded-full bg-[#16242f]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.min(100, value)}%`, background: loadColor(value) }}
      />
    </span>
  );
}

/** Section 1 — the real server telemetry, marked LIVE. */
export function ServerHealthPanel({ health }: { health: ServerHealth }) {
  const heapPct = health.heapTotalMb ? (health.heapUsedMb / health.heapTotalMb) * 100 : 0;
  const hours = Math.floor(health.uptimeSec / 3600);
  const mins = Math.floor((health.uptimeSec % 3600) / 60);

  const rows: [string, string, boolean?][] = [
    ["Node.js", health.node, true],
    ["ระบบปฏิบัติการ", `${health.platform} (${health.arch})`, true],
    ["CPU", `${health.cpuCores} คอร์`, true],
    ["รุ่น CPU", health.cpuModel, true],
    ["เวลาทำงาน Uptime", health.uptimeSec ? `${hours} ชม. ${mins} นาที` : "—", true],
    [
      "Load Average",
      health.loadAvg ? health.loadAvg.join(" / ") : "ไม่มี (Windows)",
      health.loadAvg !== null,
    ],
    ["Heap ที่ใช้", `${health.heapUsedMb} / ${health.heapTotalMb} MB`, true],
    ["RSS", `${health.rssMb} MB`, true],
    [
      "หน่วยความจำระบบ",
      `${health.systemUsedPct}% จาก ${(health.systemTotalMb / 1024).toFixed(1)} GB`,
      true,
    ],
  ];

  return (
    <Panel
      title="สุขภาพเซิร์ฟเวอร์จริง"
      titleEn="Server Telemetry"
      right={<Tag tone="up">LIVE · วัดจริงจาก Node</Tag>}
      bodyClassName="p-2.5 flex items-center gap-3"
    >
      <div className="shrink-0">
        <RingGauge
          value={heapPct}
          size={112}
          label={`${heapPct.toFixed(0)}%`}
          sub="Heap Usage"
          color={loadColor(heapPct)}
        />
      </div>
      <div className="min-w-0 flex-1">
        {rows.map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-2 border-b border-line-soft py-[3.5px] text-[10px] last:border-0"
          >
            <span className="shrink-0 text-dim">{k}</span>
            <span className="num truncate text-txt">{v}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Section 7 — every one of the app's own endpoints, actually probed. */
export function ApiMonitorPanel({ probes }: { probes: ApiProbe[] }) {
  const ok = probes.filter((p) => p.ok).length;

  return (
    <Panel
      title="ตรวจสอบ API ของระบบ"
      titleEn="API Monitor"
      right={
        <Tag tone={ok === probes.length && probes.length > 0 ? "up" : "down"}>
          {probes.length ? `${ok}/${probes.length} ปกติ` : "กำลังตรวจ…"}
        </Tag>
      }
      bodyClassName="p-0"
    >
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[9px] uppercase tracking-wide text-dim">
            <th className="px-3 py-1.5 font-medium">เส้นทาง</th>
            <th className="px-2 py-1.5 text-right font-medium">สถานะ</th>
            <th className="px-2 py-1.5 text-right font-medium">ความหน่วง</th>
            <th className="px-3 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {probes.map((p) => (
            <tr key={p.path} className="border-t border-line-soft text-[10.5px]">
              <td className="px-3 py-[5px]">
                <span className="block truncate">{p.th}</span>
                <span className="num block truncate text-[8.5px] text-dim">{p.path}</span>
              </td>
              <td className={`num px-2 py-[5px] text-right ${p.ok ? "text-up" : "text-down"}`}>
                {p.status || "timeout"}
              </td>
              <td
                className={`num px-2 py-[5px] text-right ${
                  p.latency > 1200 ? "text-warn" : "text-muted"
                }`}
              >
                {p.latency} ms
              </td>
              <td className="px-3 py-[5px] text-right">
                <Tag tone={p.ok ? "up" : "down"}>{p.ok ? "OK" : "FAIL"}</Tag>
              </td>
            </tr>
          ))}
          {probes.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-[11px] text-dim">
                กำลังตรวจสอบเส้นทาง API…
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        ทุกแถวคือการยิงคำขอจริงจากเบราว์เซอร์ไปยัง API ของแอปนี้ พร้อมจับเวลาไป-กลับ
      </p>
    </Panel>
  );
}

/** Sections 2 + 3 — the cluster and its accelerators. */
export function ClusterPanel({ nodes, gpus }: { nodes: NodeInfo[]; gpus: GpuInfo[] }) {
  return (
    <Panel
      title="คลัสเตอร์ AI และการ์ดประมวลผล"
      titleEn="AI Cluster & GPU"
      right={<Tag tone="warn">TELEMETRY จำลอง</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">โหนด</th>
              <th className="px-2 py-1.5 font-medium">ภูมิภาค</th>
              <th className="px-2 py-1.5 text-right font-medium">AI</th>
              <th className="px-2 py-1.5 font-medium">CPU</th>
              <th className="px-2 py-1.5 font-medium">GPU</th>
              <th className="px-2 py-1.5 font-medium">RAM</th>
              <th className="px-3 py-1.5 font-medium">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n, i) => (
              <tr key={n.id} className="border-t border-line-soft text-[10.5px]">
                <td className="px-3 py-[6px]">
                  <span className="block font-semibold">{n.id}</span>
                  <span className="block truncate text-[8.5px] text-dim">{n.name}</span>
                </td>
                <td className="px-2 py-[6px] text-[9.5px] text-dim">{n.region}</td>
                <td className="num px-2 py-[6px] text-right text-muted">{n.agents}</td>
                <td className="px-2 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <Bar value={n.cpuPct} />
                    <span className="num w-8 shrink-0 text-right text-[9.5px]">
                      {n.cpuPct.toFixed(0)}%
                    </span>
                  </span>
                </td>
                <td className="px-2 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <Bar value={n.gpuPct} />
                    <span className="num w-8 shrink-0 text-right text-[9.5px]">
                      {gpus[i]?.load.toFixed(0) ?? "—"}%
                    </span>
                  </span>
                </td>
                <td className="px-2 py-[6px]">
                  <span className="flex items-center gap-1.5">
                    <Bar value={n.ramPct} />
                    <span className="num w-8 shrink-0 text-right text-[9.5px]">
                      {n.ramPct.toFixed(0)}%
                    </span>
                  </span>
                </td>
                <td className="px-3 py-[6px]">
                  <Tag tone={n.online ? "up" : "down"}>{n.online ? "ออนไลน์" : "ออฟไลน์"}</Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] leading-snug text-dim">
        ค่าโหลดของโหนดเป็นค่าจำลองที่ผูกกับรหัสโหนด (คงที่ ไม่สุ่มใหม่) แต่ปรับขึ้นลงตาม
        <span className="text-muted"> สัดส่วน AI ที่กำลังประมวลผลจริง</span> —
        เบราว์เซอร์มองเห็นดาต้าเซ็นเตอร์ไม่ได้ จึงไม่แสร้งว่าวัดได้
      </p>
    </Panel>
  );
}

/** Section 4 — model placement. */
export function PlacementPanel({ rows }: { rows: ModelPlacement[] }) {
  return (
    <Panel
      title="ตำแหน่งของโมเดล AI"
      titleEn="AI Model Placement"
      right={<Tag tone="neutral">{rows.length} โมเดลแรก</Tag>}
      bodyClassName="p-0"
    >
      <ul className="max-h-[280px] divide-y divide-line-soft overflow-y-auto">
        {rows.map((r) => (
          <li key={r.agent} className="flex items-center gap-2 px-3 py-[5px] text-[10.5px]">
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: r.color }} />
            <span className="min-w-0 flex-1 truncate">{r.agent}</span>
            <span className="w-[92px] shrink-0 truncate text-[9px] text-dim">{r.pod}</span>
            <span className="num w-[48px] shrink-0 text-right text-muted">{r.node}</span>
            <span className="num w-[72px] shrink-0 text-right text-[9.5px] text-brand">
              {r.device}
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Sections 6 + 8 — infrastructure and security, with measured vs simulated split. */
export function InfraPanel({
  services,
  security,
}: {
  services: InfraService[];
  security: SecurityRow[];
}) {
  const render = (rows: (InfraService | SecurityRow)[]) =>
    rows.map((r) => (
      <li key={r.en} className="flex items-start gap-2 py-[4px]">
        <span
          className={`mt-1 size-1.5 shrink-0 rounded-full ${
            r.ok ? (r.measured ? "bg-up dot-live" : "bg-up/50") : "bg-down"
          }`}
        />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[10px] text-muted">{r.th}</span>
            {r.measured ? (
              <span className="shrink-0 text-[7.5px] text-up">LIVE</span>
            ) : (
              <span className="shrink-0 text-[7.5px] text-dim">จำลอง</span>
            )}
          </span>
          <span className="block truncate text-[8.5px] text-dim">{r.detail}</span>
        </span>
      </li>
    ));

  return (
    <Panel
      title="โครงสร้างพื้นฐานและความปลอดภัย"
      titleEn="Infrastructure & Security"
      right={
        <Tag tone="up">
          วัดจริง {[...services, ...security].filter((r) => r.measured).length} รายการ
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">บริการพื้นฐาน</div>
        <ul>{render(services)}</ul>
      </div>
      <div>
        <div className="mb-1 text-[9.5px] text-dim">ศูนย์ความปลอดภัย</div>
        <ul>{render(security)}</ul>
      </div>
    </Panel>
  );
}

/** Sections 5 + 10 — gateways and disaster recovery. */
export function GatewayPanel({
  venues,
  regionRows,
}: {
  venues: { name: string; online: boolean; latency: number }[];
  regionRows: Region[];
}) {
  return (
    <Panel
      title="เกตเวย์ Exchange และการกู้คืนระบบ"
      titleEn="Gateway & Disaster Recovery"
      right={
        <Tag tone={venues.every((v) => v.online) ? "up" : "warn"}>
          {venues.filter((v) => v.online).length}/{venues.length} เชื่อมต่อได้
        </Tag>
      }
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">เกตเวย์ Exchange · วัดจริง</div>
        <ul className="space-y-[3px]">
          {venues.map((v) => (
            <li key={v.name} className="flex items-center gap-2 text-[10.5px]">
              <span
                className={`size-1.5 shrink-0 rounded-full ${v.online ? "bg-up dot-live" : "bg-down"}`}
              />
              <span className="min-w-0 flex-1 truncate">{v.name}</span>
              <span
                className={`num shrink-0 ${
                  !v.online ? "text-down" : v.latency > 1000 ? "text-warn" : "text-muted"
                }`}
              >
                {v.online ? `${v.latency} ms` : "ต่อไม่ได้"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">ภูมิภาคและการกู้คืน · จำลอง</div>
        <ul className="space-y-[3px]">
          {regionRows.map((r) => (
            <li key={r.name} className="flex items-center gap-2 text-[10.5px]">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  r.role === "primary" ? "bg-brand" : r.role === "standby" ? "bg-up/60" : "bg-[#33505f]"
                }`}
              />
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="w-[74px] shrink-0 text-right text-[9px] text-dim">{r.roleTh}</span>
              <span className="num w-[52px] shrink-0 text-right text-muted">
                {r.latencyMs === null ? "—" : `${r.latencyMs} ms`}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[9px] leading-snug text-dim">
          เวลาในการกู้คืนเป้าหมาย 30 วินาที · จุดกู้คืนข้อมูลย้อนหลัง 5 วินาที
        </p>
      </div>
    </Panel>
  );
}

/** Section 9 — deployment pipeline. */
export function DeployPanel({
  stages,
  progress,
  onProgress,
}: {
  stages: DeployStage[];
  progress: number;
  onProgress: (v: number) => void;
}) {
  return (
    <Panel
      title="ศูนย์ปล่อยเวอร์ชัน"
      titleEn="Deployment Center"
      right={<Tag tone={progress >= 100 ? "up" : "warn"}>ความคืบหน้า {progress}%</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex flex-wrap items-stretch gap-1">
        {stages.map((s, i) => (
          <div key={s.en} className="flex min-w-0 flex-1 items-center gap-1">
            <div
              className="min-w-0 flex-1 rounded border px-1.5 py-1.5"
              style={{
                borderColor:
                  s.state === "done" ? "#14e2a066" : s.state === "active" ? "#00d4ff88" : "#16242f",
                background: s.state === "active" ? "#062a3833" : "#0a121a",
              }}
            >
              <div
                className="truncate text-[9.5px] font-semibold"
                style={{
                  color:
                    s.state === "done" ? "#14e2a0" : s.state === "active" ? "#00d4ff" : "#47616f",
                }}
              >
                {s.th}
              </div>
              <div className="truncate text-[8px] text-dim">{s.en}</div>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-[#16242f]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${s.pct}%`,
                    background: s.state === "done" ? "#14e2a0" : "#00d4ff",
                  }}
                />
              </div>
            </div>
            {i < stages.length - 1 && <span className="shrink-0 text-[10px] text-dim">→</span>}
          </div>
        ))}
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={(e) => onProgress(Number(e.target.value))}
        className="w-full accent-[#00d4ff]"
        aria-label="ความคืบหน้าการปล่อยเวอร์ชัน"
      />

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-dim">
        <span>Blue-Green Deployment · เปิด</span>
        <span>Canary Release · เปิด</span>
        <span className="text-up">Rollback พร้อมใช้งานทุกขั้น</span>
      </div>
    </Panel>
  );
}

/** Sections 11 + 15 — capacity planning and the system digital twin. */
export function CapacityPanel({
  outcomes,
  selected,
  onSelect,
}: {
  outcomes: TwinOutcome[];
  selected: string;
  onSelect: (k: string) => void;
}) {
  const active = outcomes.find((o) => o.scenario.key === selected) ?? outcomes[0];

  return (
    <Panel
      title="ฝาแฝดดิจิทัลของระบบ"
      titleEn="System Digital Twin"
      right={
        <Tag tone={outcomes.every((o) => o.ok) ? "up" : "warn"}>
          รองรับได้ {outcomes.filter((o) => o.ok).length}/{outcomes.length}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex flex-wrap gap-1">
        {outcomes.map((o) => (
          <button
            key={o.scenario.key}
            type="button"
            onClick={() => onSelect(o.scenario.key)}
            className={`rounded border px-2 py-1 text-[9.5px] transition-colors ${
              selected === o.scenario.key
                ? "border-brand/60 bg-[#062a38] text-brand"
                : o.ok
                  ? "border-line bg-[#0d1922] text-muted hover:text-txt"
                  : "border-warn/40 bg-[#2d2310] text-warn"
            }`}
          >
            {o.scenario.th}
          </button>
        ))}
      </div>

      {active && (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {[
              { th: "จำนวน AI", v: `${active.agents}` },
              { th: "คำขอต่อนาที", v: fmtNum(active.requestsPerMin, 0) },
              {
                th: "โหนดที่ต้องใช้",
                v: `${active.nodesNeeded} / ${active.nodesAvailable}`,
                tone: active.ok ? "text-up" : "text-down",
              },
              {
                th: "ความหน่วงที่คาด",
                v: `${active.projectedLatency.toFixed(0)} ms`,
                tone: active.projectedLatency > 800 ? "text-warn" : "text-up",
              },
            ].map((c) => (
              <div key={c.th} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
                <div className="truncate text-[9px] text-dim">{c.th}</div>
                <div className={`num truncate text-[13px] font-bold ${c.tone ?? "text-txt"}`}>
                  {c.v}
                </div>
              </div>
            ))}
          </div>

          <p
            className={`rounded border px-2.5 py-2 text-[10px] leading-snug ${
              active.ok
                ? "border-up/40 bg-[#0d2b23] text-up"
                : "border-warn/40 bg-[#2d2310] text-warn"
            }`}
          >
            {active.verdictTh}
          </p>

          <p className="text-[9px] leading-snug text-dim">
            คำนวณจากความหน่วงจริงของ API บนเครื่องนี้ คูณด้วยจำนวนผู้ใช้และ AI ที่เพิ่มเข้ามา —
            เป็นเลขคณิตจากค่าที่วัดได้ ไม่ใช่การคาดเดา
          </p>
        </>
      )}
    </Panel>
  );
}

/** Sections 14 + AI-CTO. */
export function CostPanel({
  costs,
  advice,
}: {
  costs: CostRow[];
  advice: CtoAdvice[];
}) {
  const total = costs.reduce((a, c) => a + c.monthly, 0);
  const max = Math.max(...costs.map((c) => c.monthly), 1);

  return (
    <Panel
      title="ต้นทุนระบบและข้อเสนอจาก AI-CTO"
      titleEn="Cost Intelligence & AI-CTO"
      right={<Tag tone="neutral">รวม ${fmtNum(total, 0)}/เดือน</Tag>}
      bodyClassName="p-2.5 grid gap-3 md:grid-cols-2"
    >
      <div>
        <div className="mb-1 text-[9.5px] text-dim">ประมาณการต้นทุนต่อเดือน</div>
        <ul className="space-y-1.5">
          {costs.map((c) => (
            <li key={c.en}>
              <div className="flex justify-between text-[10px]">
                <span className="truncate text-muted">{c.th}</span>
                <span className="num text-txt">${fmtNum(c.monthly, 0)}</span>
              </div>
              <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
                <div
                  className="h-full rounded-full bg-brand/70"
                  style={{ width: `${(c.monthly / max) * 100}%` }}
                />
              </div>
              <div className="truncate text-[8.5px] text-dim">{c.note}</div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-1 text-[9.5px] text-dim">AI-CTO เสนอ</div>
        <ul className="space-y-1.5">
          {advice.map((a) => (
            <li key={a.th} className="rounded border border-line-soft bg-[#08111a] px-2 py-1.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`shrink-0 rounded border px-1.5 py-[1px] text-[8.5px] ${
                    a.priority === "สูง"
                      ? "border-down/40 text-down"
                      : a.priority === "กลาง"
                        ? "border-warn/40 text-warn"
                        : "border-line text-dim"
                  }`}
                >
                  {a.priority}
                </span>
                <span className="min-w-0 flex-1 truncate text-[10px] text-txt">{a.th}</span>
              </div>
              <p className="mt-0.5 text-[9px] leading-snug text-muted">{a.reason}</p>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[9px] leading-snug text-dim">
          AI-CTO ไม่เทรดและไม่แตะพอร์ต ทำหน้าที่ดูแลโครงสร้างพื้นฐานอย่างเดียว —
          ทุกข้อเสนออ้างอิงค่าที่วัดได้จริงในหน้านี้
        </p>
      </div>
    </Panel>
  );
}
