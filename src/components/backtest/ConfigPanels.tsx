"use client";

import { useMemo, useState, type ReactNode } from "react";
import { STRATEGY_META, type LabConfig, type LabStrategyKind } from "@/lib/backtest-lab";
import { ALL_LISTINGS, findListing, type Listing } from "@/lib/universe";
import { Panel, Tag } from "../Panel";

/* ------------------------------------------------------------------ *
 * Which of our two real history feeds serves a given symbol
 * ------------------------------------------------------------------ */

export type MarketClass = "crypto" | "stock" | "forex" | "commodity";

export const MARKET_LABEL: Record<MarketClass, string> = {
  crypto: "คริปโต",
  stock: "หุ้น",
  forex: "อัตราแลกเปลี่ยน",
  commodity: "สินค้าโภคภัณฑ์",
};

const COMMODITY = new Set(["GC=F", "CL=F"]);
const FOREX = new Set(["THB=X"]);

export function marketClassOf(l: Listing): MarketClass {
  if (l.assetClass === "crypto") return "crypto";
  if (COMMODITY.has(l.symbol)) return "commodity";
  if (FOREX.has(l.symbol)) return "forex";
  return "stock";
}

/** The feed that actually answers /api/history for this symbol. */
export function sourceOf(symbol: string): { id: string; name: string; detail: string } {
  return /^[A-Z0-9]+USDT$/.test(symbol)
    ? { id: "binance", name: "Binance", detail: "Spot klines · แบ่งหน้าได้ถึง 4,000 แท่ง" }
    : { id: "yahoo", name: "Yahoo Finance", detail: "OHLCV รายวัน/รายชั่วโมง" };
}

/** Venues we cannot pull free deep history from are shown, but disabled. */
const SOURCES = [
  { id: "binance", name: "Binance", live: true },
  { id: "yahoo", name: "Yahoo Finance", live: true },
  { id: "bybit", name: "Bybit", live: false },
  { id: "okx", name: "OKX", live: false },
  { id: "kraken", name: "Kraken", live: false },
];

export const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;

/* ------------------------------------------------------------------ *
 * Small form primitives
 * ------------------------------------------------------------------ */

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-[3px] flex items-baseline justify-between gap-1">
        <span className="truncate text-[9.5px] text-muted">{label}</span>
        {hint && <span className="num shrink-0 text-[8.5px] text-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const INPUT =
  "w-full rounded border border-line bg-[#0a121a] px-1.5 py-[5px] text-[11px] text-txt outline-none focus:border-brand/60 disabled:opacity-40";

function Num({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      className={`num ${INPUT}`}
      value={value}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v)) onChange(Math.max(min, max === undefined ? v : Math.min(max, v)));
      }}
    />
  );
}

function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded border border-line">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 px-1 py-[5px] text-[10px] transition-colors ${
            value === o.id ? "bg-brand text-black font-semibold" : "bg-[#0a121a] text-muted hover:text-txt"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * 1. Top control bar
 * ------------------------------------------------------------------ */

export function TopControls({
  cfg,
  onChange,
  market,
  onMarket,
  dataStatus,
  onReset,
}: {
  cfg: LabConfig;
  onChange: (c: LabConfig) => void;
  market: MarketClass;
  onMarket: (m: MarketClass) => void;
  dataStatus: { loading: boolean; bars: number; from: number; to: number; error: string };
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const pool = useMemo(
    () => ALL_LISTINGS.filter((l) => marketClassOf(l) === market),
    [market],
  );

  const matches = useMemo(() => {
    const q = query.trim().toUpperCase();
    if (!q) return pool.slice(0, 12);
    return pool
      .filter(
        (l) =>
          l.symbol.includes(q) ||
          l.display.toUpperCase().includes(q) ||
          l.name.toUpperCase().includes(q),
      )
      .slice(0, 12);
  }, [pool, query]);

  const active = findListing(cfg.symbol);
  const src = sourceOf(cfg.symbol);
  const range =
    dataStatus.bars > 0
      ? `${new Date(dataStatus.from * 1000).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" })} – ${new Date(dataStatus.to * 1000).toLocaleDateString("th-TH", { year: "2-digit", month: "short", day: "numeric" })}`
      : "—";

  return (
    <Panel
      title="ตั้งค่าชุดทดสอบ"
      titleEn="Test Setup"
      right={
        <div className="flex items-center gap-1.5">
          <Tag tone={dataStatus.error ? "down" : dataStatus.loading ? "warn" : dataStatus.bars ? "up" : "neutral"}>
            {dataStatus.error
              ? "ดึงข้อมูลไม่สำเร็จ"
              : dataStatus.loading
                ? "กำลังโหลดข้อมูล…"
                : dataStatus.bars
                  ? `${dataStatus.bars.toLocaleString()} แท่ง · ${range}`
                  : "ยังไม่มีข้อมูล"}
          </Tag>
          <button
            type="button"
            onClick={onReset}
            className="rounded border border-line bg-[#0f1c26] px-2 py-[4px] text-[10px] text-muted hover:text-txt"
          >
            สร้าง Backtest ใหม่
          </button>
        </div>
      }
      bodyClassName="p-2.5"
    >
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Asset search */}
        <Field label="สินทรัพย์" hint={active?.name}>
          <div className="relative">
            <input
              className={INPUT}
              placeholder="ค้นหา BTC · XAU · NVDA …"
              value={open ? query : (active?.display ?? cfg.symbol)}
              onFocus={() => {
                setOpen(true);
                setQuery("");
              }}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onChange={(e) => setQuery(e.target.value)}
            />
            {open && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[260px] overflow-y-auto rounded border border-line bg-[#0b141d] shadow-xl">
                {matches.length === 0 && (
                  <li className="px-2 py-2 text-[10px] text-dim">
                    ไม่พบใน {MARKET_LABEL[market]} — ลองเปลี่ยนตลาดด้านขวา
                  </li>
                )}
                {matches.map((l) => (
                  <li key={l.symbol}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        onChange({ ...cfg, symbol: l.symbol });
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2 py-[6px] text-left hover:bg-[#12212c]"
                    >
                      <span
                        className="h-[14px] w-[3px] shrink-0 rounded"
                        style={{ background: l.color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-txt">{l.display}</span>
                        <span className="block truncate text-[9px] text-dim">
                          {l.nameTh ?? l.name}
                        </span>
                      </span>
                      <span className="num shrink-0 text-[8.5px] text-dim">{l.symbol}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Field>

        <Field label="ตลาด" hint={`${pool.length} รายการ`}>
          <select
            className={INPUT}
            value={market}
            onChange={(e) => {
              const m = e.target.value as MarketClass;
              onMarket(m);
              const first = ALL_LISTINGS.find((l) => marketClassOf(l) === m);
              if (first) onChange({ ...cfg, symbol: first.symbol });
            }}
          >
            {(Object.keys(MARKET_LABEL) as MarketClass[]).map((m) => (
              <option key={m} value={m}>
                {MARKET_LABEL[m]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="แหล่งข้อมูล" hint={src.name}>
          <select className={INPUT} value={src.id} disabled>
            {SOURCES.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.live}>
                {s.name}
                {s.live ? "" : " — ไม่มีข้อมูลย้อนหลังฟรี"}
              </option>
            ))}
          </select>
        </Field>

        <Field label="กลยุทธ์ / AI Bot" hint={STRATEGY_META[cfg.strategy].version}>
          <select
            className={INPUT}
            value={cfg.strategy}
            onChange={(e) => onChange({ ...cfg, strategy: e.target.value as LabStrategyKind })}
          >
            {(Object.keys(STRATEGY_META) as LabStrategyKind[]).map((k) => (
              <option key={k} value={k}>
                {STRATEGY_META[k].th} — {STRATEGY_META[k].en}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <p className="mt-1.5 text-[9px] leading-snug text-dim">
        แหล่งข้อมูลถูกเลือกให้อัตโนมัติตามสินทรัพย์ — {src.name} · {src.detail} ·
        เปลี่ยนสินทรัพย์หรือกลยุทธ์แล้วกด Run Backtest เพื่อคำนวณใหม่ทั้งหน้า
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 2. Backtest configuration
 * ------------------------------------------------------------------ */

export function ConfigPanel({
  cfg,
  onChange,
  onSave,
  saved,
}: {
  cfg: LabConfig;
  onChange: (c: LabConfig) => void;
  onSave: () => void;
  saved: number;
}) {
  const set = <K extends keyof LabConfig>(k: K, v: LabConfig[K]) => onChange({ ...cfg, [k]: v });
  const isFutures = cfg.market === "futures";

  return (
    <Panel
      title="ตั้งค่าการทดสอบ"
      titleEn="Backtest Configuration"
      right={<Tag tone="neutral">{saved} ค่าที่บันทึกไว้</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <Field label="ประเภทตลาด">
          <Seg
            value={cfg.market}
            onChange={(v) => set("market", v)}
            options={[
              { id: "spot", label: "Spot" },
              { id: "futures", label: "Futures" },
            ]}
          />
        </Field>
        <Field label="ทิศทาง">
          <Seg
            value={cfg.direction}
            onChange={(v) => set("direction", v)}
            options={[
              { id: "long", label: "Long" },
              { id: "short", label: "Short" },
              { id: "both", label: "ทั้งคู่" },
            ]}
          />
        </Field>
      </div>

      <Field label="Timeframe">
        <div className="flex gap-1">
          {INTERVALS.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => set("interval", tf)}
              className={`flex-1 rounded border py-[4px] text-[10px] transition-colors ${
                cfg.interval === tf
                  ? "border-brand/60 bg-brand/15 text-brand"
                  : "border-line bg-[#0a121a] text-muted hover:text-txt"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </Field>

      <Field label="ช่วงข้อมูลย้อนหลัง" hint={`${cfg.bars.toLocaleString()} แท่ง`}>
        <div className="flex gap-1">
          {[500, 1000, 2000, 3000, 4000].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => set("bars", b)}
              className={`flex-1 rounded border py-[4px] text-[10px] transition-colors ${
                cfg.bars === b
                  ? "border-brand/60 bg-brand/15 text-brand"
                  : "border-line bg-[#0a121a] text-muted hover:text-txt"
              }`}
            >
              {b >= 1000 ? `${b / 1000}k` : b}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="เงินทุนเริ่มต้น" hint="USDT">
          <Num value={cfg.capital} onChange={(v) => set("capital", v)} step={1000} min={100} />
        </Field>
        <Field label="Leverage" hint={isFutures ? `ล้างพอร์ตที่ ${(100 / cfg.leverage).toFixed(1)}%` : "Spot = 1x"}>
          <Num
            value={isFutures ? cfg.leverage : 1}
            onChange={(v) => set("leverage", v)}
            min={1}
            max={125}
            disabled={!isFutures}
          />
        </Field>
        <Field label="ความเสี่ยงต่อไม้" hint="% ของทุน">
          <Num value={cfg.riskPct} onChange={(v) => set("riskPct", v)} step={0.1} min={0.1} max={20} />
        </Field>
        <Field label="Position สูงสุด" hint="พร้อมกัน">
          <Num value={cfg.maxPositions} onChange={(v) => set("maxPositions", v)} min={1} max={10} />
        </Field>
      </div>

      <div className="rounded border border-line-soft bg-[#081017] p-1.5">
        <div className="mb-1 text-[9.5px] font-semibold text-warn">ต้นทุนการเทรด (หักออกจากผลจริง)</div>
        <div className="grid grid-cols-3 gap-1.5">
          <Field label="ค่าธรรมเนียม" hint="%/ข้าง">
            <Num value={cfg.feePct} onChange={(v) => set("feePct", v)} step={0.01} min={0} max={1} />
          </Field>
          <Field label="Funding" hint="%/8ชม.">
            <Num
              value={isFutures ? cfg.fundingPct : 0}
              onChange={(v) => set("fundingPct", v)}
              step={0.001}
              min={0}
              max={1}
              disabled={!isFutures}
            />
          </Field>
          <Field label="Slippage" hint="%/ข้าง">
            <Num value={cfg.slippagePct} onChange={(v) => set("slippagePct", v)} step={0.01} min={0} max={1} />
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Stop Loss" hint="× ATR">
          <Num value={cfg.stopAtr} onChange={(v) => set("stopAtr", v)} step={0.1} min={0.2} max={10} />
        </Field>
        <Field label="Take Profit" hint="× ระยะ Stop (R)">
          <Num value={cfg.targetR} onChange={(v) => set("targetR", v)} step={0.1} min={0.2} max={10} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Trailing Stop" hint={cfg.trailing ? `${cfg.trailAtr}× ATR` : "ปิดอยู่"}>
          <Seg
            value={cfg.trailing ? "on" : "off"}
            onChange={(v) => set("trailing", v === "on")}
            options={[
              { id: "off", label: "ปิด" },
              { id: "on", label: "เปิด" },
            ]}
          />
        </Field>
        <Field label="ระยะ Trailing" hint="× ATR">
          <Num
            value={cfg.trailAtr}
            onChange={(v) => set("trailAtr", v)}
            step={0.1}
            min={0.2}
            max={10}
            disabled={!cfg.trailing}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="เวลาถือสูงสุด" hint="แท่ง">
          <Num value={cfg.maxHoldBars} onChange={(v) => set("maxHoldBars", v)} min={2} max={500} />
        </Field>
        <Field label="Margin Mode" hint={isFutures ? "" : "Spot ไม่ใช้"}>
          <Seg
            value={cfg.margin}
            onChange={(v) => set("margin", v)}
            options={[
              { id: "isolated", label: "Isolated" },
              { id: "cross", label: "Cross" },
            ]}
          />
        </Field>
      </div>

      <button
        type="button"
        onClick={onSave}
        className="rounded border border-line bg-[#0f1c26] py-[6px] text-[10.5px] text-muted transition-colors hover:text-txt"
      >
        บันทึกค่าที่ตั้งไว้ (Save Configuration)
      </button>

      <p className="text-[9px] leading-snug text-dim">
        ทุกไม้หัก Fee ทั้งขาเข้าและขาออก บวก Slippage ทั้งสองข้าง และ Futures คิด Funding
        ตามเวลาที่ถือจริงทุก 8 ชั่วโมง — ตัวเลขผลลัพธ์จึงเป็นค่าสุทธิแล้ว
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 3. Strategy selection
 * ------------------------------------------------------------------ */

export function StrategyPanel({
  cfg,
  onChange,
}: {
  cfg: LabConfig;
  onChange: (c: LabConfig) => void;
}) {
  const meta = STRATEGY_META[cfg.strategy];
  const kinds = Object.keys(STRATEGY_META) as LabStrategyKind[];

  return (
    <Panel
      title="เลือกกลยุทธ์"
      titleEn="Strategy Selection"
      right={<Tag tone="neutral">{meta.version}</Tag>}
      bodyClassName="p-2.5 flex flex-col gap-2"
    >
      <div className="grid grid-cols-2 gap-1">
        {kinds.map((k) => {
          const m = STRATEGY_META[k];
          const on = cfg.strategy === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...cfg, strategy: k })}
              className={`flex items-center gap-1.5 rounded border px-1.5 py-[6px] text-left transition-colors ${
                on ? "border-brand/50 bg-brand/10" : "border-line bg-[#0a121a] hover:bg-[#101d27]"
              }`}
            >
              <span className="h-[16px] w-[3px] shrink-0 rounded" style={{ background: m.color }} />
              <span className="min-w-0">
                <span className={`block truncate text-[10.5px] ${on ? "text-brand" : "text-txt"}`}>
                  {m.th}
                </span>
                <span className="block truncate text-[8.5px] text-dim">{m.en}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded border border-line-soft bg-[#081017] p-2">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
          <span className="text-[11px] font-semibold text-txt">{meta.en}</span>
          <span className="num text-[9px] text-dim">{meta.version}</span>
        </div>
        <dl className="space-y-1">
          <div>
            <dt className="text-[9px] text-up">เงื่อนไขเข้า (Entry)</dt>
            <dd className="text-[10px] leading-snug text-muted">{meta.entryTh}</dd>
          </div>
          <div>
            <dt className="text-[9px] text-down">เงื่อนไขออก (Exit)</dt>
            <dd className="text-[10px] leading-snug text-muted">{meta.exitTh}</dd>
          </div>
        </dl>
      </div>

      {cfg.strategy === "orderFlow" && (
        <p className="rounded border border-warn/30 bg-[#20180a] px-2 py-1.5 text-[9px] leading-snug text-warn">
          หมายเหตุ: ข้อมูลย้อนหลังฟรีมีเพียง OHLCV ไม่มี Order Flow ระดับคำสั่งจริง
          กลยุทธ์นี้จึงประมาณแรงซื้อขายจากวอลุ่มและตำแหน่งราคาปิดในแท่ง
        </p>
      )}
      {cfg.strategy === "funding" && (
        <p className="rounded border border-warn/30 bg-[#20180a] px-2 py-1.5 text-[9px] leading-snug text-warn">
          หมายเหตุ: Binance ไม่เปิดประวัติ Funding Rate ย้อนหลังลึกแบบฟรี
          กลยุทธ์นี้จึงใช้ระยะที่ราคายืดออกจากค่าเฉลี่ยเป็นตัวแทนของตำแหน่งที่แออัด
        </p>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ *
 * 4. Run bar with staged progress
 * ------------------------------------------------------------------ */

export const RUN_STAGES = [
  "โหลดข้อมูลย้อนหลัง",
  "ตรวจสอบคุณภาพข้อมูล",
  "สร้างสัญญาณ Entry/Exit",
  "จำลองคำสั่งซื้อขาย",
  "หักค่าธรรมเนียมและ Funding",
  "คำนวณกำไรขาดทุน",
  "วิเคราะห์ความเสี่ยง",
  "สร้างรายงาน",
] as const;

export function RunBar({
  stage,
  running,
  paused,
  elapsedMs,
  onRun,
  onPause,
  onCancel,
  dirty,
}: {
  stage: number;
  running: boolean;
  paused: boolean;
  elapsedMs: number;
  onRun: () => void;
  onPause: () => void;
  onCancel: () => void;
  dirty: boolean;
}) {
  const pct = running ? Math.round((stage / RUN_STAGES.length) * 100) : stage > 0 ? 100 : 0;
  // Remaining time is extrapolated from how long the finished stages took.
  const eta = running && stage > 0 ? Math.max(0, (elapsedMs / stage) * (RUN_STAGES.length - stage)) : 0;

  return (
    <section className="panel p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={running}
          className={`flex items-center gap-1.5 rounded px-3 py-[7px] text-[11.5px] font-bold transition-colors ${
            running
              ? "cursor-not-allowed bg-[#12222c] text-dim"
              : "bg-gradient-to-r from-brand to-[#0b9fd8] text-black hover:brightness-110"
          }`}
        >
          {running ? "กำลังทดสอบ…" : "▶ Run Backtest"}
        </button>

        <button
          type="button"
          onClick={onPause}
          disabled={!running}
          className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted transition-colors hover:text-txt disabled:opacity-35"
        >
          {paused ? "▶ ทำต่อ" : "⏸ Pause"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!running}
          className="rounded border border-down/40 bg-[#1d0b12] px-2.5 py-[6px] text-[10.5px] text-down transition-colors hover:bg-[#2a1019] disabled:opacity-35"
        >
          ✕ Cancel
        </button>

        <div className="min-w-[200px] flex-1">
          <div className="mb-[3px] flex items-baseline justify-between gap-2">
            <span className="truncate text-[10px] text-muted">
              {running
                ? `${paused ? "หยุดชั่วคราว · " : ""}${stage + 1}/${RUN_STAGES.length} — ${RUN_STAGES[Math.min(stage, RUN_STAGES.length - 1)]}`
                : stage > 0
                  ? "เสร็จสมบูรณ์ทั้ง 8 ขั้นตอน"
                  : "กด Run Backtest เพื่อเริ่มทดสอบ"}
            </span>
            <span className="num shrink-0 text-[10px] text-dim">
              {running && eta > 0 ? `เหลือ ~${(eta / 1000).toFixed(1)} วิ` : elapsedMs > 0 ? `${(elapsedMs / 1000).toFixed(2)} วิ` : ""}
            </span>
          </div>
          <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#0d1922]">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ${
                paused ? "bg-warn" : "bg-gradient-to-r from-brand to-up"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {dirty && !running && (
          <Tag tone="warn">ค่าตั้งเปลี่ยนแล้ว — ผลด้านล่างยังเป็นของรอบก่อน</Tag>
        )}
      </div>

      <ol className="mt-2 flex flex-wrap gap-x-1 gap-y-1">
        {RUN_STAGES.map((s, i) => {
          const done = stage > i || (!running && stage > 0);
          const now = running && stage === i;
          return (
            <li
              key={s}
              className={`rounded border px-1.5 py-[2px] text-[8.5px] ${
                done
                  ? "border-up/30 bg-[#0d2b23] text-up"
                  : now
                    ? "border-brand/50 bg-[#062a38] text-brand"
                    : "border-line bg-[#0a121a] text-dim"
              }`}
            >
              {i + 1}. {s}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
