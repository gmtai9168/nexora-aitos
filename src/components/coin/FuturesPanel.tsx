"use client";

import { fmtCompact, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

function Row({
  th,
  en,
  value,
  tone,
  note,
}: {
  th: string;
  en: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line-soft py-[5px] last:border-0">
      <span className="min-w-0">
        <span className="block truncate text-[10.5px] text-muted">{th}</span>
        <span className="block truncate text-[8.5px] text-dim">{en}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`num block text-[11px] font-semibold ${tone ?? "text-txt"}`}>
          {value}
        </span>
        {note && <span className="block text-[8.5px] text-dim">{note}</span>}
      </span>
    </div>
  );
}

export function FuturesPanel() {
  const { context, quotes, symbol } = useMarket();
  const spot = quotes.get(symbol)?.price ?? null;

  // Basis = how far the perpetual mark sits from spot.
  const basis =
    context.markPrice !== null && spot ? ((context.markPrice - spot) / spot) * 100 : null;

  const longAcct = context.longAccount;
  const shortAcct = context.shortAccount;

  // Where crowded leverage would be forced out — a level, not a feed.
  const liqLong = spot ? spot * (1 - 1 / 15) : null;
  const liqShort = spot ? spot * (1 + 1 / 15) : null;

  if (!context.supported) {
    return (
      <Panel title="ข้อมูลฟิวเจอร์ส" titleEn="Futures Intelligence" bodyClassName="p-3">
        <p className="py-8 text-center text-[11px] text-dim">
          สินทรัพย์นี้ไม่มีสัญญาฟิวเจอร์สบน Binance
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="ข้อมูลฟิวเจอร์ส"
      titleEn="Futures Intelligence"
      right={
        <Tag tone={(context.oiChangePct ?? 0) >= 0 ? "up" : "down"}>
          OI {(context.oiChangePct ?? 0) >= 0 ? "เพิ่ม" : "ลด"}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <Row
        th="ค่าธรรมเนียม"
        en="Funding Rate"
        value={context.funding === null ? "—" : `${context.funding.toFixed(4)}%`}
        tone={(context.funding ?? 0) >= 0 ? "text-up" : "text-down"}
        note={
          context.funding === null
            ? undefined
            : Math.abs(context.funding) < 0.005
              ? "Neutral"
              : context.funding > 0
                ? "Long จ่าย Short"
                : "Short จ่าย Long"
        }
      />
      <Row
        th="สัญญาคงค้าง"
        en="Open Interest"
        value={context.openInterest === null ? "—" : fmtCompact(context.openInterest)}
        note={
          context.openInterestValue === null
            ? undefined
            : `${fmtCompact(context.openInterestValue)} USD`
        }
      />
      <Row
        th="OI เปลี่ยนแปลง 1 ชม."
        en="OI Change"
        value={
          context.oiChangePct === null
            ? "—"
            : `${context.oiChangePct >= 0 ? "+" : ""}${context.oiChangePct.toFixed(2)}%`
        }
        tone={(context.oiChangePct ?? 0) >= 0 ? "text-up" : "text-down"}
        note={
          context.oiChangePct === null
            ? undefined
            : context.oiChangePct > 0.3
              ? "Longs Building"
              : context.oiChangePct < -0.3
                ? "กำลังปิดสถานะ"
                : "ทรงตัว"
        }
      />
      <Row
        th="สัดส่วนบัญชี Long/Short"
        en="Long Short Ratio"
        value={
          longAcct === null || shortAcct === null
            ? "—"
            : `${longAcct.toFixed(1)}% / ${shortAcct.toFixed(1)}%`
        }
        tone={(longAcct ?? 50) >= 50 ? "text-up" : "text-down"}
        note={context.longAccount && context.shortAccount ? `ratio ${(context.longAccount / context.shortAccount).toFixed(2)}` : undefined}
      />
      <Row
        th="ราคา Mark"
        en="Mark Price"
        value={context.markPrice === null ? "—" : fmtPrice(context.markPrice)}
      />
      <Row
        th="Basis / Premium"
        en="Perp vs Spot"
        value={basis === null ? "—" : `${basis >= 0 ? "+" : ""}${basis.toFixed(3)}%`}
        tone={(basis ?? 0) >= 0 ? "text-up" : "text-down"}
        note={
          basis === null
            ? undefined
            : Math.abs(basis) < 0.05
              ? "ใกล้เคียงสปอต"
              : basis > 0
                ? "สัญญาแพงกว่าสปอต"
                : "สัญญาถูกกว่าสปอต"
        }
      />
      <Row
        th="โซนบังคับปิด Long"
        en="Liquidation (15X est.)"
        value={liqLong === null ? "—" : fmtPrice(liqLong)}
        tone="text-down"
        note="ประมาณจากเลเวอเรจ 15X"
      />
      <Row
        th="โซนบังคับปิด Short"
        en="Liquidation (15X est.)"
        value={liqShort === null ? "—" : fmtPrice(liqShort)}
        tone="text-up"
        note="ประมาณจากเลเวอเรจ 15X"
      />

      <p className="mt-2 border-t border-line-soft pt-1.5 text-[9px] leading-snug text-dim">
        Funding · OI · Long/Short · Mark มาจาก Binance Futures โดยตรง ·
        โซนบังคับปิดเป็นการคำนวณจากเลเวอเรจมาตรฐาน ไม่ใช่ฟีดการล้างพอร์ตจริง
      </p>
    </Panel>
  );
}
