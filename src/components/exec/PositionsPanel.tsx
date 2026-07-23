"use client";

import { fmtNum, fmtPct, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";
import { useExec } from "./ExecProvider";

/** Sections 5 + 12 — live position book with partial-close controls. */
export function PositionManager() {
  const { positions, closePosition } = useExec();
  const { quotes } = useMarket();

  return (
    <Panel
      title="ผู้จัดการสถานะ"
      titleEn="Position Manager"
      right={<Tag tone="warn">PAPER · {positions.length} สถานะ</Tag>}
      bodyClassName="p-0"
    >
      {positions.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] text-dim">
          ยังไม่มีสถานะเปิด — คำสั่งที่จับคู่แล้วจะรวมเป็นสถานะที่นี่
        </p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {positions.map((p) => {
            const mark = quotes.get(p.symbol)?.price ?? p.entry;
            const dir = p.side === "LONG" ? 1 : -1;
            const pnlPct = p.entry ? ((mark - p.entry) / p.entry) * 100 * dir : 0;
            const pnl = p.qty * (mark - p.entry) * dir;
            const beActive = pnlPct > 0.4;

            return (
              <li key={p.symbol} className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[11.5px] font-semibold">
                    {p.symbol.replace("USDT", "")}
                    <span className="text-dim">/USDT</span>
                  </span>
                  <Tag tone={p.side === "LONG" ? "up" : "down"}>{p.side}</Tag>
                  <span className="num text-[10.5px] text-muted">
                    {fmtNum(p.qty, 5)} @ {fmtPrice(p.entry)}
                  </span>
                  <span className="num text-[10.5px] text-dim">
                    Mark {fmtPrice(mark)}
                  </span>
                  <span
                    className={`num ml-auto text-[12px] font-bold ${
                      pnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {fmtPrice(pnl)}
                    <span className="ml-1 text-[10px] font-normal">{fmtPct(pnlPct)}</span>
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px]">
                  <span className="text-dim">
                    Trailing Stop{" "}
                    <span className={beActive ? "text-up" : "text-muted"}>
                      {beActive ? "ทำงาน" : "รอกำไร 0.4%"}
                    </span>
                  </span>
                  <span className="text-dim">
                    Break Even{" "}
                    <span className={beActive ? "text-up" : "text-muted"}>
                      {beActive ? "ย้ายแล้ว" : "ยังไม่ย้าย"}
                    </span>
                  </span>
                  <span className="text-dim">
                    AI แนะนำ{" "}
                    <span className={pnlPct > 1.5 ? "text-warn" : "text-up"}>
                      {pnlPct > 1.5 ? "ทยอยปิดบางส่วน" : pnlPct < -1 ? "พิจารณาตัดขาดทุน" : "ถือต่อ"}
                    </span>
                  </span>

                  <span className="ml-auto flex gap-1">
                    {[0.2, 0.3, 0.5, 1].map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => closePosition(p.symbol, f)}
                        className="rounded border border-line bg-[#0d1922] px-1.5 py-[2px] text-[9px] text-muted hover:border-down/50 hover:text-down"
                      >
                        ปิด {f * 100}%
                      </button>
                    ))}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/** Section 6 — the exit ladder the engine would manage for the open position. */
export function TpSlManager() {
  const { positions } = useExec();
  const { quotes, decision } = useMarket();

  const p = positions[0];
  if (!p) {
    return (
      <Panel title="จัดการ TP / SL" titleEn="TP / SL Manager" bodyClassName="p-3">
        <p className="py-10 text-center text-[11px] text-dim">
          ยังไม่มีสถานะเปิดให้จัดการ
        </p>
      </Panel>
    );
  }

  const mark = quotes.get(p.symbol)?.price ?? p.entry;
  const dir = p.side === "LONG" ? 1 : -1;
  const risk = p.entry * 0.012;
  const sl = p.entry - dir * risk;
  const rr = decision?.riskReward ?? 2;
  const targets = [1, 2, 3].map((n) => ({
    label: `TP${n}`,
    price: p.entry + dir * risk * rr * (n / 2 + 0.25),
    hit: dir === 1 ? mark >= p.entry + dir * risk * rr * (n / 2 + 0.25) : mark <= p.entry + dir * risk * rr * (n / 2 + 0.25),
  }));

  return (
    <Panel
      title="จัดการ TP / SL"
      titleEn="TP / SL Manager"
      right={<Tag tone="up">RR 1 : {rr}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-baseline justify-between text-[10.5px]">
        <span className="text-muted">
          {p.symbol.replace("USDT", "")} · {p.side}
        </span>
        <span className="num text-dim">Entry {fmtPrice(p.entry)}</span>
      </div>

      <ul className="space-y-[3px]">
        {targets.map((t) => (
          <li key={t.label} className="flex items-center gap-2 text-[10.5px]">
            <span className="w-8 shrink-0 text-up">{t.label}</span>
            <span className="num flex-1 text-txt">{fmtPrice(t.price)}</span>
            <Tag tone={t.hit ? "up" : "neutral"}>{t.hit ? "ถึงเป้าแล้ว" : "รออยู่"}</Tag>
          </li>
        ))}
        <li className="flex items-center gap-2 border-t border-line-soft pt-1.5 text-[10.5px]">
          <span className="w-8 shrink-0 text-down">SL</span>
          <span className="num flex-1 text-txt">{fmtPrice(sl)}</span>
          <Tag tone="down">ตัดขาดทุน</Tag>
        </li>
      </ul>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line-soft pt-2 text-[10px]">
        <span className="flex justify-between">
          <span className="text-dim">Probability</span>
          <span className="num text-up">{decision?.expectedWinRate ?? "—"}%</span>
        </span>
        <span className="flex justify-between">
          <span className="text-dim">ราคาปัจจุบัน</span>
          <span className="num text-txt">{fmtPrice(mark)}</span>
        </span>
      </div>

      <p className="text-[9px] leading-snug text-dim">
        ระดับ TP/SL คำนวณจากราคาเข้าจริงของสถานะนี้และอัตราส่วนผลตอบแทนต่อความเสี่ยง
        ที่ Master AI ประเมินไว้ล่าสุด — หากแรงซื้อรายใหญ่พลิกฝั่ง ระบบจะเลื่อนระดับเหล่านี้ตาม
      </p>
    </Panel>
  );
}
