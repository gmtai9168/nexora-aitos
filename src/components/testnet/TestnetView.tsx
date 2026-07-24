"use client";

import { useCallback, useEffect, useState } from "react";
import { fmtNum, fmtPrice } from "@/lib/format";
import { useNow } from "@/lib/market-context";
import {
  RISK_LIMITS,
  riskCheck,
  TESTNET_SYMBOLS,
  type Balance,
  type OpenOrder,
  type OrderIntent,
  type Position,
  type RiskVerdict,
  type TestnetStatus,
} from "@/lib/testnet";
import { Panel, Tag } from "../Panel";
import { AutonomousPanel } from "./AutonomousPanel";

const POLL_MS = 8000;

type OrderForm = {
  symbol: string;
  side: "BUY" | "SELL";
  type: "MARKET" | "LIMIT";
  quantity: string;
  price: string;
  leverage: number;
  reduceOnly: boolean;
};

const DEFAULT_FORM: OrderForm = {
  symbol: "BTCUSDT",
  side: "BUY",
  type: "MARKET",
  quantity: "0.002",
  price: "",
  leverage: 5,
  reduceOnly: false,
};

export function TestnetView() {
  const [status, setStatus] = useState<TestnetStatus | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [accountError, setAccountError] = useState("");
  const [form, setForm] = useState<OrderForm>(DEFAULT_FORM);
  const [refPrice, setRefPrice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const now = useNow(1000) ?? 0;

  const configured = status?.configured ?? false;
  const connected = status?.reachable && status?.canTrade;

  const refresh = useCallback(async () => {
    try {
      const st: TestnetStatus = await (await fetch("/api/testnet/status")).json();
      setStatus(st);
      if (st.configured && st.reachable && st.canTrade) {
        const acc = await (await fetch("/api/testnet/account")).json();
        if (acc.ok) {
          setBalance(acc.balance);
          setPositions(acc.positions);
          setAccountError("");
        } else {
          setAccountError(acc.message ?? "");
        }
        const od = await (await fetch("/api/testnet/orders")).json();
        if (od.ok) setOrders(od.orders);
      } else {
        setBalance(null);
        setPositions([]);
        setOrders([]);
      }
    } catch {
      setStatus((s) => (s ? { ...s, reachable: false, message: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้" } : s));
    }
  }, []);

  // Non-overlapping poll.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      await refresh();
      if (!cancelled) timer = setTimeout(run, POLL_MS);
    };
    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(run, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [refresh]);

  // A live mark price for the risk preview — public, no key needed.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/quotes?symbols=${form.symbol}`);
        const d = await r.json();
        const p = d.quotes?.[0]?.price;
        if (!cancelled && p) setRefPrice(p);
      } catch {
        /* keep previous */
      }
    };
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [form.symbol]);

  const intent: OrderIntent = {
    symbol: form.symbol,
    side: form.side,
    type: form.type,
    quantity: Number(form.quantity) || 0,
    price: form.type === "LIMIT" ? Number(form.price) || undefined : undefined,
    leverage: form.leverage,
    reduceOnly: form.reduceOnly,
  };
  const preview: RiskVerdict | null = refPrice ? riskCheck(intent, refPrice) : null;

  const submit = async () => {
    setConfirming(false);
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/testnet/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      const d = await res.json();
      if (d.ok) {
        setResult({
          ok: true,
          text: `ส่งคำสั่งสำเร็จ — #${d.order.orderId} ${d.order.side} ${d.order.origQty} ${d.order.symbol} · สถานะ ${d.order.status}`,
        });
        await refresh();
      } else {
        setResult({ ok: false, text: d.message ?? "ส่งคำสั่งไม่สำเร็จ" });
      }
    } catch {
      setResult({ ok: false, text: "เชื่อมต่อไม่สำเร็จ" });
    }
    setSubmitting(false);
  };

  const cancel = async (o: OpenOrder) => {
    await fetch(`/api/testnet/order?symbol=${o.symbol}&orderId=${o.orderId}`, { method: "DELETE" });
    await refresh();
  };

  return (
    <div className="flex flex-col gap-2.5">
      {/* Banner */}
      <div className="rounded-lg border border-warn/40 bg-[#20180a] px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-warn px-1.5 py-[2px] text-[10px] font-bold text-black">TESTNET</span>
          <span className="text-[11px] text-warn">
            โหมดทดสอบด้วยเงินปลอมบน Binance Futures Testnet — คำสั่งส่งไปยัง testnet.binancefuture.com เท่านั้น ไม่แตะบัญชีจริง
          </span>
        </div>
      </div>

      {/* Status */}
      <StatusPanel status={status} now={now} />

      {!configured ? (
        <SetupGuide />
      ) : (
        <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-w-0 flex-col gap-2.5">
            <BalancePanel balance={balance} error={accountError} connected={!!connected} />
            <PositionsPanel positions={positions} />
            <OrdersPanel orders={orders} onCancel={cancel} />
          </div>

          <div className="flex flex-col gap-2.5">
            <AutonomousPanel onTraded={refresh} />
            <OrderForm
              form={form}
              onChange={setForm}
              refPrice={refPrice}
              preview={preview}
              submitting={submitting}
              result={result}
              confirming={confirming}
              onConfirm={() => setConfirming(true)}
              onCancelConfirm={() => setConfirming(false)}
              onSubmit={submit}
              disabled={!connected}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatusPanel({ status, now }: { status: TestnetStatus | null; now: number }) {
  const tone = !status
    ? "warn"
    : status.configured && status.reachable && status.canTrade
      ? "up"
      : status.configured && status.reachable
        ? "warn"
        : "down";
  return (
    <Panel
      title="สถานะการเชื่อมต่อ Testnet"
      titleEn="Testnet Connection"
      right={
        <Tag tone={tone}>
          {!status
            ? "กำลังตรวจ…"
            : status.configured && status.reachable && status.canTrade
              ? "พร้อมเทรด"
              : status.configured
                ? "มีปัญหา"
                : "ยังไม่ตั้งค่า"}
        </Tag>
      }
      bodyClassName="p-2.5"
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { l: "ตั้งค่า API Key", v: status?.configured ? "แล้ว" : "ยังไม่", ok: status?.configured },
          { l: "เชื่อมต่อได้", v: status?.reachable ? `${status.latencyMs} ms` : "ไม่ได้", ok: status?.reachable },
          { l: "สิทธิ์เทรด", v: status?.canTrade === null ? "—" : status?.canTrade ? "มี" : "ไม่มี", ok: status?.canTrade ?? undefined },
          {
            l: "ต่างเวลากับกระดาน",
            v: status?.clockSkewMs === null || status?.clockSkewMs === undefined ? "—" : `${status.clockSkewMs} ms`,
            ok: status?.clockSkewMs !== null && Math.abs(status?.clockSkewMs ?? 0) < 3000,
          },
        ].map((x) => (
          <div key={x.l} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
            <div className="truncate text-[9px] text-muted">{x.l}</div>
            <div className={`num truncate text-[13px] font-bold ${x.ok === undefined ? "text-txt" : x.ok ? "text-up" : "text-down"}`}>
              {x.v}
            </div>
          </div>
        ))}
      </div>
      {status?.message && (
        <p className={`mt-1.5 text-[9.5px] ${status.configured && status.reachable && status.canTrade ? "text-dim" : "text-warn"}`}>
          {status.message}
          {now > 0 && status.reachable && ` · อัปเดต ${new Date(now).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false })}`}
        </p>
      )}
    </Panel>
  );
}

function BalancePanel({ balance, error, connected }: { balance: Balance | null; error: string; connected: boolean }) {
  return (
    <Panel title="ยอดเงิน Testnet" titleEn="Wallet (paper USDT)" bodyClassName="p-2.5">
      {!connected ? (
        <p className="py-4 text-center text-[10.5px] text-dim">รอการเชื่อมต่อ…</p>
      ) : error ? (
        <p className="py-4 text-center text-[10.5px] text-down">{error}</p>
      ) : balance ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "ยอดกระเป๋า", v: balance.walletBalance, tone: "text-txt" },
            { l: "ยอดใช้ได้", v: balance.availableBalance, tone: "text-txt" },
            { l: "มาร์จินรวม", v: balance.marginBalance, tone: "text-txt" },
            { l: "กำไร/ขาดทุนค้าง", v: balance.unrealizedPnl, tone: balance.unrealizedPnl >= 0 ? "text-up" : "text-down" },
          ].map((x) => (
            <div key={x.l} className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
              <div className="truncate text-[9px] text-muted">{x.l}</div>
              <div className={`num truncate text-[15px] font-bold ${x.tone}`}>
                {x.v >= 0 ? "" : "−"}
                {fmtNum(Math.abs(x.v))}
              </div>
              <div className="text-[8px] text-dim">USDT (ปลอม)</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[10.5px] text-dim">กำลังโหลด…</p>
      )}
    </Panel>
  );
}

function PositionsPanel({ positions }: { positions: Position[] }) {
  return (
    <Panel title="สถานะที่เปิดอยู่" titleEn="Open Positions" right={<Tag tone="neutral">{positions.length}</Tag>} bodyClassName="p-0">
      {positions.length === 0 ? (
        <p className="py-6 text-center text-[10.5px] text-dim">ยังไม่มีสถานะที่เปิดอยู่</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="px-2.5 py-1.5 font-medium">สินทรัพย์</th>
                <th className="px-1.5 py-1.5 font-medium">ทิศทาง</th>
                <th className="px-1.5 py-1.5 text-right font-medium">ขนาด</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Entry</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Mark</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Liq.</th>
                <th className="px-1.5 py-1.5 text-right font-medium">Lev</th>
                <th className="px-2.5 py-1.5 text-right font-medium">P&amp;L</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-t border-line-soft text-[10.5px]">
                  <td className="px-2.5 py-[6px] text-txt">{p.symbol}</td>
                  <td className={`px-1.5 py-[6px] font-semibold ${p.side === "LONG" ? "text-up" : "text-down"}`}>{p.side}</td>
                  <td className="num px-1.5 py-[6px] text-right text-muted">{fmtNum(p.size, 4)}</td>
                  <td className="num px-1.5 py-[6px] text-right text-txt">{fmtPrice(p.entryPrice)}</td>
                  <td className="num px-1.5 py-[6px] text-right text-txt">{fmtPrice(p.markPrice)}</td>
                  <td className="num px-1.5 py-[6px] text-right text-down/70">{p.liquidationPrice > 0 ? fmtPrice(p.liquidationPrice) : "—"}</td>
                  <td className="num px-1.5 py-[6px] text-right text-dim">{p.leverage}x</td>
                  <td className={`num px-2.5 py-[6px] text-right font-bold ${p.unrealizedPnl >= 0 ? "text-up" : "text-down"}`}>
                    {p.unrealizedPnl >= 0 ? "+" : "−"}
                    {fmtNum(Math.abs(p.unrealizedPnl))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function OrdersPanel({ orders, onCancel }: { orders: OpenOrder[]; onCancel: (o: OpenOrder) => void }) {
  return (
    <Panel title="คำสั่งที่ค้างอยู่" titleEn="Open Orders" right={<Tag tone="neutral">{orders.length}</Tag>} bodyClassName="p-0">
      {orders.length === 0 ? (
        <p className="py-6 text-center text-[10.5px] text-dim">ไม่มีคำสั่งค้าง (คำสั่ง Market จะจับคู่ทันที)</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="px-2.5 py-1.5 font-medium">#</th>
                <th className="px-1.5 py-1.5 font-medium">สินทรัพย์</th>
                <th className="px-1.5 py-1.5 font-medium">ประเภท</th>
                <th className="px-1.5 py-1.5 font-medium">ทิศทาง</th>
                <th className="px-1.5 py-1.5 text-right font-medium">จำนวน</th>
                <th className="px-1.5 py-1.5 text-right font-medium">ราคา</th>
                <th className="px-2.5 py-1.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId} className="border-t border-line-soft text-[10.5px]">
                  <td className="num px-2.5 py-[6px] text-dim">{o.orderId}</td>
                  <td className="px-1.5 py-[6px] text-txt">{o.symbol}</td>
                  <td className="px-1.5 py-[6px] text-muted">{o.type}</td>
                  <td className={`px-1.5 py-[6px] font-semibold ${o.side === "BUY" ? "text-up" : "text-down"}`}>{o.side}</td>
                  <td className="num px-1.5 py-[6px] text-right text-muted">{fmtNum(o.quantity, 4)}</td>
                  <td className="num px-1.5 py-[6px] text-right text-txt">{o.price > 0 ? fmtPrice(o.price) : "Market"}</td>
                  <td className="px-2.5 py-[6px] text-right">
                    <button type="button" onClick={() => onCancel(o)} className="rounded border border-down/40 px-1.5 py-[2px] text-[9px] text-down hover:bg-[#2a1019]">
                      ยกเลิก
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function OrderForm({
  form,
  onChange,
  refPrice,
  preview,
  submitting,
  result,
  confirming,
  onConfirm,
  onCancelConfirm,
  onSubmit,
  disabled,
}: {
  form: OrderForm;
  onChange: (f: OrderForm) => void;
  refPrice: number | null;
  preview: RiskVerdict | null;
  submitting: boolean;
  result: { ok: boolean; text: string } | null;
  confirming: boolean;
  onConfirm: () => void;
  onCancelConfirm: () => void;
  onSubmit: () => void;
  disabled: boolean;
}) {
  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) => onChange({ ...form, [k]: v });
  const input = "w-full rounded border border-line bg-[#0a121a] px-2 py-[6px] text-[11px] text-txt outline-none focus:border-brand/60";

  return (
    <Panel title="ส่งคำสั่งทดสอบ" titleEn="Place Test Order" right={<Tag tone="warn">เงินปลอม</Tag>} bodyClassName="p-2.5 flex flex-col gap-2">
      <label className="block">
        <span className="mb-[3px] block text-[9.5px] text-muted">สินทรัพย์</span>
        <select className={input} value={form.symbol} onChange={(e) => set("symbol", e.target.value)}>
          {TESTNET_SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex overflow-hidden rounded border border-line">
          {(["BUY", "SELL"] as const).map((s) => (
            <button key={s} type="button" onClick={() => set("side", s)} className={`flex-1 py-[6px] text-[10.5px] font-semibold ${form.side === s ? (s === "BUY" ? "bg-up text-black" : "bg-down text-white") : "bg-[#0a121a] text-muted"}`}>
              {s === "BUY" ? "ซื้อ (Long)" : "ขาย (Short)"}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded border border-line">
          {(["MARKET", "LIMIT"] as const).map((t) => (
            <button key={t} type="button" onClick={() => set("type", t)} className={`flex-1 py-[6px] text-[10px] ${form.type === t ? "bg-brand text-black font-semibold" : "bg-[#0a121a] text-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">จำนวน (เหรียญ)</span>
          <input className={`num ${input}`} type="number" step="0.001" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
        </label>
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">Leverage</span>
          <input className={`num ${input}`} type="number" min={1} max={RISK_LIMITS.maxLeverage} value={form.leverage} onChange={(e) => set("leverage", Number(e.target.value))} />
        </label>
      </div>

      {form.type === "LIMIT" && (
        <label className="block">
          <span className="mb-[3px] block text-[9.5px] text-muted">ราคา Limit</span>
          <input className={`num ${input}`} type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder={refPrice ? String(refPrice) : ""} />
        </label>
      )}

      <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted">
        <input type="checkbox" checked={form.reduceOnly} onChange={(e) => set("reduceOnly", e.target.checked)} className="accent-[#00d4ff]" />
        Reduce Only (ปิดสถานะเท่านั้น)
      </label>

      {/* Risk preview */}
      <div className="rounded border border-line-soft bg-[#081017] p-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[9.5px] font-semibold text-brand">Risk Engine (ตรวจก่อนส่ง)</span>
          {preview && (
            <span className={`text-[9.5px] font-bold ${preview.ok ? "text-up" : "text-down"}`}>
              {preview.ok ? "ผ่าน" : "ไม่ผ่าน"}
            </span>
          )}
        </div>
        {!preview ? (
          <p className="text-[9px] text-dim">กำลังอ่านราคาอ้างอิง…</p>
        ) : (
          <>
            <div className="mb-1 text-[9px] text-dim">
              มูลค่าสถานะ ≈ <span className="num text-txt">{fmtNum(preview.notionalUsd)}</span> USDT
              {refPrice && <> · ราคาอ้างอิง {fmtPrice(refPrice)}</>}
            </div>
            <ul className="space-y-[2px]">
              {preview.checks.map((c) => (
                <li key={c.label} className="flex items-start gap-1.5 text-[9px]">
                  <span className={c.pass ? "text-up" : "text-down"}>{c.pass ? "✓" : "✕"}</span>
                  <span className="min-w-0 flex-1 text-muted">{c.label}</span>
                  <span className="num shrink-0 text-dim">{c.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {!confirming ? (
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled || submitting || !preview?.ok}
          className={`rounded py-[8px] text-[12px] font-bold transition-colors ${
            disabled || !preview?.ok ? "cursor-not-allowed bg-[#12222c] text-dim" : form.side === "BUY" ? "bg-up text-black hover:brightness-110" : "bg-down text-white hover:brightness-110"
          }`}
        >
          {submitting ? "กำลังส่ง…" : disabled ? "ยังเชื่อมต่อไม่ได้" : `ส่งคำสั่ง ${form.side === "BUY" ? "ซื้อ" : "ขาย"} (เงินปลอม)`}
        </button>
      ) : (
        <div className="rounded border border-warn/40 bg-[#20180a] p-2">
          <p className="text-[10px] text-warn">
            ยืนยันส่งคำสั่ง {form.side === "BUY" ? "ซื้อ" : "ขาย"} {form.quantity} {form.symbol} ที่ {form.leverage}x ไปยัง Testnet?
          </p>
          <p className="mt-[2px] text-[9px] text-dim">เงินปลอมบน testnet — ไม่กระทบบัญชีจริง</p>
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" onClick={onSubmit} className="flex-1 rounded bg-warn py-[6px] text-[10.5px] font-bold text-black">ยืนยัน</button>
            <button type="button" onClick={onCancelConfirm} className="flex-1 rounded border border-line py-[6px] text-[10.5px] text-muted">ยกเลิก</button>
          </div>
        </div>
      )}

      {result && (
        <p className={`rounded border px-2 py-1.5 text-[10px] leading-snug ${result.ok ? "border-up/30 bg-[#0d2b23] text-up" : "border-down/30 bg-[#2c1119] text-down"}`}>
          {result.text}
        </p>
      )}

      <p className="text-[8.5px] leading-snug text-dim">
        คำสั่งจะถูกตรวจโดย Risk Engine ที่เซิร์ฟเวอร์อีกครั้งด้วยราคาสด ก่อนส่งไปยัง Binance Futures Testnet —
        เพดาน: Leverage {RISK_LIMITS.maxLeverage}x · มูลค่าไม่เกิน {RISK_LIMITS.maxNotionalUsd.toLocaleString()} USDT
      </p>
    </Panel>
  );
}

function SetupGuide() {
  return (
    <Panel title="ตั้งค่าเชื่อมต่อ Testnet" titleEn="Setup" bodyClassName="p-3">
      <ol className="space-y-2 text-[11px] leading-relaxed text-muted">
        <li>
          <span className="font-semibold text-txt">1. สร้างบัญชี Testnet</span> — เปิด{" "}
          <a href="https://testnet.binancefuture.com" target="_blank" rel="noopener noreferrer" className="text-brand underline">
            testnet.binancefuture.com
          </a>{" "}
          แล้วล็อกอินด้วย GitHub/Google (ได้เงินปลอมฟรีสำหรับทดสอบ)
        </li>
        <li>
          <span className="font-semibold text-txt">2. สร้าง API Key</span> — ในหน้า Testnet มุมขวาล่างมี &ldquo;API Key&rdquo; กด
          เพื่อสร้าง จะได้ <span className="text-txt">API Key</span> และ <span className="text-txt">Secret Key</span>
        </li>
        <li>
          <span className="font-semibold text-txt">3. เพิ่มลง Vercel</span> — ไปที่ Project{" "}
          <span className="num text-txt">nexora-aitos</span> → Settings → Environment Variables เพิ่มสองตัว:
          <div className="mt-1 rounded border border-line-soft bg-[#081017] p-2 font-mono text-[9.5px] text-txt">
            BINANCE_TESTNET_KEY = <span className="text-dim">(API Key ของคุณ)</span>
            <br />
            BINANCE_TESTNET_SECRET = <span className="text-dim">(Secret Key ของคุณ)</span>
          </div>
          <span className="mt-1 block text-[9.5px] text-dim">
            เลือก Environment: Production · แล้วกด Redeploy หนึ่งครั้งเพื่อให้ค่ามีผล
          </span>
        </li>
      </ol>
      <p className="mt-2 rounded border border-warn/30 bg-[#20180a] px-2 py-1.5 text-[9.5px] leading-snug text-warn">
        คีย์ถูกเก็บเป็น Environment Variable ฝั่งเซิร์ฟเวอร์ ไม่อยู่ในโค้ด ไม่ขึ้น GitHub และเบราว์เซอร์มองไม่เห็น —
        นี่คือคีย์ของ <strong>Testnet เท่านั้น</strong> (เงินปลอม) ไม่ใช่คีย์บัญชีจริง จึงไม่มีความเสี่ยงทางการเงิน
      </p>
    </Panel>
  );
}
