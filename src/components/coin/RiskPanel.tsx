"use client";

import type { RiskRow } from "@/lib/scoring";
import { Panel, Tag } from "../Panel";
import { ArcGauge } from "../viz";

const tone = (v: number) => (v >= 67 ? "#ff4a68" : v >= 34 ? "#ffb020" : "#14e2a0");

export function RiskPanel({ rows }: { rows: RiskRow[] }) {
  const overall = rows.length
    ? rows.reduce((a, r) => a + r.level, 0) / rows.length
    : 0;

  const label = overall >= 67 ? "เสี่ยงสูง" : overall >= 34 ? "เฝ้าระวัง" : "ปลอดภัย";

  return (
    <Panel
      title="วิเคราะห์ความเสี่ยง"
      titleEn="Risk Analysis"
      right={
        <Tag tone={overall >= 67 ? "down" : overall >= 34 ? "warn" : "up"}>{label}</Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <ArcGauge
            value={overall}
            max={100}
            size={140}
            label={`${overall.toFixed(0)}`}
            sub="Risk Meter / 100"
          />
        </div>
        <ul className="min-w-0 flex-1 space-y-[3px]">
          {rows.map((r) => (
            <li key={r.en} className="flex items-center gap-1.5">
              <span className="w-[86px] shrink-0 truncate text-[9.5px] text-muted">
                {r.th}
              </span>
              <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${r.level}%`, background: tone(r.level) }}
                />
              </span>
              <span
                className="num w-6 shrink-0 text-right text-[9.5px] font-bold"
                style={{ color: tone(r.level) }}
              >
                {r.level.toFixed(0)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-line-soft pt-2">
        {rows.map((r) => (
          <li key={`${r.en}-note`} className="flex justify-between text-[9px]">
            <span className="truncate text-dim">{r.en}</span>
            <span className="truncate text-muted">{r.note}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
