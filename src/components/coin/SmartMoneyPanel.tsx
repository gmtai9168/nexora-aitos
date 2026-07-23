"use client";

import { useMemo } from "react";
import { fmtCompact, fmtNum, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { Micro } from "@/lib/use-coin-intel";
import { Panel, Tag } from "../Panel";

export function SmartMoneyPanel({ micro }: { micro: Micro }) {
  const { context } = useMarket();

  // Split the visible tape into retail-sized and institution-sized flow.
  const tape = useMemo(() => {
    if (micro.trades.length === 0) return null;
    const notionals = micro.trades.map((t) => t.price * t.qty);
    const sorted = [...notionals].sort((a, b) => a - b);
    const bigFloor = sorted[Math.floor(sorted.length * 0.85)] ?? Infinity;

    let buy = 0;
    let sell = 0;
    let bigBuy = 0;
    let bigSell = 0;
    let biggest = { notional: 0, price: 0, side: "buy" as "buy" | "sell" };

    micro.trades.forEach((t, i) => {
      const n = notionals[i];
      if (t.side === "buy") buy += n;
      else sell += n;
      if (n >= bigFloor) {
        if (t.side === "buy") bigBuy += n;
        else bigSell += n;
      }
      if (n > biggest.notional) biggest = { notional: n, price: t.price, side: t.side };
    });

    const total = buy + sell;
    const bigTotal = bigBuy + bigSell;
    return {
      delta: total ? ((buy - sell) / total) * 100 : 0,
      bigDelta: bigTotal ? ((bigBuy - bigSell) / bigTotal) * 100 : 0,
      bigShare: total ? (bigTotal / total) * 100 : 0,
      biggest,
      total,
    };
  }, [micro.trades]);

  const whale = context.whaleBuyShare;
  const phase =
    whale === null
      ? "ไม่มีข้อมูล"
      : whale > 58
        ? "สะสม (Accumulation)"
        : whale < 42
          ? "แจกจ่าย (Distribution)"
          : "สมดุล (Balanced)";

  return (
    <Panel
      title="เงินใหญ่ในตลาด"
      titleEn="Smart Money Analysis"
      right={
        <Tag tone={whale === null ? "neutral" : whale >= 50 ? "up" : "down"}>
          {phase.split(" ")[0]}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
          <div className="text-[9px] text-dim">แรงซื้อรายใหญ่ Whale Buy</div>
          <div
            className={`num text-[16px] font-bold ${
              (whale ?? 50) >= 50 ? "text-up" : "text-down"
            }`}
          >
            {whale === null ? "—" : `${whale.toFixed(1)}%`}
          </div>
          <div className="text-[8.5px] text-dim">
            {context.whaleNotional ? `${fmtCompact(context.whaleNotional)} USD` : ""}
          </div>
        </div>
        <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
          <div className="text-[9px] text-dim">Taker Delta ทั้งตลาด</div>
          <div
            className={`num text-[16px] font-bold ${
              (context.takerBuyShare ?? 50) >= 50 ? "text-up" : "text-down"
            }`}
          >
            {context.takerBuyShare === null ? "—" : `${context.takerBuyShare.toFixed(1)}%`}
          </div>
          <div className="text-[8.5px] text-dim">สัดส่วนฝั่งซื้อที่เคาะราคา</div>
        </div>
      </div>

      {tape ? (
        <div className="space-y-1 border-t border-line-soft pt-2 text-[10px]">
          <div className="flex justify-between">
            <span className="text-dim">Delta ทั้งกระดาน</span>
            <span className={`num ${tape.delta >= 0 ? "text-up" : "text-down"}`}>
              {tape.delta >= 0 ? "+" : ""}
              {tape.delta.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">Delta เฉพาะไม้ใหญ่</span>
            <span className={`num ${tape.bigDelta >= 0 ? "text-up" : "text-down"}`}>
              {tape.bigDelta >= 0 ? "+" : ""}
              {tape.bigDelta.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">สัดส่วนไม้ใหญ่ (Large Order)</span>
            <span className="num text-muted">{tape.bigShare.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-dim">ไม้ใหญ่สุดในกระดาน</span>
            <span className={`num ${tape.biggest.side === "buy" ? "text-up" : "text-down"}`}>
              {fmtPrice(tape.biggest.price)} · {fmtCompact(tape.biggest.notional)}
            </span>
          </div>
        </div>
      ) : (
        <p className="border-t border-line-soft pt-2 text-[10px] text-dim">
          ยังไม่มีข้อมูลรายการซื้อขายล่าสุด
        </p>
      )}

      <div className="border-t border-line-soft pt-2">
        <div className="mb-1 flex items-center justify-between text-[10px]">
          <span className="text-dim">พฤติกรรมเงินใหญ่</span>
          <span className={whale === null ? "text-dim" : whale >= 50 ? "text-up" : "text-down"}>
            {phase}
          </span>
        </div>
        <ul className="space-y-[3px]">
          {micro.trades.slice(0, 5).map((t, i) => (
            <li key={`${t.time}-${i}`} className="flex items-center gap-2 text-[9.5px]">
              <span className={`num ${t.side === "buy" ? "text-up" : "text-down"}`}>
                {t.side === "buy" ? "▲" : "▼"} {fmtPrice(t.price)}
              </span>
              <span className="num ml-auto text-muted">{fmtNum(t.qty, 4)}</span>
              <span className="num w-[62px] text-right text-dim">
                {fmtCompact(t.price * t.qty)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        &quot;ไม้ใหญ่&quot; คือรายการที่มูลค่าอยู่ในกลุ่มบนสุด 15% ของกระดานล่าสุด —
        คำนวณสดจากข้อมูล aggTrades ของ Binance ไม่ใช่ค่าประมาณ
      </p>
    </Panel>
  );
}
