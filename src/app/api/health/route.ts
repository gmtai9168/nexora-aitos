import os from "node:os";

/**
 * Real telemetry from the Node process serving this app.
 *
 * Nothing here is invented — uptime, heap, RSS, load average and core count
 * come straight from the runtime, so the System Operations page has at least
 * one genuinely measured infrastructure source.
 */
export async function GET() {
  const mem = process.memoryUsage();
  const cpus = os.cpus();
  const total = os.totalmem();
  const free = os.freemem();

  // Load average is meaningless on Windows (always 0) — report null instead.
  const load = os.loadavg();
  const hasLoad = load.some((v) => v > 0);

  return Response.json(
    {
      uptimeSec: Math.round(process.uptime()),
      node: process.version,
      platform: `${os.platform()} ${os.release()}`,
      arch: os.arch(),
      cpuCores: cpus.length,
      cpuModel: cpus[0]?.model?.trim() ?? "unknown",
      loadAvg: hasLoad ? load.map((v) => Number(v.toFixed(2))) : null,
      heapUsedMb: Math.round(mem.heapUsed / 1048576),
      heapTotalMb: Math.round(mem.heapTotal / 1048576),
      rssMb: Math.round(mem.rss / 1048576),
      externalMb: Math.round(mem.external / 1048576),
      systemTotalMb: Math.round(total / 1048576),
      systemFreeMb: Math.round(free / 1048576),
      systemUsedPct: Number((((total - free) / total) * 100).toFixed(1)),
      ts: Date.now(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
