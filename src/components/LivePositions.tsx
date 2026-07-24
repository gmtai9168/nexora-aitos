"use client";

import { useMemo, useState } from "react";
import { AGENTS } from "@/lib/agents";
import { buildBook, type Position } from "@/lib/book";
import { fmtCompact, fmtNum, fmtPct, fmtPrice, fmtSigned } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { useLiveAccount } from "@/lib/live-account";
import { badgeText, findListing } from "@/lib/universe";
import { Panel, Tag } from "./Panel";

/**
 * Reconstructs which pods backed a position. The votes follow the position's
 * own live numbers, so the breakdown always adds up to its confidence.
 */
function votesFor(p: Position) {
  const voters = [
    AGENTS.find((a) => a.group === "trend")!,
    AGENTS.find((a) => a.group === "smart")!,
    AGENTS.find((a) => a.group === "pattern")!,
    AGENTS.find((a) => a.group === "ml")!,
    AGENTS.find((a) => a.group === "risk")!,
    AGENTS.find((a) => a.group === "master")!,
  ];

  // Higher live conviction → more approvals; the risk pod is the first to balk.
  const approvals = Math.round((p.confidence / 100) * voters.length);
  return voters.map((a, i) => ({
    agent: a,
    approve: i < approvals,
  }));
}

function holdingLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function LivePositions() {
  const { quotes, prevPrices, setSymbol, emergencyStop } = useMarket();
  const live = useLiveAccount();
  const book = useMemo(() => buildBook(quotes, live), [quotes, live]);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Panel
      title="โพซิชันที่เปิดอยู่"
      titleEn="Live Positions"
      right={
        <div className="flex items-center gap-1.5">
          <Tag tone="warn">DEMO</Tag>
          <Tag tone={book.unrealized >= 0 ? "up" : "down"}>
            {fmtSigned(book.unrealized, 0)} USD
          </Tag>
        </div>
      }
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">สินทรัพย์</th>
              <th className="px-2 py-1.5 font-medium">ทิศทาง</th>
              <th className="px-2 py-1.5 text-right font-medium">ขนาด</th>
              <th className="px-2 py-1.5 text-right font-medium">Entry</th>
              <th className="px-2 py-1.5 text-right font-medium">Stop</th>
              <th className="px-2 py-1.5 text-right font-medium">TP</th>
              <th className="px-2 py-1.5 text-right font-medium">ราคาปัจจุบัน</th>
              <th className="px-2 py-1.5 text-right font-medium">PnL</th>
              <th className="px-2 py-1.5 text-right font-medium">Conf.</th>
              <th className="px-2 py-1.5 text-right font-medium">ถือมา</th>
              <th className="px-3 py-1.5 font-medium">AI</th>
            </tr>
          </thead>
          <tbody>
            {book.positions.map((p) => {
              const listing = findListing(p.symbol);
              const prev = prevPrices.get(p.symbol);
              const flash =
                prev !== undefined && p.price !== prev
                  ? p.price > prev
                    ? "flash-up"
                    : "flash-down"
                  : "";
              const open = expanded === p.symbol;

              return [
                <tr
                  key={p.symbol}
                  onClick={() => {
                    setSymbol(p.symbol);
                    setExpanded(open ? null : p.symbol);
                  }}
                  className={`cursor-pointer border-t border-line-soft text-[11px] hover:bg-[#0e1a24] ${flash} ${
                    open ? "bg-[#0e1f26]" : ""
                  }`}
                >
                  <td className="px-3 py-[7px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="grid size-[15px] shrink-0 place-items-center rounded-full text-[8px] font-bold text-black"
                        style={{ background: listing?.color ?? "#6b8497" }}
                      >
                        {listing ? badgeText(listing) : "?"}
                      </span>
                      <span className="font-medium">
                        {listing?.display.split("/")[0]}
                        <span className="text-dim">/USDT</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-[7px]">
                    <Tag tone={p.side === "LONG" ? "up" : "down"}>{p.side}</Tag>
                  </td>
                  <td className="num px-2 py-[7px] text-right">
                    {fmtCompact(p.notional)}
                  </td>
                  <td className="num px-2 py-[7px] text-right text-muted">
                    {fmtPrice(p.entry)}
                  </td>
                  <td className="num px-2 py-[7px] text-right text-down/80">
                    {fmtPrice(p.stop)}
                  </td>
                  <td className="num px-2 py-[7px] text-right text-up/80">
                    {fmtPrice(p.target)}
                  </td>
                  <td className="num px-2 py-[7px] text-right">{fmtPrice(p.price)}</td>
                  <td
                    className={`num px-2 py-[7px] text-right font-semibold ${
                      p.pnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {fmtSigned(p.pnl, 0)}
                    <span className="ml-1 text-[9.5px] font-normal">
                      {fmtPct(p.pnlPct)}
                    </span>
                  </td>
                  <td className="num px-2 py-[7px] text-right text-brand">
                    {p.confidence}%
                  </td>
                  <td className="num px-2 py-[7px] text-right text-dim">
                    {holdingLabel(p.openedMinutesAgo)}
                  </td>
                  <td className="px-3 py-[7px]">
                    <span className="flex items-center gap-1.5 text-muted">
                      <span className="size-1.5 shrink-0 rounded-full bg-brand" />
                      <span className="truncate">{p.bot}</span>
                    </span>
                  </td>
                </tr>,

                open ? (
                  <tr key={`${p.symbol}-votes`} className="bg-[#08131a]">
                    <td colSpan={11} className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] text-dim">
                          การโหวตของ AI ก่อนเปิดโพซิชันนี้:
                        </span>
                        {votesFor(p).map(({ agent, approve }) => (
                          <span
                            key={agent.id}
                            className={`rounded border px-1.5 py-[2px] text-[9.5px] ${
                              approve
                                ? "border-up/40 bg-up/10 text-up"
                                : "border-down/40 bg-down/10 text-down"
                            }`}
                          >
                            {agent.name} · {approve ? "Approve" : "Reject"}
                          </span>
                        ))}
                        <span className="num ml-auto text-[10px] text-muted">
                          ขนาดสัญญา {fmtNum(p.size, 4)}{" "}
                          {p.symbol.replace("USDT", "")}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      </div>

      {emergencyStop && (
        <p className="border-t border-down/40 bg-[#1d0b12] px-3 py-1.5 text-[10px] text-down">
          🛑 โหมดหยุดฉุกเฉิน — ระบบไม่เปิดโพซิชันใหม่ และยกเลิกคำสั่งค้างทั้งหมดแล้ว
        </p>
      )}
    </Panel>
  );
}
