"use client";

import { TOTAL_AGENTS } from "@/lib/agents";
import type { Consensus } from "@/lib/scoring";
import { Panel, Tag } from "../Panel";

/**
 * Shows how widely the fleet agrees, not just what the Master concluded — a
 * 26-to-24 split and a 42-to-3 landslide produce the same Master verdict but
 * mean very different things.
 */
export function ConsensusPanel({ data }: { data: Consensus }) {
  const pct = (n: number) => (n / TOTAL_AGENTS) * 100;

  return (
    <Panel
      title="ระดับความเห็นพ้องของ AI"
      titleEn="Consensus Engine"
      right={
        <Tag tone={data.split ? "warn" : data.long > data.short ? "up" : "down"}>
          {data.split ? "เสียงแตก" : `เห็นพ้อง ${data.agreementPct}%`}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <p
        className={`text-[13px] font-bold ${
          data.split ? "text-warn" : data.long > data.short ? "text-up" : "text-down"
        }`}
      >
        {data.headline}
      </p>

      <div className="flex h-4 overflow-hidden rounded bg-[#101c25]">
        <div
          className="flex items-center justify-center bg-up/70 text-[9px] font-bold text-black"
          style={{ width: `${pct(data.long)}%` }}
        >
          {data.long > 3 ? data.long : ""}
        </div>
        <div
          className="flex items-center justify-center bg-[#33505f] text-[9px] text-txt"
          style={{ width: `${pct(data.neutral)}%` }}
        >
          {data.neutral > 3 ? data.neutral : ""}
        </div>
        <div
          className="flex items-center justify-center bg-down/70 text-[9px] font-bold text-black"
          style={{ width: `${pct(data.short)}%` }}
        >
          {data.short > 3 ? data.short : ""}
        </div>
      </div>

      <div className="flex justify-between text-[9.5px]">
        <span className="text-up">LONG {data.long}</span>
        <span className="text-muted">กลาง {data.neutral}</span>
        <span className="text-down">SHORT {data.short}</span>
      </div>

      <ul className="space-y-[3px] border-t border-line-soft pt-2">
        {data.byGroup.map((g) => {
          const total = g.long + g.short + g.neutral;
          return (
            <li key={g.key} className="flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: g.color }}
              />
              <span className="w-[86px] shrink-0 truncate text-[9.5px] text-muted">
                {g.th}
              </span>
              <span className="flex h-[4px] flex-1 overflow-hidden rounded-full bg-[#101c25]">
                <span className="bg-up/70" style={{ width: `${(g.long / total) * 100}%` }} />
                <span className="bg-[#33505f]" style={{ width: `${(g.neutral / total) * 100}%` }} />
                <span className="bg-down/70" style={{ width: `${(g.short / total) * 100}%` }} />
              </span>
              <span className="num w-[42px] shrink-0 text-right text-[9px] text-dim">
                {g.long}/{g.short}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-[9px] leading-snug text-dim">
        AI แต่ละตัวโหวตจากคะแนนที่กลุ่มของตัวเองรับผิดชอบ แล้วถ่วงด้วย Trust Score
        ของตัวเอง — ตัวที่ผลงานดีจะกล้าลงคะแนนหนักกว่า
      </p>
    </Panel>
  );
}
