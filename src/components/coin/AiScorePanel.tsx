"use client";

import { useState } from "react";
import { useMarket } from "@/lib/market-context";
import type { CoinScore } from "@/lib/scoring";
import { Panel, Tag } from "../Panel";
import { RingGauge } from "../viz";

const TONE = (v: number) => (v >= 65 ? "#14e2a0" : v >= 45 ? "#ffb020" : "#ff4a68");

export function AiScorePanel({ score }: { score: CoinScore }) {
  const { decision, emergencyStop } = useMarket();
  const [why, setWhy] = useState(false);

  const color = TONE(score.total);

  return (
    <Panel
      title="คะแนน AI ของสินทรัพย์"
      titleEn="AI Coin Analysis"
      right={<Tag tone={score.total >= 60 ? "up" : score.total >= 45 ? "warn" : "down"}>
        {score.verdict}
      </Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0">
          <RingGauge
            value={score.total}
            size={124}
            label={`${score.total}`}
            sub="AI SCORE / 100"
            color={color}
          />
        </div>

        <ul className="min-w-0 flex-1 space-y-[3px]">
          {score.parts.map((p) => (
            <li key={p.key} className="flex items-center gap-1.5">
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: TONE(p.value) }}
              />
              <span className="min-w-0 flex-1 truncate text-[10px] text-muted">
                {p.th}
                {!p.live && <span className="ml-1 text-[8.5px] text-dim">(ไม่มีข้อมูล)</span>}
              </span>
              <span className="h-[3px] w-9 shrink-0 overflow-hidden rounded-full bg-[#16242f]">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${p.value}%`, background: TONE(p.value) }}
                />
              </span>
              <span className="num w-5 shrink-0 text-right text-[10.5px] font-bold">
                {p.value.toFixed(0)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between border-t border-line-soft pt-1.5 text-[10px]">
            <span className="text-muted">Master AI</span>
            <span
              className={`font-bold ${
                emergencyStop
                  ? "text-down"
                  : decision?.action === "LONG"
                    ? "text-up"
                    : decision?.action === "SHORT"
                      ? "text-down"
                      : "text-warn"
              }`}
            >
              {emergencyStop ? "HALTED" : (decision?.action ?? "—")}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
        <div className="mb-1 text-[9.5px] text-brand">AI Summary</div>
        <p className="text-[10.5px] leading-relaxed text-muted">{score.summaryTh}</p>
      </div>

      <button
        type="button"
        onClick={() => setWhy((v) => !v)}
        className="rounded border border-brand/40 bg-[#062a38] py-1.5 text-[11px] font-semibold text-brand hover:bg-[#083545]"
      >
        {why ? "ปิดคำอธิบาย" : "WHY? — คะแนนแต่ละข้อมาจากไหน"}
      </button>

      {why && (
        <ul className="space-y-1 rounded border border-line-soft bg-[#08111a] p-2.5">
          {score.parts.map((p) => (
            <li key={p.key} className="text-[10px] leading-snug">
              <span style={{ color: TONE(p.value) }}>
                {p.th} ({p.en}) {p.value.toFixed(0)}:
              </span>{" "}
              <span className="text-muted">{p.detail}</span>
            </li>
          ))}
          <li className="border-t border-line-soft pt-1.5 text-[9px] text-dim">
            น้ำหนักรวม: แนวโน้ม 20% · โมเมนตัม 14% · แรงซื้อรายใหญ่ 13% · ML 12% ·
            สภาพคล่อง 10% · ค่าธรรมเนียม 9% · ความเสี่ยง 9% · มหภาค 7% · ข่าว 6%
            สัญญาณที่ไม่มีข้อมูลจะใช้ค่ากลาง 50 เสมอ ไม่ถูกนับเป็นบวก
          </li>
        </ul>
      )}
    </Panel>
  );
}
