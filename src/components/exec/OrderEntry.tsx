"use client";

import { useState } from "react";
import { ORDER_TYPES, type OrderSide, type OrderType } from "@/lib/execution";
import { fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";
import { useExec } from "./ExecProvider";

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between py-[3px] text-[10px]"
    >
      <span className="text-muted">{label}</span>
      <span
        className={`relative h-[14px] w-[26px] rounded-full transition-colors ${
          on ? "bg-up/70" : "bg-[#1b2833]"
        }`}
      >
        <span
          className={`absolute top-[2px] size-[10px] rounded-full bg-white transition-all ${
            on ? "left-[14px]" : "left-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

/** Smart Order Entry — market/limit/stop/OCO/TWAP/VWAP with TP·SL and flags. */
export function OrderEntry() {
  const { symbol, quotes, emergencyStop } = useMarket();
  const { submit, depth } = useExec();

  const [side, setSide] = useState<OrderSide>("BUY");
  const [type, setType] = useState<OrderType>("MARKET");
  const [qtyPct, setQtyPct] = useState(25);
  const [limit, setLimit] = useState("");
  const [tp, setTp] = useState("");
  const [sl, setSl] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [postOnly, setPostOnly] = useState(false);

  const price = quotes.get(symbol)?.price ?? 0;
  const base = symbol.replace(/USDT$/, "");

  // Size is a share of what the visible book can absorb, so the simulated
  // fill always has real depth behind it.
  const bookQty = (side === "BUY" ? depth.asks : depth.bids)
    .slice(0, 10)
    .reduce((a, l) => a + l.qty, 0);
  const qty = Number(((bookQty * qtyPct) / 100).toFixed(6));
  const notional = qty * price;

  const send = () => {
    if (qty <= 0) return;
    submit({
      side,
      type,
      qty,
      limitPrice: limit ? Number(limit) : type === "MARKET" ? null : price,
      reduceOnly,
      postOnly,
      takeProfit: tp ? Number(tp) : null,
      stopLoss: sl ? Number(sl) : null,
      source: "MANUAL",
    });
  };

  return (
    <Panel
      title="ส่งคำสั่งอัจฉริยะ"
      titleEn="Smart Order Entry"
      right={<Tag tone="warn">PAPER · ไม่ส่งออกจริง</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex gap-0.5">
        {ORDER_TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(t.key)}
            className={`flex-1 rounded px-1 py-[3px] text-[9.5px] transition-colors ${
              type === t.key
                ? "bg-brand text-black"
                : "text-muted hover:bg-[#0f1c26] hover:text-txt"
            }`}
          >
            {t.key}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => setSide("BUY")}
          className={`rounded py-1.5 text-[11px] font-bold ${
            side === "BUY" ? "bg-up text-black" : "border border-line bg-[#0d1922] text-muted"
          }`}
        >
          BUY / LONG
        </button>
        <button
          type="button"
          onClick={() => setSide("SELL")}
          className={`rounded py-1.5 text-[11px] font-bold ${
            side === "SELL" ? "bg-down text-black" : "border border-line bg-[#0d1922] text-muted"
          }`}
        >
          SELL / SHORT
        </button>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-[9.5px]">
          <span className="text-dim">ขนาด (สัดส่วนของสภาพคล่องที่มองเห็น)</span>
          <span className="num text-txt">{qtyPct}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={100}
          value={qtyPct}
          onChange={(e) => setQtyPct(Number(e.target.value))}
          className="w-full accent-[#00d4ff]"
        />
        <div className="flex justify-between text-[9.5px]">
          <span className="num text-muted">
            {qty} {base}
          </span>
          <span className="num text-dim">
            ≈ {notional ? fmtPrice(notional) : "—"} USDT
          </span>
        </div>
      </div>

      {type !== "MARKET" && (
        <label className="block">
          <span className="text-[9.5px] text-dim">ราคาที่ต้องการ (Limit)</span>
          <input
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder={price ? fmtPrice(price) : ""}
            inputMode="decimal"
            className="chip num w-full px-2 py-1 text-[11px] text-txt outline-none"
          />
        </label>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="text-[9.5px] text-up">Take Profit</span>
          <input
            value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder={price ? fmtPrice(price * 1.02) : ""}
            inputMode="decimal"
            className="chip num w-full px-2 py-1 text-[11px] text-txt outline-none"
          />
        </label>
        <label className="block">
          <span className="text-[9.5px] text-down">Stop Loss</span>
          <input
            value={sl}
            onChange={(e) => setSl(e.target.value)}
            placeholder={price ? fmtPrice(price * 0.99) : ""}
            inputMode="decimal"
            className="chip num w-full px-2 py-1 text-[11px] text-txt outline-none"
          />
        </label>
      </div>

      <div className="rounded border border-line-soft bg-[#08111a] px-2 py-1">
        <Toggle label="Reduce Only" on={reduceOnly} onChange={setReduceOnly} />
        <Toggle label="Post Only (Maker)" on={postOnly} onChange={setPostOnly} />
      </div>

      <button
        type="button"
        onClick={send}
        disabled={emergencyStop || qty <= 0}
        className={`rounded py-2 text-[12px] font-bold transition-colors ${
          emergencyStop || qty <= 0
            ? "cursor-not-allowed bg-[#16242f] text-dim"
            : side === "BUY"
              ? "bg-up text-black hover:brightness-110"
              : "bg-down text-black hover:brightness-110"
        }`}
      >
        {emergencyStop
          ? "ระบบหยุดฉุกเฉิน"
          : `${side} ${base} · ${type}`}
      </button>

      <p className="text-[9px] leading-snug text-dim">
        คำสั่งจะถูกจำลองการจับคู่กับสมุดคำสั่งจริงของ Binance ณ ขณะนั้น —
        ราคาที่ได้ สลิปเพจ และเวลาตอบสนอง คำนวณจากข้อมูลจริง
        แต่ไม่มีคำสั่งใดถูกส่งออกไปยัง exchange
      </p>
    </Panel>
  );
}
