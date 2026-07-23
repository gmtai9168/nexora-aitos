"use client";

import { useState } from "react";
import { fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { EntryPlan } from "@/lib/scoring";
import { findListing } from "@/lib/universe";
import { Panel, Tag } from "../Panel";

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-[4.5px] last:border-0">
      <span className="text-[10px] text-muted">{label}</span>
      <span className={`num text-[11px] font-semibold ${tone ?? "text-txt"}`}>{value}</span>
    </div>
  );
}

export function EntryPlanPanel({ plan }: { plan: EntryPlan | null }) {
  const { symbol, emergencyStop } = useMarket();
  const [saved, setSaved] = useState<string | null>(null);
  const listing = findListing(symbol);

  const act = (kind: string) => {
    setSaved(kind);
    setTimeout(() => setSaved(null), 2600);
  };

  if (!plan) {
    return (
      <Panel title="แผนเข้า-ออกของ AI" titleEn="AI Entry / Exit" bodyClassName="p-3">
        <p className="py-8 text-center text-[11px] text-dim">
          ข้อมูลยังไม่พอสำหรับวางแผนการเทรด
        </p>
      </Panel>
    );
  }

  const wait = plan.direction === "WAIT" || emergencyStop;
  const tone = wait ? "text-warn" : plan.direction === "LONG" ? "text-up" : "text-down";

  return (
    <Panel
      title="แผนเข้า-ออกของ AI"
      titleEn="AI Entry / Exit"
      right={<Tag tone="warn">DEMO · ไม่ส่งคำสั่งจริง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2.5 rounded-md border border-line-soft bg-[#0a141c] px-2.5 py-2">
        <div className="min-w-0">
          <div className="text-[9px] tracking-wide text-dim">DIRECTION</div>
          <div className={`text-[24px] font-extrabold leading-none ${tone}`}>
            {emergencyStop ? "HALTED" : plan.direction}
          </div>
          <div className="mt-0.5 text-[10px] text-muted">{listing?.display ?? symbol}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-[9px] text-dim">AI Confidence</div>
          <div className="num text-[22px] font-extrabold leading-none text-brand">
            {plan.confidence}%
          </div>
        </div>
      </div>

      <div>
        <Row label="Entry" value={fmtPrice(plan.entry)} />
        <Row label="Stop Loss" value={fmtPrice(plan.stop)} tone="text-down" />
        {plan.targets.map((t) => (
          <Row
            key={t.label}
            label={`${t.label} (RR 1:${t.rr})`}
            value={fmtPrice(t.price)}
            tone="text-up"
          />
        ))}
        <Row label="ความเสี่ยงต่อไม้" value={`${plan.riskPct}% ของพอร์ต`} />
        <Row label="Leverage" value={`${plan.leverage}X`} />
        <Row label="ถือประมาณ" value={`${plan.holdingHours} ชั่วโมง`} />
        <Row label="Expected Win Rate" value={`${plan.winRate}%`} tone="text-up" />
        <Row label="Expected RR" value={`1 : ${plan.rr}`} />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          disabled={wait}
          onClick={() => act("open")}
          className={`rounded border py-1.5 text-[10.5px] font-semibold transition-colors ${
            wait
              ? "cursor-not-allowed border-line bg-[#0d1922] text-dim"
              : "border-up/50 bg-[#0d2b23] text-up hover:bg-[#124035]"
          }`}
        >
          Open Trade
        </button>
        <button
          type="button"
          onClick={() => act("paper")}
          className="rounded border border-brand/40 bg-[#062a38] py-1.5 text-[10.5px] font-semibold text-brand hover:bg-[#083545]"
        >
          Paper Trade
        </button>
        <button
          type="button"
          onClick={() => act("watch")}
          className="rounded border border-line bg-[#0d1922] py-1.5 text-[10.5px] text-muted hover:border-brand/40 hover:text-brand"
        >
          Save Watchlist
        </button>
      </div>

      {saved && (
        <p className="rounded border border-warn/40 bg-[#2d2310] px-2 py-1.5 text-[10px] text-warn">
          {saved === "open"
            ? "โหมดสาธิต — ยังไม่ได้เชื่อมบัญชี exchange จริง จึงไม่มีคำสั่งถูกส่งออกไป"
            : saved === "paper"
              ? "บันทึกเป็นการเทรดกระดาษแล้ว (เก็บในเซสชันนี้เท่านั้น)"
              : "เพิ่มเข้ารายการเฝ้าดูแล้ว"}
        </p>
      )}

      {wait && !emergencyStop && (
        <p className="text-[9.5px] leading-snug text-dim">
          Master AI ยังไม่ให้เข้าเทรด เพราะหลักฐานยังขัดกัน — ปุ่ม Open Trade
          จะเปิดใช้เมื่อผลต่างของสัญญาณถึงเกณฑ์
        </p>
      )}
    </Panel>
  );
}
