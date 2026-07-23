"use client";

import { useMemo, useState } from "react";
import { STATUS_META, type OrderStatus } from "@/lib/execution";
import { fmtNum, fmtPrice } from "@/lib/format";
import { Panel, Tag } from "../Panel";
import { useExec } from "./ExecProvider";

const FILTERS: { key: "all" | OrderStatus; th: string }[] = [
  { key: "all", th: "ทั้งหมด" },
  { key: "pending", th: "รอส่ง" },
  { key: "filled", th: "จับคู่ครบ" },
  { key: "partial", th: "บางส่วน" },
  { key: "cancelled", th: "ยกเลิก" },
  { key: "rejected", th: "ถูกปฏิเสธ" },
];

/** Sections 3 — the live order blotter with status filters. */
export function ActiveOrders() {
  const { orders, selected, select, cancel } = useExec();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const rows = useMemo(
    () =>
      orders.filter((o) =>
        filter === "all"
          ? true
          : filter === "pending"
            ? ["pending", "routing", "sent", "accepted"].includes(o.status)
            : o.status === filter,
      ),
    [orders, filter],
  );

  return (
    <Panel
      title="คำสั่งที่กำลังทำงาน"
      titleEn="Active Orders"
      right={
        <div className="flex flex-wrap gap-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded px-1.5 py-[2px] text-[9px] ${
                filter === f.key
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {f.th}
            </button>
          ))}
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="max-h-[300px] overflow-auto">
        <table className="w-full min-w-[700px] border-collapse text-left">
          <thead className="sticky top-0 bg-panel">
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-2.5 py-1.5 font-medium">ID</th>
              <th className="px-2 py-1.5 font-medium">สินทรัพย์</th>
              <th className="px-2 py-1.5 font-medium">ทิศทาง</th>
              <th className="px-2 py-1.5 text-right font-medium">จำนวน</th>
              <th className="px-2 py-1.5 text-right font-medium">ราคาที่ได้</th>
              <th className="px-2 py-1.5 text-right font-medium">Fill</th>
              <th className="px-2 py-1.5 text-right font-medium">Slip</th>
              <th className="px-2 py-1.5 text-right font-medium">Latency</th>
              <th className="px-2 py-1.5 font-medium">Exchange</th>
              <th className="px-2 py-1.5 font-medium">สถานะ</th>
              <th className="px-2 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-[11px] text-dim">
                  ยังไม่มีคำสั่งในหมวดนี้
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const meta = STATUS_META[o.status];
              const pct = o.qty ? (o.filledQty / o.qty) * 100 : 0;
              return (
                <tr
                  key={o.id}
                  onClick={() => select(o.id)}
                  className={`cursor-pointer border-t border-line-soft text-[10.5px] hover:bg-[#0e1a24] ${
                    selected?.id === o.id ? "bg-[#0e1f26]" : ""
                  }`}
                >
                  <td className="num px-2.5 py-[6px] text-dim">{o.id}</td>
                  <td className="px-2 py-[6px]">{o.symbol.replace("USDT", "")}</td>
                  <td className="px-2 py-[6px]">
                    <Tag tone={o.side === "BUY" ? "up" : "down"}>{o.side}</Tag>
                  </td>
                  <td className="num px-2 py-[6px] text-right">{fmtNum(o.qty, 5)}</td>
                  <td className="num px-2 py-[6px] text-right">
                    {o.avgFillPrice ? fmtPrice(o.avgFillPrice) : "—"}
                  </td>
                  <td className="px-2 py-[6px]">
                    <span className="flex items-center justify-end gap-1">
                      <span className="h-[3px] w-7 overflow-hidden rounded-full bg-[#16242f]">
                        <span
                          className="block h-full rounded-full bg-up"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="num w-7 text-right text-[9.5px]">
                        {pct.toFixed(0)}%
                      </span>
                    </span>
                  </td>
                  <td
                    className={`num px-2 py-[6px] text-right ${
                      (o.slippagePct ?? 0) > 0.05 ? "text-warn" : "text-muted"
                    }`}
                  >
                    {o.slippagePct === null ? "—" : `${o.slippagePct.toFixed(3)}%`}
                  </td>
                  <td className="num px-2 py-[6px] text-right text-muted">
                    {o.venueLatency ? `${o.venueLatency}ms` : "—"}
                  </td>
                  <td className="px-2 py-[6px] text-muted">{o.venue}</td>
                  <td className="px-2 py-[6px]">
                    <Tag tone={meta.tone}>{meta.th}</Tag>
                  </td>
                  <td className="px-2 py-[6px] text-right">
                    {["pending", "routing", "sent", "accepted"].includes(o.status) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancel(o.id);
                        }}
                        className="rounded border border-line px-1.5 py-[1px] text-[9px] text-muted hover:border-down/50 hover:text-down"
                      >
                        ยกเลิก
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/** Sections 4 + 8 — full order record, raw venue response, and the routing rationale. */
export function OrderDetail() {
  const { selected, routing } = useExec();
  const [explain, setExplain] = useState(false);

  if (!selected) {
    return (
      <Panel title="รายละเอียดคำสั่ง" titleEn="Order Detail" bodyClassName="p-3">
        <p className="py-10 text-center text-[11px] text-dim">
          เลือกคำสั่งจากตารางเพื่อดูรายละเอียดทั้งหมด
        </p>
      </Panel>
    );
  }

  const o = selected;
  const notional = o.filledQty * (o.avgFillPrice ?? 0);

  const rows: [string, string][] = [
    ["Order ID", o.id],
    ["Exchange", o.venue],
    ["ประเภท Type", o.type],
    ["ทิศทาง Side", o.side],
    ["จำนวนสั่ง Size", fmtNum(o.qty, 6)],
    ["จับคู่แล้ว Filled", fmtNum(o.filledQty, 6)],
    ["ราคาเฉลี่ย Avg Price", o.avgFillPrice ? fmtPrice(o.avgFillPrice) : "—"],
    ["ราคาจำกัด Limit", o.limitPrice ? fmtPrice(o.limitPrice) : "—"],
    ["Slippage", o.slippagePct === null ? "—" : `${o.slippagePct.toFixed(4)}%`],
    ["Latency", o.venueLatency ? `${o.venueLatency} ms` : "—"],
    ["ค่าธรรมเนียม Fee", `${o.feePct}% · ${o.feePaid.toFixed(4)} USDT`],
    ["มูลค่า Notional", notional ? fmtPrice(notional) : "—"],
    ["Reduce Only", o.reduceOnly ? "ใช่" : "ไม่"],
    ["Post Only", o.postOnly ? "ใช่" : "ไม่"],
    ["Take Profit", o.takeProfit ? fmtPrice(o.takeProfit) : "—"],
    ["Stop Loss", o.stopLoss ? fmtPrice(o.stopLoss) : "—"],
    ["สั่งโดย Source", `${o.source} · ${o.aiName}`],
  ];

  return (
    <Panel
      title="รายละเอียดคำสั่ง"
      titleEn="Order Detail"
      right={<Tag tone={STATUS_META[o.status].tone}>{STATUS_META[o.status].th}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-x-3">
        {rows.map(([k, v]) => (
          <span key={k} className="flex justify-between border-b border-line-soft py-[3px] text-[10px]">
            <span className="truncate text-dim">{k}</span>
            <span className="num truncate pl-1 text-txt">{v}</span>
          </span>
        ))}
      </div>

      <div className="rounded border border-line-soft bg-[#08111a] px-2.5 py-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9.5px] text-brand">Exchange Response</span>
          {o.response && (
            <Tag tone={o.response.ok ? "up" : "down"}>{o.response.code}</Tag>
          )}
        </div>
        <pre className="num overflow-x-auto text-[9.5px] leading-relaxed text-muted">
{JSON.stringify(
  {
    orderId: o.id,
    status: o.status,
    venue: o.venue,
    code: o.response?.code ?? "PENDING",
    message: o.response?.message ?? "waiting for venue",
    executedQty: Number(o.filledQty.toFixed(6)),
    avgPrice: o.avgFillPrice ? Number(o.avgFillPrice.toFixed(2)) : null,
    latencyMs: o.venueLatency,
  },
  null,
  1,
)}
        </pre>
      </div>

      <button
        type="button"
        onClick={() => setExplain((v) => !v)}
        className="rounded border border-brand/40 bg-[#062a38] py-1.5 text-[10.5px] font-semibold text-brand hover:bg-[#083545]"
      >
        {explain ? "ปิดคำอธิบาย" : "Explain Execution — ทำไมส่งไปตลาดนี้"}
      </button>

      {explain && (
        <div className="space-y-1.5 rounded border border-line-soft bg-[#08111a] p-2.5">
          <p className="text-[10.5px] leading-relaxed text-muted">{o.routingReason}</p>
          {routing && routing.ranked.length > 1 && (
            <ul className="space-y-[3px] border-t border-line-soft pt-1.5">
              {routing.ranked.map((r, i) => (
                <li key={r.venue.id} className="flex items-center gap-2 text-[9.5px]">
                  <span className="num w-3 text-dim">{i + 1}</span>
                  <span className="w-[68px] truncate text-muted">{r.venue.name}</span>
                  <span className="num w-[74px] text-right text-txt">
                    {r.venue.price ? fmtPrice(r.venue.price) : "—"}
                  </span>
                  <span className="num w-[46px] text-right text-dim">{r.venue.latency}ms</span>
                  <span className="num w-[42px] text-right text-dim">{r.venue.fee}%</span>
                  <span className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#16242f]">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.min(100, r.score)}%` }}
                    />
                  </span>
                  <span className="num w-7 text-right text-brand">{r.score.toFixed(0)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[9px] text-dim">
            คะแนน = ความได้เปรียบด้านราคา 45% · ความหน่วง 25% · ค่าธรรมเนียม 15% ·
            ความลึกของราคา 15% — ทุกค่าเป็นการวัดจริงจาก public API ของแต่ละ exchange
          </p>
          <p className="text-[9px] leading-snug text-warn/80">
            ข้อจำกัด: ระบบมีสมุดคำสั่งเชิงลึกเฉพาะของ Binance ราคาที่จับคู่จึงคำนวณจากสมุดของ
            Binance เสมอ แม้การเลือกตลาดจะชี้ไป venue อื่น — การเชื่อม depth ของทุก venue
            ต้องใช้ WebSocket แยกต่อ exchange
          </p>
        </div>
      )}
    </Panel>
  );
}
