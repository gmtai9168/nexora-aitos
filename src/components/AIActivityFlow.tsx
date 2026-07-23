"use client";

import { GROUPS } from "@/lib/agents";
import { useMarket } from "@/lib/market-context";
import { Panel } from "./Panel";

/** Exchange → Data → Trend → Smart Money → ML → Risk → Master → Execution → Exchange. */
const PIPELINE = ["data", "trend", "smart", "ml", "risk", "master", "exec"];

const STAGES = [
  { key: "src", th: "Exchange", en: "Feed", color: "#6b8497" },
  ...PIPELINE.map((key) => {
    const g = GROUPS.find((x) => x.key === key)!;
    return { key: g.key, th: g.th, en: g.en, color: g.color };
  }),
  { key: "out", th: "Exchange", en: "Order", color: "#6b8497" },
];

export function AIActivityFlow() {
  const { connected, emergencyStop, tick, decision } = useMarket();
  const live = connected && !emergencyStop;
  // The pulse walks one stage per quote poll, so it reflects real activity.
  const cursor = tick % STAGES.length;

  return (
    <Panel
      title="กระแสการทำงานของ AI"
      titleEn="AI Activity Flow"
      right={
        <span className="flex items-center gap-1.5 text-[9.5px]">
          <span
            className={`size-1.5 rounded-full ${live ? "bg-up dot-live" : "bg-down"}`}
          />
          <span className={live ? "text-up" : "text-down"}>
            {live ? "กำลังประมวลผล" : "หยุดทำงาน"}
          </span>
        </span>
      }
      bodyClassName="p-2.5"
    >
      <ol className="space-y-[3px]">
        {STAGES.map((s, i) => {
          const hot = live && i === cursor;
          const done = live && i < cursor;
          return (
            <li key={s.key} className="flex items-center gap-2">
              <span className="relative flex size-[14px] shrink-0 items-center justify-center">
                <span
                  className="size-[7px] rounded-full transition-all"
                  style={{
                    background: hot ? s.color : done ? `${s.color}88` : "#1b2833",
                    boxShadow: hot ? `0 0 8px ${s.color}` : undefined,
                  }}
                />
                {i < STAGES.length - 1 && (
                  <span
                    className="absolute left-1/2 top-[11px] h-[9px] w-[1px] -translate-x-1/2"
                    style={{ background: done ? `${s.color}55` : "#152029" }}
                  />
                )}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-[10.5px] transition-colors ${
                  hot ? "text-txt" : "text-muted"
                }`}
              >
                {s.th}
                <span className="ml-1 text-[9px] text-dim">{s.en}</span>
              </span>
              {hot && (
                <span
                  className="shrink-0 text-[9px]"
                  style={{ color: s.color }}
                >
                  ●
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-2 border-t border-line-soft pt-2 text-[9.5px] leading-snug text-dim">
        {emergencyStop
          ? "ระบบถูกสั่งหยุดฉุกเฉิน — ไปป์ไลน์ AI ทั้งหมดหยุดทำงาน"
          : decision
            ? `รอบล่าสุด Master AI สรุปเป็น ${decision.action} ที่ความมั่นใจ ${decision.confidence}%`
            : "กำลังรอข้อมูลชุดแรกจาก Exchange"}
      </p>
    </Panel>
  );
}
