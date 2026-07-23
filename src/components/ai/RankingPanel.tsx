"use client";

import { useMemo } from "react";
import { AGENTS, GROUP_BY_KEY, telemetry, trustScore } from "@/lib/agents";
import { fmtPct } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel } from "../Panel";

export function RankingPanel({
  onSelect,
  selected,
}: {
  onSelect: (id: string) => void;
  selected: string | null;
}) {
  const { quotes } = useMarket();

  const ranked = useMemo(
    () =>
      AGENTS.map((a) => {
        const move = a.symbol ? (quotes.get(a.symbol)?.changePct ?? null) : null;
        const t = telemetry(a, move);
        return {
          agent: a,
          profit: t.profitPct,
          trust: trustScore(t),
          live: move !== null,
          color: GROUP_BY_KEY.get(a.group)?.color ?? "#6b8497",
        };
      })
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 8),
    [quotes],
  );

  return (
    <Panel
      title="อันดับผลงาน AI"
      titleEn="Performance Ranking"
      right={<span className="text-[9px] text-dim">วันนี้ · Trust Score</span>}
      bodyClassName="p-0"
    >
      <ol className="divide-y divide-line-soft">
        {ranked.map((r, i) => (
          <li key={r.agent.id}>
            <button
              type="button"
              onClick={() => onSelect(r.agent.id)}
              className={`flex w-full items-center gap-2 px-3 py-[6.5px] text-left hover:bg-[#0e1a24] ${
                selected === r.agent.id ? "bg-[#0e1f26]" : ""
              }`}
            >
              <span
                className={`num grid size-[16px] shrink-0 place-items-center rounded text-[9px] font-bold ${
                  i === 0 ? "bg-brand text-black" : "bg-[#16242f] text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px]">{r.agent.name}</span>
                <span className="block truncate text-[9px] text-dim">
                  {r.agent.nameTh}
                  {r.live && <span className="ml-1 text-up">· LIVE</span>}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[8.5px] text-dim">Trust</span>
                <span
                  className={`num block text-[10px] font-bold ${
                    r.trust.score >= 78
                      ? "text-up"
                      : r.trust.score >= 60
                        ? "text-warn"
                        : "text-down"
                  }`}
                >
                  {r.trust.score}
                </span>
              </span>
              <span
                className={`num w-[52px] shrink-0 text-right text-[11px] font-bold ${
                  r.profit >= 0 ? "text-up" : "text-down"
                }`}
              >
                {fmtPct(r.profit)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
        Trust Score = ความแม่นยำ 26% · ผลตอบแทนจริง 24% · Max Drawdown 18% ·
        ความเสถียร 14% · ความสดของโมเดล 10% · คุณภาพข้อมูล 8%
        — Master AI ให้น้ำหนัก AI ที่คะแนนสูงกว่ามากขึ้น
      </p>
    </Panel>
  );
}
