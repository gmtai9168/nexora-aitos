"use client";

import { useState } from "react";
import { fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { findListing } from "@/lib/universe";
import { Panel, Tag } from "./Panel";

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line-soft py-[4px] last:border-0">
      <span className="text-[10px] text-muted">{label}</span>
      <span className={`num text-[11px] font-semibold ${tone ?? "text-txt"}`}>{value}</span>
    </div>
  );
}

export function MasterDecision() {
  const { decision, symbol, emergencyStop, candlesLoading } = useMarket();
  const [why, setWhy] = useState(false);
  const listing = findListing(symbol);

  const action = emergencyStop ? "HALTED" : (decision?.action ?? "—");
  const tone =
    action === "LONG" ? "up" : action === "SHORT" ? "down" : action === "HALTED" ? "down" : "warn";
  const color =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-warn";

  return (
    <Panel
      title="การตัดสินใจของ MASTER AI"
      titleEn="Master AI Decision"
      right={<Tag tone="warn">DEMO</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      {!decision ? (
        <p className="py-8 text-center text-[11px] text-dim">
          {candlesLoading ? "กำลังรวบรวมหลักฐานจากตลาด…" : "ข้อมูลไม่พอสำหรับตัดสินใจ"}
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2.5 rounded-md border border-line-soft bg-[#0a141c] px-2.5 py-2">
            <div className="min-w-0">
              <div className="text-[9px] tracking-wide text-dim">MASTER AI</div>
              <div className={`text-[26px] font-extrabold leading-none ${color}`}>
                {action}
              </div>
              <div className="mt-0.5 text-[10.5px] text-muted">
                {listing?.display ?? symbol}
              </div>
            </div>

            <div className="ml-auto text-right">
              <div className="text-[9px] text-dim">Confidence</div>
              <div className="num text-[24px] font-extrabold leading-none text-brand">
                {emergencyStop ? "—" : `${decision.confidence}%`}
              </div>
              <div className="mt-1 h-[3px] w-[70px] overflow-hidden rounded-full bg-[#16242f]">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: emergencyStop ? "0%" : `${decision.confidence}%` }}
                />
              </div>
            </div>
          </div>

          <div>
            <Row
              label="Expected Win Rate"
              value={`${decision.expectedWinRate}%`}
              tone="text-up"
            />
            <Row label="Risk : Reward" value={`1 : ${decision.riskReward}`} />
            <Row label="Position Size" value={`${decision.positionSizePct}%`} />
            <Row label="Leverage" value={`${decision.leverage}X`} />
            <Row label="Entry" value={fmtPrice(decision.entry)} />
            <Row label="Stop Loss" value={fmtPrice(decision.stop)} tone="text-down" />
            <Row label="Take Profit" value={fmtPrice(decision.target)} tone="text-up" />
          </div>

          <ul className="space-y-[3px]">
            {decision.evidence.map((e) => (
              <li key={e.key} className="flex items-center gap-1.5 text-[10px]">
                <span
                  className={`grid size-3 shrink-0 place-items-center rounded-full text-[7px] font-bold ${
                    e.vote === 1
                      ? "bg-up/20 text-up"
                      : e.vote === -1
                        ? "bg-down/20 text-down"
                        : "bg-[#1b2833] text-dim"
                  }`}
                >
                  {e.vote === 1 ? "▲" : e.vote === -1 ? "▼" : "•"}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">{e.th}</span>
                <span
                  className={`shrink-0 text-[10px] ${
                    e.vote === 1 ? "text-up" : e.vote === -1 ? "text-down" : "text-dim"
                  }`}
                >
                  {e.verdict}
                </span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setWhy((v) => !v)}
            className="rounded border border-brand/40 bg-[#062a38] py-1.5 text-[11px] font-semibold text-brand hover:bg-[#083545]"
          >
            {why ? "ปิดคำอธิบาย" : "WHY? — ทำไม AI ถึงตัดสินใจแบบนี้"}
          </button>

          {why && (
            <div className="space-y-1.5 rounded-md border border-line-soft bg-[#08111a] p-2.5">
              <p className="text-[10.5px] text-txt">{decision.summaryTh}</p>
              <ul className="space-y-1">
                {decision.evidence.map((e) => (
                  <li key={e.key} className="text-[10px] leading-snug">
                    <span
                      className={
                        e.vote === 1 ? "text-up" : e.vote === -1 ? "text-down" : "text-dim"
                      }
                    >
                      {e.th} ({e.en}):
                    </span>{" "}
                    <span className="text-muted">
                      {e.verdict} — {e.detail}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line-soft pt-1.5 text-[9px] text-dim">
                คะแนนรวม {decision.supporting} หนุน / {decision.against} ค้าน จาก{" "}
                {decision.evidence.length} สัญญาณ · ต้องได้ผลต่าง ≥ 2 จึงจะออกคำสั่ง
                ทุกตัวเลขคำนวณจากแท่งเทียน สมุดคำสั่ง และข้อมูลฟิวเจอร์สจริงของ Binance
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
