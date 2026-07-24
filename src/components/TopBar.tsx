"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bkkTime } from "@/lib/format";
import { useMarket, useNow } from "@/lib/market-context";
import { useUi } from "@/lib/ui-context";
import { TOTAL_AGENTS } from "@/lib/agents";
import { ALL_LISTINGS, badgeText } from "@/lib/universe";
import { IconChevronDown, IconSearch, IconBell, IconMaximize, IconMenu } from "./icons";
import { LogoLockup } from "./Logo";

function SymbolSearch() {
  const { setSymbol, symbol } = useMarket();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return ALL_LISTINGS.filter(
      (l) =>
        l.display.toLowerCase().includes(q) ||
        l.symbol.toLowerCase().includes(q) ||
        l.name.toLowerCase().includes(q) ||
        (l.nameTh ?? "").includes(query.trim()),
    ).slice(0, 8);
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const choose = (s: string) => {
    setSymbol(s);
    setQuery("");
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative w-[130px] sm:w-[190px] lg:w-[220px]">
      <label className="chip flex items-center gap-1.5 px-2 py-[5px]">
        <IconSearch size={13} className="shrink-0 text-dim" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) choose(results[0].symbol);
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder="ค้นหา BTC · XAU · NVDA …"
          className="w-full bg-transparent text-[11px] text-txt outline-none placeholder:text-dim"
        />
        <span className="shrink-0 text-[9px] text-dim">{symbol}</span>
      </label>

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-line bg-panel-2 shadow-2xl">
          {results.map((l) => (
            <li key={l.symbol}>
              <button
                type="button"
                onClick={() => choose(l.symbol)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left hover:bg-[#12222d]"
              >
                <span
                  className="grid size-[16px] shrink-0 place-items-center rounded text-[8px] font-bold text-black"
                  style={{ background: l.color }}
                >
                  {badgeText(l)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px]">{l.display}</span>
                <span className="shrink-0 truncate text-[9px] text-dim">
                  {l.nameTh ?? l.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ExchangeStrip() {
  const { exchanges } = useMarket();

  if (exchanges.length === 0) {
    return <span className="text-[9.5px] text-dim">กำลังตรวจ Exchange…</span>;
  }

  return (
    <div className="flex items-center gap-2">
      {exchanges.map((e) => (
        <span
          key={e.id}
          title={
            e.online
              ? `${e.name} · ${e.latency}ms`
              : `${e.name} · เชื่อมต่อไม่ได้ (${e.status || "timeout"})`
          }
          className="flex items-center gap-1 text-[9.5px]"
        >
          <span
            className={`size-1.5 rounded-full ${e.online ? "bg-up dot-live" : "bg-down"}`}
          />
          <span className={e.online ? "text-muted" : "text-down"}>{e.name}</span>
        </span>
      ))}
    </div>
  );
}

function AiChip() {
  const { connected, emergencyStop } = useMarket();
  const online = emergencyStop ? 0 : connected ? TOTAL_AGENTS : 0;

  return (
    <Link
      href="/ai-network"
      className="chip flex items-center gap-2 px-2.5 py-1 transition-colors hover:border-brand/50"
    >
      <span className="relative grid size-[22px] place-items-center">
        <svg viewBox="0 0 36 36" className="size-[22px] -rotate-90">
          <circle cx="18" cy="18" r="15" stroke="#16242f" strokeWidth="4" fill="none" />
          <circle
            cx="18"
            cy="18"
            r="15"
            stroke={online === TOTAL_AGENTS ? "#10e08a" : "#ff4a68"}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(online / TOTAL_AGENTS) * 94.2} 94.2`}
          />
        </svg>
      </span>
      <span className="leading-tight">
        <span className="block text-[8.5px] tracking-wide text-dim">AI ONLINE</span>
        <span
          className={`num block text-[12px] font-bold ${
            online === TOTAL_AGENTS ? "text-up" : "text-down"
          }`}
        >
          {online} / {TOTAL_AGENTS}
        </span>
      </span>
    </Link>
  );
}

type Note = { id: string; from: string; text: string; meta: string; tone: "up" | "down" | "warn" };

function Notifications() {
  const { decision, exchanges, regime, symbol } = useMarket();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Alerts are generated from live conditions, not a canned list.
  const notes = useMemo<Note[]>(() => {
    const out: Note[] = [];

    if (decision && decision.action !== "WAIT") {
      out.push({
        id: "master",
        from: "Master AI",
        text: `${decision.action === "LONG" ? "อนุมัติ" : "อนุมัติฝั่งขาย"} ${symbol.replace("USDT", "")} ${decision.action}`,
        meta: `${decision.confidence}%`,
        tone: decision.action === "LONG" ? "up" : "down",
      });
    }

    const down = exchanges.filter((e) => !e.online);
    if (down.length > 0) {
      out.push({
        id: "venue",
        from: "Risk AI",
        text: `เชื่อมต่อ ${down.map((d) => d.name).join(", ")} ไม่ได้`,
        meta: "ลดขนาดโพซิชัน",
        tone: "down",
      });
    }

    const slow = exchanges.filter((e) => e.online && e.latency > 1500);
    if (slow.length > 0) {
      out.push({
        id: "latency",
        from: "Risk AI",
        text: `Latency สูงที่ ${slow.map((s) => s.name).join(", ")}`,
        meta: `${Math.max(...slow.map((s) => s.latency))}ms`,
        tone: "warn",
      });
    }

    if (regime.volatility === "High") {
      out.push({
        id: "vol",
        from: "Trend AI",
        text: `ความผันผวนสูง ${symbol.replace("USDT", "")} — ATR ${regime.atr.toFixed(2)}%`,
        meta: regime.label,
        tone: "warn",
      });
    }

    return out;
  }, [decision, exchanges, regime, symbol]);

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative text-muted hover:text-txt"
        aria-label="การแจ้งเตือน"
      >
        <IconBell size={17} />
        {notes.length > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid size-3.5 place-items-center rounded-full bg-down text-[8px] font-bold text-white">
            {notes.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[290px] overflow-hidden rounded-md border border-line bg-panel-2 shadow-2xl">
          <div className="border-b border-line-soft px-3 py-1.5 text-[10px] text-dim">
            การแจ้งเตือนจากระบบ AI
          </div>
          {notes.length === 0 ? (
            <p className="px-3 py-5 text-center text-[11px] text-dim">
              ไม่มีการแจ้งเตือน
            </p>
          ) : (
            <ul className="divide-y divide-line-soft">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-2 px-3 py-2">
                  <span
                    className={`mt-1 size-1.5 shrink-0 rounded-full ${
                      n.tone === "up" ? "bg-up" : n.tone === "down" ? "bg-down" : "bg-warn"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] text-brand">{n.from}</span>
                    <span className="block text-[11px] text-txt">{n.text}</span>
                  </span>
                  <span
                    className={`num shrink-0 text-[10px] ${
                      n.tone === "up" ? "text-up" : n.tone === "down" ? "text-down" : "text-warn"
                    }`}
                  >
                    {n.meta}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function Clock() {
  const now = useNow(1000);
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="num text-[13px] text-txt">
        {now === null ? "--:--:--" : bkkTime(new Date(now))}
      </span>
      <span className="text-[9px] text-dim">UTC+7</span>
    </div>
  );
}

export function TopBar() {
  const { connected } = useMarket();
  const { toggleNav } = useUi();

  return (
    <header className="sticky top-0 z-40 flex h-[70px] items-center gap-2 border-b border-line bg-shell/95 px-2 backdrop-blur sm:gap-3 sm:px-3">
      <button
        type="button"
        onClick={toggleNav}
        aria-label="เปิดเมนู"
        className="shrink-0 rounded-md p-1.5 text-muted hover:bg-[#0d1922] hover:text-txt lg:hidden"
      >
        <IconMenu size={20} />
      </button>

      <Link href="/" className="shrink-0" aria-label="กลับหน้าหลัก">
        <LogoLockup />
      </Link>

      <div className="ml-0 shrink-0 sm:ml-1">
        <SymbolSearch />
      </div>

      <div className="hidden min-w-0 flex-1 items-center gap-4 lg:flex">
        <div className="shrink-0">
          <div className="text-[8.5px] tracking-wide text-dim">CONNECTED EXCHANGE</div>
          <ExchangeStrip />
        </div>

        <div className="shrink-0 border-l border-line pl-4">
          <div className="text-[8.5px] tracking-wide text-dim">SERVER</div>
          <div className="flex items-center gap-1.5 text-[9.5px]">
            <span
              className={`size-1.5 rounded-full ${connected ? "bg-up dot-live" : "bg-down"}`}
            />
            <span className="text-muted">Singapore · SG-1</span>
          </div>
        </div>
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <span className="hidden sm:block">
          <AiChip />
        </span>
        <span className="hidden md:block">
          <Clock />
        </span>
        <Notifications />
        <button type="button" className="hidden text-muted hover:text-txt md:block" aria-label="เต็มจอ">
          <IconMaximize size={16} />
        </button>

        <div className="flex items-center gap-2 border-l border-line pl-2 sm:pl-3">
          <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[10px] font-bold text-black">
            GM
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[11px] text-txt">Global Mining</span>
            <span className="block text-[9px] text-dim">Administrator</span>
          </span>
          <IconChevronDown size={13} className="hidden text-dim sm:block" />
        </div>
      </div>
    </header>
  );
}
