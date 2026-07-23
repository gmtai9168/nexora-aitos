"use client";

import { fmtCompact, fmtPct, fmtPrice } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import type { Correlation, OnChain } from "@/lib/scoring";
import { findListing } from "@/lib/universe";

function Cell({
  label,
  labelEn,
  value,
  tone,
}: {
  label: string;
  labelEn?: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0 border-l border-line-soft px-2.5 first:border-0 first:pl-0">
      <div className="truncate text-[9px] text-dim">
        {label} {labelEn && <span className="text-[8px]">{labelEn}</span>}
      </div>
      <div className={`num truncate text-[13px] font-bold ${tone ?? "text-txt"}`}>
        {value}
      </div>
    </div>
  );
}

/** The one-line asset dossier that sits under the search bar. */
export function CoinProfile({
  onchain,
  correlations,
  confidence,
}: {
  onchain: OnChain;
  correlations: Correlation[];
  confidence: number;
}) {
  const { symbol, quotes, context, regime } = useMarket();
  const q = quotes.get(symbol);
  const listing = findListing(symbol);
  const nasdaq = correlations.find((c) => c.label === "NASDAQ");
  const gold = correlations.find((c) => c.label === "GOLD");

  const corrTone = (v: number | null | undefined) =>
    v === null || v === undefined ? "text-dim" : v > 0.3 ? "text-warn" : v < -0.3 ? "text-accent-2" : "text-muted";

  return (
    <section className="panel flex flex-wrap items-center gap-y-2 px-3 py-2">
      <div className="flex min-w-[190px] items-center gap-2.5 pr-3">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-bold text-black"
          style={{ background: listing?.color ?? "#6b8497" }}
        >
          {listing?.display.slice(0, 1) ?? "?"}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold">
            {listing?.display ?? symbol}
          </span>
          <span className="block truncate text-[9.5px] text-dim">
            {listing?.nameTh ?? listing?.name ?? symbol}
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-y-2">
        <Cell label="ราคา" labelEn="Price" value={q ? fmtPrice(q.price) : "—"} />
        <Cell
          label="24 ชม."
          labelEn="24H"
          value={q ? fmtPct(q.changePct) : "—"}
          tone={(q?.changePct ?? 0) >= 0 ? "text-up" : "text-down"}
        />
        <Cell
          label="มูลค่าซื้อขาย"
          labelEn="Volume"
          value={q ? fmtCompact(q.quoteVolume) : "—"}
        />
        <Cell
          label="สัญญาคงค้าง"
          labelEn="OI"
          value={
            context.openInterestValue !== null
              ? fmtCompact(context.openInterestValue)
              : "—"
          }
        />
        <Cell
          label="ค่าธรรมเนียม"
          labelEn="Funding"
          value={context.funding === null ? "—" : `${context.funding.toFixed(4)}%`}
          tone={(context.funding ?? 0) >= 0 ? "text-up" : "text-down"}
        />
        <Cell
          label="แรงซื้อรายใหญ่"
          labelEn="Whale"
          value={
            context.whaleBuyShare === null
              ? "—"
              : `${context.whaleBuyShare.toFixed(0)}%`
          }
          tone={(context.whaleBuyShare ?? 50) >= 50 ? "text-up" : "text-down"}
        />
        <Cell
          label="ความผันผวน"
          labelEn="Vol."
          value={regime.volatilityTh}
          tone={regime.volatility === "High" ? "text-warn" : "text-txt"}
        />
        <Cell
          label="สภาวะตลาด"
          labelEn="Regime"
          value={regime.label}
          tone="text-brand"
        />
        <Cell
          label="ความมั่นใจ AI"
          labelEn="Conf."
          value={`${confidence}%`}
          tone="text-brand"
        />
        <Cell
          label="Fear & Greed"
          value={
            onchain.fearGreed === null
              ? "—"
              : `${onchain.fearGreed} ${onchain.fearGreedLabel ?? ""}`
          }
          tone={
            onchain.fearGreed === null
              ? undefined
              : onchain.fearGreed >= 55
                ? "text-up"
                : onchain.fearGreed <= 40
                  ? "text-down"
                  : "text-warn"
          }
        />
        <Cell
          label="สัมพันธ์ NASDAQ"
          value={nasdaq?.value === null || nasdaq === undefined ? "—" : nasdaq.value.toFixed(2)}
          tone={corrTone(nasdaq?.value)}
        />
        <Cell
          label="สัมพันธ์ ทองคำ"
          value={gold?.value === null || gold === undefined ? "—" : gold.value.toFixed(2)}
          tone={corrTone(gold?.value)}
        />
      </div>
    </section>
  );
}
