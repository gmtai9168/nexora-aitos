"use client";

import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";
import { useExec } from "./ExecProvider";

/** Section 2 — the pipeline every order walks, lit up by the newest order. */
const STAGES = [
  { key: "decision", th: "AI ตัดสินใจ", en: "AI Decision", color: "#00d4ff" },
  { key: "risk", th: "ผ่านความเสี่ยง", en: "Risk Approved", color: "#fb7185" },
  { key: "size", th: "คำนวณขนาดไม้", en: "Position Size", color: "#facc15" },
  { key: "exec", th: "Execution AI", en: "Execution AI", color: "#ffb020" },
  { key: "routing", th: "เลือกตลาด", en: "Smart Routing", color: "#a78bfa" },
  { key: "api", th: "ส่งผ่าน API", en: "Exchange API", color: "#38bdf8" },
  { key: "filled", th: "จับคู่สำเร็จ", en: "Filled", color: "#10e08a" },
  { key: "position", th: "เปิดสถานะ", en: "Position Open", color: "#10e08a" },
  { key: "tpsl", th: "ตั้ง TP / SL", en: "Stop & Target", color: "#5eead4" },
];

/** How far the newest order has travelled down the pipeline. */
function stageOf(status: string): number {
  switch (status) {
    case "pending":
      return 2;
    case "routing":
      return 4;
    case "sent":
      return 5;
    case "accepted":
      return 5;
    case "partial":
      return 6;
    case "filled":
      return 8;
    default:
      return -1;
  }
}

export function ExecutionFlow() {
  const { orders, autoMode } = useExec();
  const { emergencyStop, connected } = useMarket();

  const newest = orders[0];
  const reached = newest ? stageOf(newest.status) : -1;
  const live = connected && !emergencyStop && autoMode;

  return (
    <Panel
      title="เส้นทางการส่งคำสั่ง"
      titleEn="Execution Flow"
      right={
        <Tag tone={emergencyStop ? "down" : live ? "up" : "warn"}>
          {emergencyStop ? "หยุดฉุกเฉิน" : live ? "พร้อมส่งคำสั่ง" : "โหมดมือ"}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <ol className="flex flex-wrap items-stretch gap-1">
        {STAGES.map((s, i) => {
          const done = reached >= i;
          const active = reached === i;
          return (
            <li key={s.key} className="flex min-w-0 flex-1 items-center gap-1">
              <span
                className="flex min-w-0 flex-1 flex-col rounded border px-1.5 py-1.5 transition-colors"
                style={{
                  borderColor: done ? `${s.color}66` : "#16242f",
                  background: active ? `${s.color}18` : "#0a121a",
                  boxShadow: active ? `0 0 10px ${s.color}44` : undefined,
                }}
              >
                <span
                  className="truncate text-[9.5px] font-semibold"
                  style={{ color: done ? s.color : "#47616f" }}
                >
                  {s.th}
                </span>
                <span className="truncate text-[8px] text-dim">{s.en}</span>
              </span>
              {i < STAGES.length - 1 && (
                <span
                  className="h-[1px] w-2 shrink-0"
                  style={{ background: done ? `${s.color}88` : "#16242f" }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-2 border-t border-line-soft pt-1.5 text-[9.5px] text-dim">
        {newest
          ? `คำสั่งล่าสุด ${newest.id} · ${newest.side} ${newest.qty} ${newest.symbol.replace("USDT", "")} · ${newest.venue}`
          : "ยังไม่มีคำสั่งในเซสชันนี้ — ส่งคำสั่งจากแผงด้านขวาเพื่อดูไปป์ไลน์ทำงาน"}
      </p>
    </Panel>
  );
}
