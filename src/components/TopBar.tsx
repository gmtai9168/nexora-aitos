"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { bkkTime } from "@/lib/format";
import { useMarket, useNow } from "@/lib/market-context";
import { useLiveAccount } from "@/lib/live-account";
import { useUi } from "@/lib/ui-context";
import { useRole } from "@/lib/role-context";
import { useSession, signOut } from "next-auth/react";
import { ROLE_ORDER, ROLES } from "@/lib/rbac";
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
  const live = useLiveAccount();
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

    // Real autonomous trades — the actual coins the AI opened, not the coin you're viewing.
    if (live.positions.length > 0) {
      const list = live.positions
        .slice(0, 6)
        .map((p) => `${p.symbol.replace("USDT", "")} ${p.side}`)
        .join(" · ");
      out.push({
        id: "master-pos",
        from: "Master AI",
        text: `เปิด ${live.positions.length} สถานะ: ${list}`,
        meta: `${live.unrealizedPnl >= 0 ? "+" : ""}${live.unrealizedPnl.toFixed(2)}`,
        tone: live.unrealizedPnl >= 0 ? "up" : "down",
      });
    }

    // Signal for the coin currently open on the dashboard — advisory, not an executed trade.
    if (decision && decision.action !== "WAIT") {
      out.push({
        id: "signal",
        from: "Master AI",
        text: `สัญญาณ ${symbol.replace("USDT", "")} → ${decision.action} (เหรียญที่กำลังดู)`,
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
  }, [decision, exchanges, regime, symbol, live.positions, live.unrealizedPnl]);

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

        <RoleMenu />
      </div>
    </header>
  );
}

/** Account menu — real session (login/logout) plus the RBAC role switcher,
 *  which only privileged roles (admin/founder, or the signed-out owner) may use. */
function RoleMenu() {
  const { role, setRole, canSwitch, authenticated } = useRole();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const displayName = session?.user?.name || (authenticated ? session?.user?.email : "Global Mining") || "Guest";
  const initials =
    displayName
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "GM";

  return (
    <div ref={boxRef} className="relative border-l border-line pl-2 sm:pl-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2"
      >
        <span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-[10px] font-bold text-black">
          {initials}
        </span>
        <span className="hidden leading-tight text-left sm:block">
          <span className="block max-w-[120px] truncate text-[11px] text-txt">{displayName}</span>
          <span className="block text-[9px] text-brand">{ROLES[role].th}</span>
        </span>
        <IconChevronDown size={13} className="hidden text-dim sm:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-[248px] rounded-lg border border-line bg-panel p-1.5 shadow-xl">
          {authenticated ? (
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="mb-1 block rounded-md bg-[#0e1a24] px-2 py-2 hover:bg-[#12222d]"
            >
              <div className="truncate text-[11px] text-txt">{session?.user?.name || "สมาชิก"}</div>
              <div className="truncate text-[9px] text-dim">{session?.user?.email}</div>
              {session?.user && !session.user.verified && (
                <div className="mt-1 text-[8.5px] text-warn">ยังไม่ได้ยืนยันอีเมล</div>
              )}
              <div className="mt-1 text-[9px] text-brand">จัดการบัญชี · ความปลอดภัย →</div>
            </Link>
          ) : (
            <div className="mb-1 flex gap-1.5 px-1 py-1">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md bg-brand px-2 py-1.5 text-center text-[10.5px] font-semibold text-black"
              >
                เข้าสู่ระบบ
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-line px-2 py-1.5 text-center text-[10.5px] text-txt"
              >
                สมัครสมาชิก
              </Link>
            </div>
          )}

          {canSwitch && (
            <>
              <p className="px-2 py-1 text-[9px] text-dim">
                บทบาท (RBAC) — สลับเพื่อดูสิทธิ์แต่ละระดับ
              </p>
              <ul className="max-h-[300px] overflow-y-auto">
                {ROLE_ORDER.map((r) => {
                  const info = ROLES[r];
                  const activeRole = r === role;
                  return (
                    <li key={r}>
                      <button
                        type="button"
                        onClick={() => {
                          setRole(r);
                          setOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-[#0e1a24] ${
                          activeRole ? "bg-[#0e1f26]" : ""
                        }`}
                      >
                        <span
                          className={`num grid size-[18px] shrink-0 place-items-center rounded text-[9px] font-bold ${
                            activeRole ? "bg-brand text-black" : "bg-[#16242f] text-muted"
                          }`}
                        >
                          {info.level}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10.5px] text-txt">{info.th}</span>
                          <span className="block truncate text-[8.5px] text-dim">{info.en} · {info.desc}</span>
                        </span>
                        {activeRole && <span className="shrink-0 text-[9px] text-brand">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {authenticated && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="mt-1 w-full rounded-md border-t border-line-soft px-2 py-2 text-left text-[10.5px] text-down hover:bg-[#0e1a24]"
            >
              ออกจากระบบ
            </button>
          )}
        </div>
      )}
    </div>
  );
}
