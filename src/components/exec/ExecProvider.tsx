"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeStats,
  executionQuality,
  nextOrderId,
  routeOrder,
  walkBook,
  type ExecQuality,
  type ExecStats,
  type Order,
  type OrderSide,
  type OrderType,
  type RoutingChoice,
  type Venue,
} from "@/lib/execution";
import { useMarket } from "@/lib/market-context";
import type { DepthLevel } from "@/lib/use-coin-intel";

export type NewOrder = {
  side: OrderSide;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  reduceOnly: boolean;
  postOnly: boolean;
  takeProfit: number | null;
  stopLoss: number | null;
  source?: "AI" | "MANUAL";
  aiName?: string;
};

export type Position = {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  entry: number;
  orders: string[];
};

type ExecState = {
  venues: Venue[];
  routing: RoutingChoice | null;
  depth: { bids: DepthLevel[]; asks: DepthLevel[] };
  orders: Order[];
  selected: Order | null;
  select: (id: string) => void;
  submit: (o: NewOrder) => void;
  cancel: (id: string) => void;
  positions: Position[];
  closePosition: (symbol: string, fraction: number) => void;
  stats: ExecStats;
  quality: ExecQuality;
  autoMode: boolean;
  setAutoMode: (v: boolean) => void;
};

const Ctx = createContext<ExecState | null>(null);

const NO_DEPTH = { bids: [] as DepthLevel[], asks: [] as DepthLevel[] };

export function ExecProvider({ children }: { children: React.ReactNode }) {
  const { symbol, quotes, emergencyStop } = useMarket();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [depth, setDepth] = useState<{ key: string; bids: DepthLevel[]; asks: DepthLevel[] }>({
    key: "",
    ...NO_DEPTH,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState(true);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  // Venue quotes + measured latency, refreshed on a slow loop.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/venues?symbol=${encodeURIComponent(symbol)}`);
        const data: { venues: Venue[] } = await res.json();
        if (!cancelled) setVenues(data.venues ?? []);
      } catch {
        /* keep the last board */
      }
      if (!cancelled) timer = setTimeout(load, 20000);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [symbol]);

  // Live book — the fill simulator walks these exact levels.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const load = async () => {
      try {
        const res = await fetch(`/api/microstructure?symbol=${encodeURIComponent(symbol)}`);
        const data = await res.json();
        if (!cancelled && data.supported) {
          setDepth({ key: symbol, bids: data.bids ?? [], asks: data.asks ?? [] });
        }
      } catch {
        /* keep the last book */
      }
      if (!cancelled) timer = setTimeout(load, 6000);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [symbol]);

  const price = quotes.get(symbol)?.price ?? null;
  const book = depth.key === symbol ? depth : NO_DEPTH;

  const routing = useMemo(
    () => routeOrder(venues, "BUY", price),
    [venues, price],
  );

  const patch = useCallback((id: string, fn: (o: Order) => Order) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? fn(o) : o)));
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);

  /**
   * Paper execution. The steps are sequenced by each venue's *measured*
   * round-trip latency and the fill price comes from walking the real book,
   * so slippage and timing are honest even though no order leaves the browser.
   */
  const submit = useCallback(
    (input: NewOrder) => {
      const now = Date.now();
      const choice = routeOrder(venues, input.side, price);
      const id = nextOrderId();

      const order: Order = {
        id,
        createdAt: now,
        symbol,
        side: input.side,
        type: input.type,
        qty: input.qty,
        limitPrice: input.limitPrice,
        avgFillPrice: null,
        filledQty: 0,
        status: "pending",
        venue: choice?.venue.name ?? "—",
        venueLatency: choice?.venue.latency ?? 0,
        slippagePct: null,
        feePct: choice?.venue.fee ?? 0,
        feePaid: 0,
        reduceOnly: input.reduceOnly,
        postOnly: input.postOnly,
        takeProfit: input.takeProfit,
        stopLoss: input.stopLoss,
        source: input.source ?? "MANUAL",
        aiName: input.aiName ?? "Smart Execution AI",
        routingReason: choice?.reason ?? "ไม่มี exchange ที่เชื่อมต่อได้",
        response: null,
        steps: [
          {
            at: now,
            label: "Order Created",
            labelTh: "สร้างคำสั่ง",
            detail: `${input.side} ${input.qty} ${symbol.replace("USDT", "")} · ${input.type}`,
          },
        ],
      };

      setOrders((prev) => [order, ...prev].slice(0, 60));
      setSelectedId(id);

      if (emergencyStop) {
        later(60, () =>
          patch(id, (o) => ({
            ...o,
            status: "rejected",
            response: { code: "HALTED", message: "ระบบอยู่ในโหมดหยุดฉุกเฉิน", ok: false },
            steps: [
              ...o.steps,
              { at: Date.now(), label: "Blocked", labelTh: "ถูกระงับ", detail: "Emergency Stop เปิดอยู่" },
            ],
          })),
        );
        return;
      }

      if (!choice) {
        later(60, () =>
          patch(id, (o) => ({
            ...o,
            status: "rejected",
            response: { code: "NO_VENUE", message: "ไม่มี exchange ที่ตอบสนอง", ok: false },
            steps: [
              ...o.steps,
              { at: Date.now(), label: "Routing Failed", labelTh: "หาตลาดไม่ได้", detail: "ทุก venue offline" },
            ],
          })),
        );
        return;
      }

      const lat = choice.venue.latency;

      later(40, () =>
        patch(id, (o) => ({
          ...o,
          status: "routing",
          steps: [
            ...o.steps,
            { at: Date.now(), label: "Smart Routing", labelTh: "เลือกตลาด", detail: choice.reason },
          ],
        })),
      );

      later(90, () =>
        patch(id, (o) => ({
          ...o,
          status: "sent",
          steps: [
            ...o.steps,
            {
              at: Date.now(),
              label: "Order Sent",
              labelTh: "ส่งคำสั่ง",
              detail: `ไปยัง ${choice.venue.name} API`,
            },
          ],
        })),
      );

      later(90 + lat, () =>
        patch(id, (o) => ({
          ...o,
          status: "accepted",
          response: { code: "200 OK", message: "Order accepted", ok: true },
          steps: [
            ...o.steps,
            {
              at: Date.now(),
              label: "Exchange Accepted",
              labelTh: "ตลาดรับคำสั่ง",
              detail: `round-trip ${lat} ms`,
            },
          ],
        })),
      );

      later(140 + lat, () => {
        const levels = input.side === "BUY" ? book.asks : book.bids;
        const mid =
          book.bids[0] && book.asks[0]
            ? (book.bids[0].price + book.asks[0].price) / 2
            : (price ?? 0);

        const { avgPrice, filled, exhausted } = walkBook(levels, input.qty);

        if (avgPrice === null || filled === 0) {
          patch(id, (o) => ({
            ...o,
            status: "rejected",
            response: { code: "NO_LIQUIDITY", message: "สมุดคำสั่งว่างเกินไป", ok: false },
            steps: [
              ...o.steps,
              { at: Date.now(), label: "Rejected", labelTh: "ถูกปฏิเสธ", detail: "ไม่มีสภาพคล่องรองรับ" },
            ],
          }));
          return;
        }

        const slip = mid ? ((avgPrice - mid) / mid) * 100 * (input.side === "BUY" ? 1 : -1) : 0;
        const notional = filled * avgPrice;

        patch(id, (o) => ({
          ...o,
          status: exhausted ? "partial" : "filled",
          avgFillPrice: avgPrice,
          filledQty: filled,
          slippagePct: slip,
          feePaid: (notional * o.feePct) / 100,
          steps: [
            ...o.steps,
            {
              at: Date.now(),
              label: exhausted ? "Partial Fill" : "Filled",
              labelTh: exhausted ? "จับคู่บางส่วน" : "จับคู่ครบ",
              detail: `${filled.toFixed(6)} @ ${avgPrice.toFixed(2)} · slippage ${slip.toFixed(4)}%`,
            },
            ...(input.takeProfit || input.stopLoss
              ? [
                  {
                    at: Date.now() + 8,
                    label: "TP/SL Created",
                    labelTh: "สร้าง TP/SL",
                    detail: `TP ${input.takeProfit ?? "—"} · SL ${input.stopLoss ?? "—"}`,
                  },
                ]
              : []),
          ],
        }));
      });
    },
    [venues, price, symbol, emergencyStop, book, patch, later],
  );

  const cancel = useCallback(
    (id: string) =>
      patch(id, (o) =>
        ["filled", "rejected", "cancelled"].includes(o.status)
          ? o
          : {
              ...o,
              status: "cancelled",
              response: { code: "CANCELED", message: "ยกเลิกโดยผู้ใช้", ok: true },
              steps: [
                ...o.steps,
                { at: Date.now(), label: "Cancelled", labelTh: "ยกเลิก", detail: "ผู้ใช้สั่งยกเลิก" },
              ],
            },
      ),
    [patch],
  );

  // Positions are the net of everything that actually filled.
  const positions = useMemo<Position[]>(() => {
    const map = new Map<string, { qty: number; notional: number; orders: string[] }>();

    for (const o of orders) {
      if (o.filledQty === 0 || o.avgFillPrice === null) continue;
      const signed = o.side === "BUY" ? o.filledQty : -o.filledQty;
      const cur = map.get(o.symbol) ?? { qty: 0, notional: 0, orders: [] };
      cur.qty += signed;
      cur.notional += signed * o.avgFillPrice;
      cur.orders.push(o.id);
      map.set(o.symbol, cur);
    }

    return [...map.entries()]
      .filter(([, v]) => Math.abs(v.qty) > 1e-8)
      .map(([sym, v]) => ({
        symbol: sym,
        side: v.qty > 0 ? ("LONG" as const) : ("SHORT" as const),
        qty: Math.abs(v.qty),
        entry: Math.abs(v.notional / v.qty),
        orders: v.orders,
      }));
  }, [orders]);

  const closePosition = useCallback(
    (sym: string, fraction: number) => {
      const pos = positions.find((p) => p.symbol === sym);
      if (!pos) return;
      submit({
        side: pos.side === "LONG" ? "SELL" : "BUY",
        type: "MARKET",
        qty: pos.qty * fraction,
        limitPrice: null,
        reduceOnly: true,
        postOnly: false,
        takeProfit: null,
        stopLoss: null,
        source: "AI",
        aiName: "Partial Close Manager",
      });
    },
    [positions, submit],
  );

  // In AUTO mode the Execution AI places the first order itself once a book
  // and at least one venue are available — the same path a manual order takes.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    if (!autoMode || emergencyStop) return;
    if (venues.filter((v) => v.online).length === 0) return;
    if (book.asks.length === 0) return;

    seeded.current = true;
    const size = book.asks.slice(0, 5).reduce((a, l) => a + l.qty, 0) * 0.35;
    const id = setTimeout(
      () =>
        submit({
          side: "BUY",
          type: "MARKET",
          qty: Number(size.toFixed(6)),
          limitPrice: null,
          reduceOnly: false,
          postOnly: false,
          takeProfit: price ? Number((price * 1.018).toFixed(2)) : null,
          stopLoss: price ? Number((price * 0.991).toFixed(2)) : null,
          source: "AI",
          aiName: "Smart Execution AI",
        }),
      600,
    );
    return () => clearTimeout(id);
  }, [autoMode, emergencyStop, venues, book, price, submit]);

  const stats = useMemo(() => computeStats(orders), [orders]);
  const quality = useMemo(() => executionQuality(stats, routing), [stats, routing]);
  const selected = useMemo(
    () => orders.find((o) => o.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  );

  const value = useMemo<ExecState>(
    () => ({
      venues,
      routing,
      depth: book,
      orders,
      selected,
      select: setSelectedId,
      submit,
      cancel,
      positions,
      closePosition,
      stats,
      quality,
      autoMode,
      setAutoMode,
    }),
    [
      venues,
      routing,
      book,
      orders,
      selected,
      submit,
      cancel,
      positions,
      closePosition,
      stats,
      quality,
      autoMode,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useExec(): ExecState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useExec must be used inside <ExecProvider>");
  return ctx;
}
