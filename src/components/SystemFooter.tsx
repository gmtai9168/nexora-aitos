"use client";

import { useEffect, useState } from "react";
import { useMarket, useNow } from "@/lib/market-context";

function Item({
  label,
  value,
  tone = "text-muted",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-dim">{label}</span>
      <span className={`num ${tone}`}>{value}</span>
    </span>
  );
}

export function SystemFooter() {
  const { lastUpdate, connected, exchanges, emergencyStop } = useMarket();
  const [latency, setLatency] = useState<number | null>(null);
  const now = useNow(5000);

  // Round-trip to our own API — a measured number, not a decorative one.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const probe = async () => {
      const started = performance.now();
      try {
        await fetch("/api/quotes?symbols=BTCUSDT", { cache: "no-store" });
        if (!cancelled) setLatency(Math.round(performance.now() - started));
      } catch {
        if (!cancelled) setLatency(null);
      }
      if (!cancelled) timer = setTimeout(probe, 15000);
    };

    timer = setTimeout(probe, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const stale = lastUpdate > 0 && now !== null && now - lastUpdate > 30000;
  const feedOk = connected && !stale;
  const venuesUp = exchanges.filter((e) => e.online).length;
  const exchangeLatency = exchanges.filter((e) => e.online).map((e) => e.latency);
  const bestVenue = exchangeLatency.length ? Math.min(...exchangeLatency) : null;

  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line bg-shell px-3 py-1.5 text-[10px]">
      <span className="flex items-center gap-1.5">
        <span
          className={`size-1.5 rounded-full ${feedOk ? "bg-up dot-live" : "bg-down"}`}
        />
        <span className="text-muted">Singapore · SG-1</span>
      </span>

      <Item
        label="Latency"
        value={latency !== null ? `${latency} ms` : "—"}
        tone={latency !== null && latency < 400 ? "text-up" : "text-warn"}
      />
      <Item
        label="Exchange"
        value={bestVenue !== null ? `${bestVenue} ms` : "—"}
        tone={bestVenue !== null && bestVenue < 800 ? "text-up" : "text-warn"}
      />
      <Item
        label="API"
        value={feedOk ? "Healthy" : "Degraded"}
        tone={feedOk ? "text-up" : "text-down"}
      />
      <Item
        label="Market Data"
        value={feedOk ? "Streaming" : "Reconnecting"}
        tone={feedOk ? "text-up" : "text-down"}
      />
      <Item
        label="Venues"
        value={`${venuesUp}/${exchanges.length || 5}`}
        tone={venuesUp === exchanges.length && venuesUp > 0 ? "text-up" : "text-warn"}
      />
      <Item
        label="Execution"
        value={emergencyStop ? "HALTED" : "Armed"}
        tone={emergencyStop ? "text-down" : "text-up"}
      />

      <span className="ml-auto text-dim">
        NEXORA AITOS™ · ข้อมูลจาก Binance และ Yahoo Finance · ไม่ใช่คำแนะนำการลงทุน
      </span>
      <span className="text-muted">v0.1.0</span>
    </footer>
  );
}
