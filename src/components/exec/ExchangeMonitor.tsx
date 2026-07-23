"use client";

import { fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { useExec } from "./ExecProvider";

function Stat({
  label,
  value,
  tone = "text-txt",
  sub,
}: {
  label: string;
  value: string;
  tone?: string;
  sub?: string;
}) {
  return (
    <div className="panel min-w-0 flex-1 px-2.5 py-1.5">
      <div className="truncate text-[9px] tracking-wide text-dim">{label}</div>
      <div className={`num truncate text-[15px] font-bold ${tone}`}>{value}</div>
      {sub && <div className="truncate text-[8.5px] text-dim">{sub}</div>}
    </div>
  );
}

/** Section 1 — venue health plus the day's execution counters. */
export function ExchangeMonitor() {
  const { venues, stats, autoMode, setAutoMode } = useExec();
  const { emergencyStop, setEmergencyStop } = useMarket();

  const online = venues.filter((v) => v.online);
  const bestLatency = online.length ? Math.min(...online.map((v) => v.latency)) : null;

  return (
    <div className="flex flex-col gap-2.5">
      <section className="panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        {venues.length === 0 ? (
          <span className="text-[10px] text-dim">กำลังตรวจสอบ exchange…</span>
        ) : (
          venues.map((v) => (
            <span key={v.id} className="flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${v.online ? "bg-up dot-live" : "bg-down"}`}
              />
              <span className="min-w-0 leading-tight">
                <span
                  className={`block truncate text-[10.5px] font-semibold ${
                    v.online ? "text-txt" : "text-down"
                  }`}
                >
                  {v.name}
                </span>
                <span className="block truncate text-[8.5px] text-dim">
                  {v.online ? (
                    <>
                      <span className="num">{v.latency}</span> ms ·{" "}
                      <span className="num">{v.price ? fmtPrice(v.price) : "—"}</span>
                    </>
                  ) : (
                    "เชื่อมต่อไม่ได้"
                  )}
                </span>
              </span>
            </span>
          ))
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoMode(!autoMode)}
            className={`flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] ${
              autoMode
                ? "border-up/50 bg-[#0d2b23] text-up"
                : "border-line bg-[#0d1922] text-muted"
            }`}
          >
            <span className={`size-1.5 rounded-full ${autoMode ? "bg-up" : "bg-dim"}`} />
            AUTO MODE {autoMode ? "ON" : "OFF"}
          </button>

          <button
            type="button"
            onClick={() => setEmergencyStop(!emergencyStop)}
            className={`rounded border px-3 py-1 text-[10.5px] font-bold ${
              emergencyStop
                ? "border-up/50 bg-[#0d2b23] text-up"
                : "border-[#6b1f31] bg-gradient-to-b from-[#3a1220] to-[#2a0f18] text-down hover:from-[#4d1729]"
            }`}
          >
            {emergencyStop ? "กลับสู่ปกติ RESUME" : "EMERGENCY STOP"}
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2.5">
        <Stat label="คำสั่งทั้งหมด TOTAL ORDERS" value={`${stats.total}`} />
        <Stat
          label="จับคู่แล้ว FILLED"
          value={`${stats.filled}`}
          tone="text-up"
          sub={`${stats.fillRate.toFixed(1)}%`}
        />
        <Stat label="รอดำเนินการ PENDING" value={`${stats.pending}`} tone="text-warn" />
        <Stat label="ถูกปฏิเสธ REJECTED" value={`${stats.rejected}`} tone="text-down" />
        <Stat label="ยกเลิก CANCELLED" value={`${stats.cancelled}`} />
        <Stat
          label="LATENCY เฉลี่ย"
          value={stats.avgLatency ? `${stats.avgLatency.toFixed(0)} ms` : "—"}
          tone="text-brand"
          sub={bestLatency !== null ? `เร็วสุด ${bestLatency} ms` : undefined}
        />
        <Stat
          label="SLIPPAGE เฉลี่ย"
          value={stats.avgSlippage ? `${stats.avgSlippage.toFixed(4)}%` : "—"}
          tone={Math.abs(stats.avgSlippage) < 0.05 ? "text-up" : "text-warn"}
        />
        <Stat
          label="มูลค่าที่ส่ง VOLUME"
          value={stats.volume ? `$${stats.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
        />
      </div>
    </div>
  );
}
