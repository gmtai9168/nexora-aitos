"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  alertsToCsv,
  applyAlertFilters,
  DEFAULT_PREFS,
  EMPTY_ALERT_FILTERS,
  eventLog,
  evaluate,
  inTab,
  LIVE_RULES,
  reduceAlerts,
  RULE_BY_ID,
  stats,
  visibleToRole,
  type Alert,
  type AlertAction,
  type AlertFilters,
  type Preferences,
  type Snapshot,
  type TabId,
} from "@/lib/alerts";
import { useMarket, useNow } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";
import {
  AlertList,
  AlertToolbar,
  FiltersBar,
  SummaryCards,
  WorkflowStrip,
  type FilterPreset,
} from "./AlertPanels";
import { AlertDrawer } from "./AlertDrawer";
import { ChannelsPanel, SettingsPanel, SummaryDonut } from "./AlertSettings";

const POLL_MS = 20_000;

const DEFAULT_PRESETS: FilterPreset[] = [
  {
    id: "critical-open",
    name: "เหตุการณ์วิกฤตที่ยังเปิดอยู่",
    filters: { ...EMPTY_ALERT_FILTERS, severity: "critical", actionableOnly: true },
  },
  {
    id: "system",
    name: "เหตุการณ์ระบบ",
    filters: { ...EMPTY_ALERT_FILTERS, source: "sysops" },
  },
];

async function grab<T>(url: string, onFail: (u: string) => void): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } catch {
    onFail(url.split("?")[0]);
    return null;
  }
}

export function AlertsView() {
  const { quotes, exchanges, symbol, emergencyStop, setEmergencyStop } = useMarket();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [lastRun, setLastRun] = useState(0);
  const [tick, setTick] = useState(0);
  const [scanning, setScanning] = useState(true);

  const [tab, setTab] = useState<TabId>("all");
  const [view, setView] = useState<"list" | "card">("list");
  const [filters, setFilters] = useState<AlertFilters>(EMPTY_ALERT_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [presets, setPresets] = useState(DEFAULT_PRESETS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Shared mount-only clock — drives the "x minutes ago" labels without
  // putting Date.now() in render, which would differ from the server pass.
  const now = useNow(1000) ?? 0;

  const quoteList = useMemo(() => [...quotes.values()], [quotes]);

  /** One detection cycle over live public data plus this server's telemetry. */
  const scan = useCallback(async () => {
    const failed: string[] = [];
    const onFail = (u: string) => failed.push(u);

    const [health, context, venues, onchain, news] = await Promise.all([
      grab<Snapshot["health"]>("/api/health", onFail),
      grab<{
        supported: boolean;
        funding: number | null;
        oiChangePct: number | null;
        takerBuyShare: number | null;
        longAccount: number | null;
      }>(`/api/context?symbol=${encodeURIComponent(symbol)}`, onFail),
      grab<{ venues: Snapshot["venues"] }>(`/api/venues?symbol=${encodeURIComponent(symbol)}`, onFail),
      grab<{ fearGreed: number | null; hashTrendPct: number | null }>(
        `/api/onchain?symbol=${encodeURIComponent(symbol)}`,
        onFail,
      ),
      grab<{ items: { sentiment: string }[] }>("/api/news", onFail),
    ]);

    const ts = Date.now();
    const snapshot: Snapshot = {
      ts,
      quotes: quoteList,
      exchanges,
      health: health ?? null,
      context: context?.supported
        ? {
            symbol,
            funding: context.funding,
            oiChangePct: context.oiChangePct,
            takerBuyShare: context.takerBuyShare,
            longAccount: context.longAccount,
          }
        : null,
      venues: venues?.venues ?? [],
      onchain: onchain ?? null,
      news: news
        ? {
            negative: news.items.filter((i) => i.sentiment === "ลบ").length,
            positive: news.items.filter((i) => i.sentiment === "บวก").length,
            total: news.items.length,
          }
        : null,
      failedRoutes: failed,
      emergencyStop,
    };

    setAlerts((prev) => reduceAlerts(prev, evaluate(snapshot, prefs), prefs, ts));
    setLastRun(ts);
    setScanning(false);
  }, [quoteList, exchanges, symbol, emergencyStop, prefs]);

  // Non-overlapping poll: the next cycle is scheduled once this one settles.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      await scan();
      if (cancelled) return;
      setTick((t) => t + 1);
      timer = setTimeout(run, POLL_MS);
    };

    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(run, 0);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [scan]);

  const patch = (id: string, fn: (a: Alert) => Alert) =>
    setAlerts((prev) => prev.map((a) => (a.id === id ? fn(a) : a)));

  const visible = useMemo(
    () => alerts.filter((a) => visibleToRole(a, prefs.role)),
    [alerts, prefs.role],
  );

  const counts = useMemo(() => {
    const c = { all: 0, critical: 0, high: 0, general: 0, done: 0 } as Record<TabId, number>;
    for (const t of Object.keys(c) as TabId[]) c[t] = visible.filter((a) => inTab(a, t)).length;
    return c;
  }, [visible]);

  const shown = useMemo(
    () => applyAlertFilters(visible.filter((a) => inTab(a, tab)), filters, now),
    [visible, tab, filters, now],
  );

  const s = useMemo(() => stats(visible), [visible]);
  const selected = selectedId ? (alerts.find((a) => a.id === selectedId) ?? null) : null;

  const symbols = useMemo(
    () => [...new Set(alerts.map((a) => a.entity.symbol).filter((x): x is string => !!x))],
    [alerts],
  );
  const assignees = useMemo(
    () => [...new Set(alerts.map((a) => a.assignee).filter((x): x is string => !!x))],
    [alerts],
  );

  const activeFilterCount =
    (Object.keys(filters) as (keyof AlertFilters)[]).filter((k) => {
      const v = filters[k];
      return typeof v === "boolean" ? v : v !== "all" && v !== "";
    }).length;

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob(["﻿" + body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openAlert = (a: Alert) => {
    setSelectedId(a.id);
    if (a.status === "unread") {
      patch(a.id, (x) => ({
        ...x,
        status: "read",
        audit: [...x.audit, { time: Date.now(), actor: "Super Admin", action: "READ", detail: "เปิดอ่านรายละเอียดเหตุการณ์" }],
      }));
    }
  };

  const runAction = (a: AlertAction) => {
    if (!selected) return;
    const ts = Date.now();
    const log = (action: string, detail: string) => (x: Alert) => ({
      ...x,
      audit: [...x.audit, { time: ts, actor: "Super Admin", action, detail }],
    });

    switch (a.id) {
      case "ack":
        patch(selected.id, (x) => ({
          ...log("ACKNOWLEDGE", "ผู้ดูแลรับทราบเหตุการณ์")(x),
          status: "acknowledged",
          acknowledgedAt: x.acknowledgedAt ?? ts,
        }));
        break;
      case "investigate":
        patch(selected.id, (x) => ({
          ...log("INVESTIGATE", "เริ่มตรวจสอบเหตุการณ์")(x),
          status: "investigating",
          acknowledgedAt: x.acknowledgedAt ?? ts,
        }));
        break;
      case "resolve":
        patch(selected.id, (x) => ({
          ...log("RESOLVE", "ปิดเหตุการณ์โดยผู้ดูแล (Super Admin)")(x),
          status: "resolved",
          resolvedAt: ts,
          acknowledgedAt: x.acknowledgedAt ?? ts,
        }));
        break;
      case "snooze":
        patch(selected.id, (x) => ({
          ...log("SNOOZE", "เลื่อนการแสดงผล 30 นาที")(x),
          snoozeUntil: ts + 30 * 60_000,
        }));
        setSelectedId(null);
        break;
      case "rule": {
        const rule = RULE_BY_ID.get(selected.ruleId);
        setPresets((prev) =>
          prev.some((p) => p.id === `rule-${selected.ruleId}`)
            ? prev
            : [
                ...prev,
                {
                  id: `rule-${selected.ruleId}`,
                  name: rule?.th ?? selected.ruleId,
                  filters: { ...EMPTY_ALERT_FILTERS, severity: selected.severity, source: selected.source },
                },
              ],
        );
        patch(
          selected.id,
          log("CREATE_FILTER", `สร้างชุดตัวกรองจากกฎ "${rule?.th ?? selected.ruleId}"`),
        );
        break;
      }
      case "export":
        download(`nexora-event-${selected.ruleId}.txt`, eventLog(selected), "text/plain;charset=utf-8");
        patch(selected.id, log("EXPORT", "ส่งออกบันทึกเหตุการณ์เป็นไฟล์"));
        break;
      case "capital":
        setEmergencyStop(true);
        patch(
          selected.id,
          log("EMERGENCY_STOP", "เปิดโหมดหยุดฉุกเฉินทั้งแพลตฟอร์ม — พักบอททุกตัวและไม่เปิดสถานะใหม่"),
        );
        break;
      default:
        break;
    }
  };

  const nextIn = Math.max(0, Math.round((POLL_MS - (now - lastRun)) / 1000));

  return (
    <div className="flex flex-col gap-2.5">
      <SummaryCards
        s={s}
        tab={tab}
        onTab={(t) => {
          setTab(t);
          setPage(1);
        }}
      />

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="flex min-w-0 flex-col gap-2.5">
          <AlertList
            alerts={shown}
            now={now}
            view={view}
            activeId={selectedId}
            onSelect={openAlert}
            page={page}
            pageSize={view === "list" ? 12 : 8}
            onPage={setPage}
            header={
              <>
                <AlertToolbar
                  tab={tab}
                  onTab={(t) => {
                    setTab(t);
                    setPage(1);
                  }}
                  counts={counts}
                  view={view}
                  onView={setView}
                  filtersOpen={showFilters}
                  onFilters={() => setShowFilters((v) => !v)}
                  activeFilters={activeFilterCount}
                />
                {showFilters && (
                  <FiltersBar
                    f={filters}
                    onChange={(f) => {
                      setFilters(f);
                      setPage(1);
                    }}
                    onReset={() => setFilters(EMPTY_ALERT_FILTERS)}
                    symbols={symbols}
                    assignees={assignees}
                    presets={presets}
                    onApplyPreset={(p) => {
                      setFilters(p.filters);
                      setPage(1);
                    }}
                    onSavePreset={() =>
                      setPresets((prev) => [
                        ...prev,
                        { id: `preset-${prev.length}`, name: `ชุดที่ ${prev.length + 1}`, filters },
                      ])
                    }
                  />
                )}
              </>
            }
          />

          <WorkflowStrip lastRun={lastRun} nextIn={nextIn} />

          <Panel
            title="สถานะเครื่องตรวจจับ"
            titleEn="Detector Status"
            right={
              <div className="flex items-center gap-1.5">
                <Tag tone={scanning ? "warn" : "up"}>
                  {scanning ? "กำลังตรวจรอบแรก…" : `ตรวจแล้ว ${tick} รอบ`}
                </Tag>
                <button
                  type="button"
                  onClick={() => download("nexora-alerts.csv", alertsToCsv(visible), "text/csv;charset=utf-8")}
                  disabled={visible.length === 0}
                  className="rounded border border-line bg-[#0f1c26] px-2 py-[3px] text-[9.5px] text-muted hover:text-txt disabled:opacity-35"
                >
                  ส่งออกทั้งหมดเป็น CSV
                </button>
              </div>
            }
            bodyClassName="p-2.5"
          >
            <p className="text-[10px] leading-relaxed text-muted">
              กฎที่ตรวจจับได้จริง {LIVE_RULES.length} ข้อทำงานทุก {POLL_MS / 1000} วินาที
              บนข้อมูลสดจริง — ราคาและปริมาณซื้อขายจาก Binance, ความหน่วงและสถานะของ 5 กระดานที่วัดจริง,
              Funding และ Open Interest จากตลาดสัญญา, ค่าหน่วยความจำจากเซิร์ฟเวอร์ที่รันอยู่,
              และพาดหัวข่าวล่าสุด
            </p>
            <p className="mt-1.5 text-[9px] leading-snug text-dim">
              เหตุการณ์ที่เงื่อนไขกลับสู่ปกติจะถูกปิดเองอัตโนมัติ และเหตุการณ์เดิมที่ยังเกิดซ้ำ
              จะถูกรวมเป็นรายการเดียวพร้อมตัวนับ ไม่สร้างแถวใหม่ทุกรอบ ·
              กฎอีก {RULE_BY_ID.size - LIVE_RULES.length} ข้อในรายการตั้งค่าทำงานไม่ได้
              เพราะต้องใช้บัญชีเทรดจริงหรือโมเดลที่ให้บริการอยู่ ซึ่งระบุเหตุผลไว้รายข้อ
            </p>
          </Panel>
        </div>

        <div className="flex flex-col gap-2.5">
          <ChannelsPanel prefs={prefs} onChange={setPrefs} />
          <SettingsPanel prefs={prefs} onChange={setPrefs} now={now} />
          <SummaryDonut
            s={s}
            windowHours={24}
            onTab={(t) => {
              setTab(t);
              setPage(1);
            }}
          />
        </div>
      </div>

      {selected && (
        <AlertDrawer
          alert={selected}
          now={now}
          onClose={() => setSelectedId(null)}
          onAction={runAction}
          onAssign={(who) =>
            patch(selected.id, (x) => ({
              ...x,
              assignee: who,
              audit: [
                ...x.audit,
                {
                  time: Date.now(),
                  actor: "Super Admin",
                  action: "ASSIGN",
                  detail: who ? `มอบหมายให้ ${who}` : "ยกเลิกการมอบหมาย",
                },
              ],
            }))
          }
        />
      )}
    </div>
  );
}
