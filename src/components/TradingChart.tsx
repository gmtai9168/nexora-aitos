"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  IChartApi,
  IPriceLine,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import { ema } from "@/lib/analytics";
import { findFVG, findLiquidity, findOrderBlocks } from "@/lib/decision";
import { fmtCompact, fmtNum, fmtPct, fmtPrice, priceDigits } from "@/lib/format";
import { TIMEFRAMES, useMarket, type Timeframe } from "@/lib/market-context";
import { findListing } from "@/lib/universe";
import { IconCrosshair, IconDots, IconMaximize, IconRefresh, IconStar } from "./icons";

type Refs = {
  chart: IChartApi;
  candles: ISeriesApi<"Candlestick">;
  volume: ISeriesApi<"Histogram">;
  fast: ISeriesApi<"Line">;
  slow: ISeriesApi<"Line">;
  lines: IPriceLine[];
};

const TF_LABEL: Record<Timeframe, string> = {
  "1s": "1S",
  "5s": "5S",
  "15s": "15S",
  "1m": "1M",
  "5m": "5M",
  "15m": "15M",
  "1h": "1H",
  "4h": "4H",
  "1d": "1D",
};

const OVERLAYS = [
  { key: "ob", label: "Order Block", th: "โซนออร์เดอร์" },
  { key: "liq", label: "Liquidity", th: "สภาพคล่อง" },
  { key: "fvg", label: "FVG", th: "ช่องว่างราคา" },
  { key: "funding", label: "Funding", th: "ค่าธรรมเนียม" },
  { key: "oi", label: "OI", th: "สัญญาคงค้าง" },
  { key: "whale", label: "Whale", th: "รายใหญ่" },
  { key: "heat", label: "Heatmap", th: "ความหนาแน่น" },
] as const;

type OverlayKey = (typeof OVERLAYS)[number]["key"];

type Depth = {
  key: string;
  bids: { price: number; qty: number }[];
  asks: { price: number; qty: number }[];
};

/** Right-edge depth column — resting size at each level, scaled to the widest. */
function DepthHeat({ depth }: { depth: Depth | null }) {
  if (!depth || depth.bids.length === 0) return null;
  const rows = [...depth.asks.slice(0, 10).reverse(), ...depth.bids.slice(0, 10)];
  const max = Math.max(...rows.map((r) => r.qty), 0) || 1;

  return (
    <div className="pointer-events-none absolute inset-y-2 right-[62px] flex w-[54px] flex-col justify-center gap-[1px]">
      {rows.map((r, i) => {
        const bid = i >= 10;
        return (
          <span
            key={`${r.price}-${i}`}
            className="h-[3px] rounded-[1px]"
            style={{
              width: `${Math.max(6, (r.qty / max) * 100)}%`,
              marginLeft: "auto",
              background: bid
                ? `rgba(20,226,160,${0.25 + (r.qty / max) * 0.55})`
                : `rgba(255,74,104,${0.25 + (r.qty / max) * 0.55})`,
            }}
          />
        );
      })}
    </div>
  );
}

export function TradingChart() {
  const { symbol, timeframe, setTimeframe, candles, candlesLoading, context } = useMarket();
  const hostRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Refs | null>(null);
  const [active, setActive] = useState<Set<OverlayKey>>(new Set(["ob", "liq"]));
  const [depth, setDepth] = useState<Depth | null>(null);
  const listing = findListing(symbol);

  const toggle = (k: OverlayKey) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // lightweight-charts touches `document` on import, so it loads on the client.
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;

    (async () => {
      const lwc = await import("lightweight-charts");
      const host = hostRef.current;
      if (disposed || !host) return;

      const chart = lwc.createChart(host, {
        layout: {
          background: { color: "transparent" },
          textColor: "#6b8497",
          fontSize: 10,
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "#0f1a23" },
          horzLines: { color: "#0f1a23" },
        },
        rightPriceScale: { borderColor: "#16242f" },
        timeScale: { borderColor: "#16242f", timeVisible: true, secondsVisible: true },
        crosshair: {
          mode: lwc.CrosshairMode.Normal,
          vertLine: { color: "#2c4a5c", labelBackgroundColor: "#16242f" },
          horzLine: { color: "#2c4a5c", labelBackgroundColor: "#16242f" },
        },
        autoSize: false,
      });

      const candleSeries = chart.addSeries(lwc.CandlestickSeries, {
        upColor: "#14e2a0",
        downColor: "#ff4a68",
        wickUpColor: "#14e2a0",
        wickDownColor: "#ff4a68",
        borderVisible: false,
      });

      const volumeSeries = chart.addSeries(lwc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
        lastValueVisible: false,
        priceLineVisible: false,
      });
      chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.86, bottom: 0 } });

      const fast = chart.addSeries(lwc.LineSeries, {
        color: "#ffb020",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      const slow = chart.addSeries(lwc.LineSeries, {
        color: "#a78bfa",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });

      refs.current = {
        chart,
        candles: candleSeries,
        volume: volumeSeries,
        fast,
        slow,
        lines: [],
      };

      const resize = () => chart.resize(host.clientWidth, host.clientHeight);
      resize();
      observer = new ResizeObserver(resize);
      observer.observe(host);
    })();

    return () => {
      disposed = true;
      observer?.disconnect();
      refs.current?.chart.remove();
      refs.current = null;
    };
  }, []);

  useEffect(() => {
    const r = refs.current;
    if (!r || candles.length === 0) return;

    const digits = priceDigits(candles.at(-1)!.close);
    r.candles.applyOptions({
      priceFormat: {
        type: "price",
        precision: digits,
        minMove: Number((10 ** -digits).toFixed(digits)),
      },
    });

    r.candles.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );
    r.volume.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? "rgba(20,226,160,0.3)" : "rgba(255,74,104,0.3)",
      })),
    );

    const closes = candles.map((c) => c.close);
    const f = ema(closes, 12);
    const s = ema(closes, 34);
    r.fast.setData(candles.map((c, i) => ({ time: c.time as UTCTimestamp, value: f[i] })));
    r.slow.setData(candles.map((c, i) => ({ time: c.time as UTCTimestamp, value: s[i] })));
  }, [candles]);

  // Structural overlays are drawn as price lines and fully rebuilt on toggle.
  useEffect(() => {
    const r = refs.current;
    if (!r) return;

    for (const line of r.lines) r.candles.removePriceLine(line);
    r.lines = [];
    if (candles.length < 20) return;

    const add = (price: number, color: string, title: string) => {
      r.lines.push(
        r.candles.createPriceLine({
          price,
          color,
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title,
        }),
      );
    };

    if (active.has("ob")) {
      for (const ob of findOrderBlocks(candles, 3)) {
        const c = ob.bull ? "rgba(20,226,160,0.55)" : "rgba(255,74,104,0.55)";
        add(ob.top, c, "OB");
        add(ob.bottom, c, "");
      }
    }
    if (active.has("fvg")) {
      for (const g of findFVG(candles, 4)) {
        const c = g.bull ? "rgba(0,212,255,0.5)" : "rgba(255,143,61,0.5)";
        add(g.top, c, "FVG");
        add(g.bottom, c, "");
      }
    }
    if (active.has("liq")) {
      for (const l of findLiquidity(candles, 3)) {
        add(
          l.price,
          l.side === "sell" ? "rgba(255,74,104,0.45)" : "rgba(20,226,160,0.45)",
          "LIQ",
        );
      }
    }
  }, [active, candles]);

  useEffect(() => {
    refs.current?.chart.timeScale().fitContent();
  }, [symbol, timeframe]);

  // Order-book depth only loads while the heatmap overlay is on. The snapshot
  // carries its symbol so a stale book is never drawn over a new one.
  const heatOn = active.has("heat");
  useEffect(() => {
    if (!heatOn) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/microstructure?symbol=${symbol}`);
        const data = await res.json();
        if (!cancelled && data.supported) {
          setDepth({ key: symbol, bids: data.bids ?? [], asks: data.asks ?? [] });
        }
      } catch {
        /* keep the last depth snapshot */
      }
      if (!cancelled) timer = setTimeout(load, 8000);
    };

    timer = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [heatOn, symbol]);

  const last = candles.at(-1);
  const diff = last ? last.close - last.open : 0;
  const diffPct = last && last.open ? (diff / last.open) * 100 : 0;

  const strips = useMemo(() => {
    const out: { key: OverlayKey; label: string; value: string; tone: string }[] = [];
    if (active.has("funding")) {
      out.push({
        key: "funding",
        label: "Funding",
        value: context.funding === null ? "—" : `${context.funding.toFixed(4)}%`,
        tone: (context.funding ?? 0) >= 0 ? "text-up" : "text-down",
      });
    }
    if (active.has("oi")) {
      out.push({
        key: "oi",
        label: "Open Interest",
        value:
          context.openInterest === null
            ? "—"
            : `${fmtCompact(context.openInterest)} (${context.oiChangePct === null ? "—" : fmtPct(context.oiChangePct)})`,
        tone: (context.oiChangePct ?? 0) >= 0 ? "text-up" : "text-down",
      });
    }
    if (active.has("whale")) {
      out.push({
        key: "whale",
        label: "Whale Buy",
        value:
          context.whaleBuyShare === null
            ? "—"
            : `${context.whaleBuyShare.toFixed(1)}% · ${fmtCompact(context.whaleNotional ?? 0)}`,
        tone: (context.whaleBuyShare ?? 50) >= 50 ? "text-up" : "text-down",
      });
    }
    return out;
  }, [active, context]);

  return (
    <section className="panel flex min-w-0 flex-1 flex-col">
      <div className="panel-head flex-wrap gap-y-1.5">
        <h2 className="flex items-baseline gap-1.5 text-[12.5px] font-semibold">
          กราฟราคา
          <span className="text-brand">{listing?.display ?? symbol}</span>
        </h2>

        <div className="flex items-center gap-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded px-[6px] py-[3px] text-[9.5px] font-semibold transition-colors ${
                timeframe === tf
                  ? "bg-brand text-black"
                  : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {TF_LABEL[tf]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2 text-dim">
          <IconCrosshair size={14} className="hover:text-txt" />
          <IconStar size={14} className="hover:text-txt" />
          <IconRefresh size={14} className="hover:text-txt" />
          <IconMaximize size={14} className="hover:text-txt" />
          <IconDots size={14} className="hover:text-txt" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b border-line-soft px-2 py-1.5">
        <span className="mr-1 text-[9px] text-dim">OVERLAY</span>
        {OVERLAYS.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => toggle(o.key)}
            title={o.th}
            className={`rounded border px-1.5 py-[2px] text-[9.5px] transition-colors ${
              active.has(o.key)
                ? "border-brand/50 bg-[#062a38] text-brand"
                : "border-line text-dim hover:text-muted"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="num flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 py-1.5 text-[10.5px]">
        {last ? (
          <>
            <span className="text-dim">
              O <span className="text-muted">{fmtPrice(last.open)}</span>
            </span>
            <span className="text-dim">
              H <span className="text-up">{fmtPrice(last.high)}</span>
            </span>
            <span className="text-dim">
              L <span className="text-down">{fmtPrice(last.low)}</span>
            </span>
            <span className="text-dim">
              C <span className="text-txt">{fmtPrice(last.close)}</span>
            </span>
            <span className={diff >= 0 ? "text-up" : "text-down"}>
              {diff >= 0 ? "+" : ""}
              {fmtPrice(diff)} ({fmtPct(diffPct)})
            </span>
            <span className="text-dim">
              V <span className="text-muted">{fmtNum(last.volume, 2)}</span>
            </span>
            {strips.map((s) => (
              <span key={s.key} className="text-dim">
                {s.label} <span className={s.tone}>{s.value}</span>
              </span>
            ))}
            <span className="ml-auto text-dim">
              <span className="text-warn">EMA12</span> ·{" "}
              <span className="text-[#a78bfa]">EMA34</span>
            </span>
          </>
        ) : (
          <span className="text-dim">
            {candlesLoading ? "กำลังโหลดแท่งเทียน…" : "ไม่มีข้อมูลแท่งเทียน"}
          </span>
        )}
      </div>

      <div className="relative min-h-[330px] flex-1">
        <div ref={hostRef} className="absolute inset-0 min-w-0" />
        {heatOn && <DepthHeat depth={depth?.key === symbol ? depth : null} />}
      </div>
    </section>
  );
}
