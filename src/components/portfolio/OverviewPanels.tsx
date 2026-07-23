"use client";

import type { BookSummary } from "@/lib/book";
import { fmtCompact, fmtNum, fmtPct, fmtPrice, fmtSigned } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { Allocation, Exposure, HealthScore } from "@/lib/portfolio-intel";
import { findListing } from "@/lib/universe";
import { Panel, Tag } from "../Panel";
import { Donut, Sparkline } from "../viz";

export function HeaderStats({
  book,
  health,
  drawdown,
  sharpe,
  exp,
}: {
  book: BookSummary;
  health: HealthScore;
  drawdown: number;
  sharpe: number;
  exp: Exposure;
}) {
  const cards: { label: string; en: string; value: string; tone?: string; sub?: string }[] = [
    { label: "มูลค่าพอร์ตรวม", en: "Total Value", value: fmtNum(book.equity, 0), sub: "USD" },
    {
      label: "กำไรวันนี้",
      en: "24H P/L",
      value: fmtSigned(book.dayPnl, 0),
      tone: book.dayPnl >= 0 ? "text-up" : "text-down",
      sub: fmtPct(book.dayPnlPct),
    },
    {
      label: "กำไรสะสม",
      en: "Total P/L",
      value: fmtSigned(book.totalPnl, 0),
      tone: book.totalPnl >= 0 ? "text-up" : "text-down",
      sub: fmtPct(book.totalPnlPct),
    },
    { label: "มาร์จิ้นคงเหลือ", en: "Free Margin", value: fmtCompact(book.availableMargin) },
    {
      label: "การใช้มาร์จิ้น",
      en: "Margin Usage",
      value: `${book.marginRatio.toFixed(1)}%`,
      tone: book.marginRatio > 45 ? "text-warn" : undefined,
    },
    {
      label: "Exposure สุทธิ",
      en: "Net",
      value: `${exp.netPct.toFixed(0)}%`,
      tone: Math.abs(exp.netPct) > 70 ? "text-warn" : undefined,
    },
    { label: "Sharpe", en: "", value: sharpe.toFixed(2), tone: sharpe >= 2 ? "text-up" : undefined },
    {
      label: "Drawdown",
      en: "Max",
      value: `${drawdown.toFixed(2)}%`,
      tone: drawdown > 8 ? "text-down" : drawdown > 4 ? "text-warn" : "text-up",
    },
    {
      label: "สุขภาพพอร์ต",
      en: "Health",
      value: `${health.total}/100`,
      tone: health.total >= 75 ? "text-up" : health.total >= 60 ? "text-warn" : "text-down",
      sub: health.grade,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2.5">
      {cards.map((c) => (
        <div key={c.label} className="panel min-w-0 flex-1 px-2.5 py-1.5">
          <div className="truncate text-[9px] tracking-wide text-dim">
            {c.label} {c.en && <span className="text-[8px]">{c.en}</span>}
          </div>
          <div className={`num truncate text-[15px] font-bold ${c.tone ?? "text-txt"}`}>
            {c.value}
          </div>
          {c.sub && <div className="num truncate text-[8.5px] text-dim">{c.sub}</div>}
        </div>
      ))}
    </div>
  );
}

/** Sections 1 + 14 — headline value, period returns and the health breakdown. */
export function PortfolioOverviewPanel({
  book,
  curve,
  health,
}: {
  book: BookSummary;
  curve: number[];
  health: HealthScore;
}) {
  const up = book.dayPnl >= 0;

  // Period returns read straight off the equity curve we already draw.
  const at = (frac: number) => curve[Math.floor((curve.length - 1) * frac)] ?? curve[0] ?? 0;
  const last = curve.at(-1) ?? book.equity;
  const ret = (from: number) => (from ? ((last - from) / from) * 100 : 0);

  return (
    <Panel
      title="ภาพรวมพอร์ต"
      titleEn="Portfolio Overview"
      right={<Tag tone="warn">DEMO</Tag>}
      bodyClassName="p-2.5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]"
    >
      <div>
        <div className="text-[10px] text-dim">มูลค่าพอร์ตทั้งหมด · Portfolio Value</div>
        <div className="num flex items-baseline gap-1.5">
          <span className="bg-gradient-to-b from-white to-[#9fc9dd] bg-clip-text text-[30px] font-extrabold leading-none text-transparent">
            {fmtNum(book.equity, 0)}
          </span>
          <span className="text-[11px] text-muted">USD</span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-[10px] text-dim">วันนี้</span>
          <span className={`num text-[15px] font-bold ${up ? "text-up" : "text-down"}`}>
            {fmtSigned(book.dayPnl, 0)}
          </span>
          <span className={`num text-[11px] ${up ? "text-up" : "text-down"}`}>
            {fmtPct(book.dayPnlPct)}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[
            { th: "ช่วงต้นกราฟ", en: "Period", v: ret(at(0)) },
            { th: "ครึ่งหลัง", en: "Recent", v: ret(at(0.5)) },
            { th: "ล่าสุด", en: "Latest", v: ret(at(0.85)) },
          ].map((r) => (
            <div key={r.en} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">
              <div className="text-[9px] text-dim">
                {r.th} <span className="text-[8px]">{r.en}</span>
              </div>
              <div className={`num text-[13px] font-bold ${r.v >= 0 ? "text-up" : "text-down"}`}>
                {fmtPct(r.v)}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2">
          <Sparkline values={curve} height={58} stroke={up ? "#14e2a0" : "#ff4a68"} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] text-dim">AI Portfolio Score</span>
          <span
            className={`num text-[24px] font-extrabold ${
              health.total >= 75 ? "text-up" : health.total >= 60 ? "text-warn" : "text-down"
            }`}
          >
            {health.total}
            <span className="text-[11px] font-normal text-dim">/100</span>
          </span>
        </div>
        {health.parts.map((p) => (
          <div key={p.en}>
            <div className="flex justify-between text-[9.5px]">
              <span className="text-muted">{p.th}</span>
              <span className="num text-dim">{p.value.toFixed(0)}</span>
            </div>
            <div className="mt-[2px] h-[3px] overflow-hidden rounded-full bg-[#16242f]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${p.value}%`,
                  background: p.value >= 75 ? "#14e2a0" : p.value >= 55 ? "#ffb020" : "#ff4a68",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Section 3 — allocation donut with the AI's read on the mix. */
export function AllocationPanel({
  rows,
  exp,
}: {
  rows: Allocation[];
  exp: Exposure;
}) {
  const top = rows[0];
  const concentrated = top && top.symbol !== "CASH" && top.pct > 38;

  return (
    <Panel
      title="สัดส่วนการลงทุน"
      titleEn="Portfolio Allocation"
      right={
        <Tag tone={concentrated ? "warn" : "up"}>
          {concentrated ? "กระจุกตัว" : "สมดุล"}
        </Tag>
      }
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-3">
        <Donut
          slices={rows.map((r) => ({ label: r.label, value: r.pct, color: r.color }))}
          size={126}
          thickness={17}
        />
        <ul className="min-w-0 flex-1 space-y-[3px]">
          {rows.map((r) => (
            <li key={r.symbol} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: r.color }}
              />
              <span className="min-w-0 flex-1 truncate text-muted">{r.label}</span>
              <span className="num shrink-0 text-dim">{fmtCompact(r.value)}</span>
              <span className="num w-9 shrink-0 text-right font-bold text-txt">
                {r.pct.toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="border-t border-line-soft pt-1.5 text-[9.5px] leading-snug text-dim">
        {concentrated
          ? `AI อ่านว่าพอร์ตกระจุกตัวใน ${top.label} ที่ ${top.pct.toFixed(1)}% — เกินเกณฑ์ 38%`
          : "AI อ่านว่าสัดส่วนสินทรัพย์อยู่ในเกณฑ์กระจายตัวที่ยอมรับได้"}{" "}
        · เงินสดคงเหลือ {exp.cashPct.toFixed(1)}%
      </p>
    </Panel>
  );
}

/** Section 2 — the live position book. */
export function LivePositionsPanel({ book }: { book: BookSummary }) {
  const { setSymbol, prevPrices } = useMarket();

  return (
    <Panel
      title="สถานะที่เปิดอยู่"
      titleEn="Live Positions"
      right={<Tag tone="warn">DEMO · {book.positions.length}</Tag>}
      bodyClassName="p-0"
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="text-[9px] uppercase tracking-wide text-dim">
              <th className="px-3 py-1.5 font-medium">สินทรัพย์</th>
              <th className="px-2 py-1.5 font-medium">ทิศทาง</th>
              <th className="px-2 py-1.5 text-right font-medium">Entry</th>
              <th className="px-2 py-1.5 text-right font-medium">ปัจจุบัน</th>
              <th className="px-2 py-1.5 text-right font-medium">P/L</th>
              <th className="px-2 py-1.5 text-right font-medium">ขนาด</th>
              <th className="px-2 py-1.5 text-right font-medium">Lev</th>
              <th className="px-3 py-1.5 text-right font-medium">ถือมา</th>
            </tr>
          </thead>
          <tbody>
            {book.positions.map((p) => {
              const l = findListing(p.symbol);
              const prev = prevPrices.get(p.symbol);
              const flash =
                prev !== undefined && p.price !== prev
                  ? p.price > prev
                    ? "flash-up"
                    : "flash-down"
                  : "";
              return (
                <tr
                  key={p.symbol}
                  onClick={() => setSymbol(p.symbol)}
                  className={`cursor-pointer border-t border-line-soft text-[10.5px] hover:bg-[#0e1a24] ${flash}`}
                >
                  <td className="px-3 py-[7px]">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="grid size-[15px] shrink-0 place-items-center rounded-full text-[7.5px] font-bold text-black"
                        style={{ background: l?.color ?? "#6b8497" }}
                      >
                        {l?.display.slice(0, 1)}
                      </span>
                      {p.symbol.replace("USDT", "")}
                    </span>
                  </td>
                  <td className="px-2 py-[7px]">
                    <Tag tone={p.side === "LONG" ? "up" : "down"}>{p.side}</Tag>
                  </td>
                  <td className="num px-2 py-[7px] text-right text-muted">
                    {fmtPrice(p.entry)}
                  </td>
                  <td className="num px-2 py-[7px] text-right">{fmtPrice(p.price)}</td>
                  <td
                    className={`num px-2 py-[7px] text-right font-semibold ${
                      p.pnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {fmtPct(p.pnlPct)}
                    <span className="ml-1 text-[9px] font-normal text-dim">
                      {fmtSigned(p.pnl, 0)}
                    </span>
                  </td>
                  <td className="num px-2 py-[7px] text-right text-muted">
                    {fmtCompact(p.notional)}
                  </td>
                  <td className="num px-2 py-[7px] text-right text-dim">
                    {book.configuredLeverage}X
                  </td>
                  <td className="num px-3 py-[7px] text-right text-dim">
                    {p.openedMinutesAgo >= 60
                      ? `${Math.floor(p.openedMinutesAgo / 60)}h ${p.openedMinutesAgo % 60}m`
                      : `${p.openedMinutesAgo}m`}
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

/** Section 4 — long/short, invested/cash and the volatility split. */
export function ExposurePanel({ exp }: { exp: Exposure }) {
  const bars: { th: string; value: number; color: string }[] = [
    { th: "Long Exposure", value: exp.longPct, color: "#14e2a0" },
    { th: "Short Exposure", value: exp.shortPct, color: "#ff4a68" },
    { th: "ลงทุนแล้ว Invested", value: exp.investedPct, color: "#00d4ff" },
    { th: "เงินสด Cash", value: exp.cashPct, color: "#33505f" },
    { th: "สินทรัพย์เสี่ยงสูง", value: exp.byRisk.high, color: "#ff4a68" },
    { th: "ความเสี่ยงปานกลาง", value: exp.byRisk.medium, color: "#ffb020" },
    { th: "ความเสี่ยงต่ำ", value: exp.byRisk.low, color: "#14e2a0" },
  ];

  return (
    <Panel
      title="วิเคราะห์ Exposure"
      titleEn="Exposure Analysis"
      right={<Tag tone={exp.balanced ? "up" : "warn"}>{exp.balanced ? "สมดุล" : "ต้องปรับ"}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-1.5"
    >
      {bars.map((b) => (
        <div key={b.th}>
          <div className="flex justify-between text-[10px]">
            <span className="text-muted">{b.th}</span>
            <span className="num font-semibold" style={{ color: b.color }}>
              {b.value.toFixed(1)}%
            </span>
          </div>
          <div className="mt-[2px] h-[4px] overflow-hidden rounded-full bg-[#16242f]">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, b.value)}%`, background: b.color }}
            />
          </div>
        </div>
      ))}

      <div className="mt-1 flex items-center justify-between border-t border-line-soft pt-1.5 text-[10px]">
        <span className="text-dim">Net Exposure</span>
        <span className={`num font-bold ${Math.abs(exp.netPct) > 70 ? "text-warn" : "text-txt"}`}>
          {exp.netPct >= 0 ? "+" : ""}
          {exp.netPct.toFixed(1)}%
        </span>
      </div>
      <p className="text-[9.5px] leading-snug text-dim">{exp.verdictTh}</p>
    </Panel>
  );
}
