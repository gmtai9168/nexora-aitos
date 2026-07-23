"use client";

import { useMemo } from "react";
import { fmtCompact, fmtNum, fmtPrice } from "@/lib/format";
import type { Micro } from "@/lib/use-coin-intel";
import { Panel, Tag } from "../Panel";

/**
 * Reads the resting book: which side is heavier, where the fattest walls sit,
 * and whether a level is thick enough to act as support or resistance.
 */
function analyse(micro: Micro) {
  const bidSize = micro.bids.reduce((a, b) => a + b.qty, 0);
  const askSize = micro.asks.reduce((a, b) => a + b.qty, 0);
  const total = bidSize + askSize;
  const imbalance = total ? ((bidSize - askSize) / total) * 100 : 0;

  const best = micro.bids[0] && micro.asks[0]
    ? { bid: micro.bids[0].price, ask: micro.asks[0].price }
    : null;
  const spreadPct = best ? ((best.ask - best.bid) / best.bid) * 100 : null;

  const wall = (levels: { price: number; qty: number }[]) => {
    if (levels.length === 0) return null;
    const avg = levels.reduce((a, l) => a + l.qty, 0) / levels.length;
    const biggest = [...levels].sort((a, b) => b.qty - a.qty)[0];
    return { ...biggest, ratio: avg ? biggest.qty / avg : 0 };
  };

  const buyWall = wall(micro.bids);
  const sellWall = wall(micro.asks);

  // Thin books with one huge order are where spoofing usually shows up.
  const spoofRisk =
    (buyWall?.ratio ?? 0) > 12 || (sellWall?.ratio ?? 0) > 12
      ? "สูง"
      : (buyWall?.ratio ?? 0) > 6 || (sellWall?.ratio ?? 0) > 6
        ? "ปานกลาง"
        : "ต่ำ";

  const liquidityScore = Math.max(
    0,
    Math.min(100, 100 - Math.abs(imbalance) * 0.6 - (spreadPct ?? 0) * 900),
  );

  return { bidSize, askSize, imbalance, spreadPct, buyWall, sellWall, spoofRisk, liquidityScore };
}

export function OrderBookPanel({ micro }: { micro: Micro }) {
  const a = useMemo(() => analyse(micro), [micro]);
  const maxQty = useMemo(
    () => Math.max(...micro.bids.map((b) => b.qty), ...micro.asks.map((x) => x.qty), 0),
    [micro],
  );

  if (!micro.supported) {
    return (
      <Panel title="สมุดคำสั่งและสภาพคล่อง" titleEn="Order Book Intelligence" bodyClassName="p-3">
        <p className="py-8 text-center text-[11px] text-dim">
          ข้อมูลสมุดคำสั่งเชิงลึกมีเฉพาะคู่คริปโต (USDT)
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="สมุดคำสั่งและสภาพคล่อง"
      titleEn="Order Book Intelligence"
      right={
        <Tag tone={a.imbalance >= 0 ? "up" : "down"}>
          {a.imbalance >= 0 ? "แรงซื้อนำ" : "แรงขายนำ"} {Math.abs(a.imbalance).toFixed(0)}%
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1">
        <div>
          <div className="px-1 pb-0.5 text-[8.5px] uppercase tracking-wide text-dim">
            Bids · ฝั่งซื้อ
          </div>
          {micro.bids.slice(0, 8).map((b) => (
            <div key={b.price} className="relative flex justify-between px-1 py-[1.5px] text-[9.5px]">
              <span
                className="absolute inset-y-0 right-0 rounded-sm"
                style={{
                  width: `${maxQty ? (b.qty / maxQty) * 100 : 0}%`,
                  background: "rgba(20,226,160,0.14)",
                }}
              />
              <span className="num relative text-up">{fmtPrice(b.price)}</span>
              <span className="num relative text-muted">{fmtNum(b.qty, 3)}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="px-1 pb-0.5 text-[8.5px] uppercase tracking-wide text-dim">
            Asks · ฝั่งขาย
          </div>
          {micro.asks.slice(0, 8).map((x) => (
            <div key={x.price} className="relative flex justify-between px-1 py-[1.5px] text-[9.5px]">
              <span
                className="absolute inset-y-0 right-0 rounded-sm"
                style={{
                  width: `${maxQty ? (x.qty / maxQty) * 100 : 0}%`,
                  background: "rgba(255,74,104,0.14)",
                }}
              />
              <span className="num relative text-down">{fmtPrice(x.price)}</span>
              <span className="num relative text-muted">{fmtNum(x.qty, 3)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[10px]">
        <span className="flex justify-between">
          <span className="text-dim">Buy Wall</span>
          <span className="num text-up">
            {a.buyWall ? fmtPrice(a.buyWall.price) : "—"}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">Liquidity Wall</span>
          <span className="num text-down">
            {a.sellWall ? fmtPrice(a.sellWall.price) : "—"}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">Spread</span>
          <span className="num text-muted">
            {a.spreadPct === null ? "—" : `${a.spreadPct.toFixed(4)}%`}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">Book Pressure</span>
          <span className={`num ${a.imbalance >= 0 ? "text-up" : "text-down"}`}>
            {a.imbalance >= 0 ? "+" : ""}
            {a.imbalance.toFixed(1)}%
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ปริมาณฝั่งซื้อ</span>
          <span className="num text-muted">{fmtCompact(a.bidSize)}</span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ปริมาณฝั่งขาย</span>
          <span className="num text-muted">{fmtCompact(a.askSize)}</span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">เสี่ยง Spoofing</span>
          <span
            className={
              a.spoofRisk === "สูง" ? "text-down" : a.spoofRisk === "ปานกลาง" ? "text-warn" : "text-up"
            }
          >
            {a.spoofRisk}
          </span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">Liquidity Score</span>
          <span className="num text-brand">{a.liquidityScore.toFixed(0)}/100</span>
        </span>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        AI อ่านว่า{" "}
        {a.sellWall && a.buyWall ? (
          <>
            แนวต้านจากกำแพงขายอยู่ที่ {fmtPrice(a.sellWall.price)} และแนวรับจากกำแพงซื้ออยู่ที่{" "}
            {fmtPrice(a.buyWall.price)}
          </>
        ) : (
          "ยังไม่พบกำแพงคำสั่งที่ชัดเจน"
        )}
        {" "}· ตรวจ Spoofing จากคำสั่งเดี่ยวที่หนากว่าค่าเฉลี่ยผิดปกติ
      </p>
    </Panel>
  );
}
