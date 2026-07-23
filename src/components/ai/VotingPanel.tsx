"use client";

import { useMemo } from "react";
import { AGENTS, GROUP_BY_KEY } from "@/lib/agents";
import { buildBook } from "@/lib/book";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

/** Each piece of Master AI's evidence is owned by the pod that produces it. */
const OWNER: Record<string, string> = {
  trend: "trend-0",
  sweep: "smart-0",
  funding: "futures-0",
  whale: "smart-2",
  oi: "futures-1",
  volume: "ml-4",
};

export function VotingPanel() {
  const { decision, quotes, symbol } = useMarket();
  const book = useMemo(() => buildBook(quotes), [quotes]);

  const rows = useMemo(() => {
    if (!decision) return [];

    const base = decision.evidence.map((e) => {
      const agent = AGENTS.find((a) => a.id === OWNER[e.key]);
      const group = agent ? GROUP_BY_KEY.get(agent.group) : undefined;
      return {
        id: e.key,
        name: agent?.name ?? e.en,
        nameTh: agent?.nameTh ?? e.th,
        color: group?.color ?? "#6b8497",
        vote: e.vote === 1 ? "LONG" : e.vote === -1 ? "SHORT" : "NEUTRAL",
        tone: e.vote === 1 ? "up" : e.vote === -1 ? "down" : "neutral",
        weight: Math.round(50 + Math.abs(e.vote) * 38),
        detail: e.verdict,
      } as const;
    });

    // The risk pod gates on the live book, not on price.
    const riskOk = book.marginRatio < 45 && book.dayPnlPct > -1.6;
    const riskAgent = AGENTS.find((a) => a.id === "risk-1")!;
    const masterAgent = AGENTS.find((a) => a.id === "master-0")!;

    return [
      ...base,
      {
        id: "risk",
        name: riskAgent.name,
        nameTh: riskAgent.nameTh,
        color: GROUP_BY_KEY.get("risk")!.color,
        vote: riskOk ? "APPROVE" : "REJECT",
        tone: riskOk ? "up" : "down",
        weight: Math.round(riskOk ? 92 : 40),
        detail: `Margin ${book.marginRatio.toFixed(1)}%`,
      } as const,
      {
        id: "master",
        name: masterAgent.name,
        nameTh: masterAgent.nameTh,
        color: GROUP_BY_KEY.get("master")!.color,
        vote: decision.action === "WAIT" ? "HOLD" : decision.action,
        tone:
          decision.action === "LONG" ? "up" : decision.action === "SHORT" ? "down" : "neutral",
        weight: decision.confidence,
        detail: `${decision.supporting} หนุน / ${decision.against} ค้าน`,
      } as const,
    ];
  }, [decision, book]);

  return (
    <Panel
      title="การโหวตของคณะ AI"
      titleEn="AI Voting"
      right={<Tag tone="up">LIVE</Tag>}
      bodyClassName="p-0"
    >
      {rows.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">
          กำลังรวบรวมคะแนนเสียง…
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line-soft">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3 py-[7px]">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: r.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px]">{r.name}</span>
                  <span className="block truncate text-[9px] text-dim">{r.detail}</span>
                </span>
                <span className="h-[3px] w-[54px] shrink-0 overflow-hidden rounded-full bg-[#16242f]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${r.weight}%`,
                      background:
                        r.tone === "up" ? "#14e2a0" : r.tone === "down" ? "#ff4a68" : "#6b8497",
                    }}
                  />
                </span>
                <span
                  className={`num w-[62px] shrink-0 text-right text-[10px] font-bold ${
                    r.tone === "up" ? "text-up" : r.tone === "down" ? "text-down" : "text-muted"
                  }`}
                >
                  {r.vote}
                </span>
                <span className="num w-8 shrink-0 text-right text-[10px] text-brand">
                  {r.weight}%
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line-soft px-3 py-1.5 text-[9px] text-dim">
            คะแนนทั้งหมดคำนวณจากตลาดจริงของ {symbol} — AI ไม่ได้ตัดสินใจจากตัวเดียว
            แต่ต้องผ่านมติของคณะกรรมการ
          </p>
        </>
      )}
    </Panel>
  );
}
