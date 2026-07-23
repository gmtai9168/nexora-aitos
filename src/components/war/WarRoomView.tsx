"use client";

import { useEffect, useMemo, useState } from "react";
import type { MacroRow } from "@/app/api/macro/route";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import { fmtCompact, fmtPct } from "@/lib/format";
import { regionPulse } from "@/lib/global-intel";
import { useMarket, useNow } from "@/lib/market-context";
import {
  blackSwan,
  globalRisk,
  marketRisk,
  positionRisk,
  BAND_META,
} from "@/lib/risk-engine";
import {
  aiDialogue,
  CRISIS_SCENARIOS,
  defenceLine,
  incidents,
  missionObjective,
  simulateCrisis,
  tactics,
  threats,
  warModeActions,
  worldStatus,
} from "@/lib/warroom";
import {
  CommandConsole,
  CrisisPanel,
  DefencePanel,
  DialoguePanel,
  IncidentPanel,
  RiskMapPanel,
  TacticPanel,
  ThreatPanel,
  WarModePanel,
} from "./WarPanels";

const NO_ROWS: MacroRow[] = [];

const CONSOLE_ACTIONS: {
  key: string;
  th: string;
  detail: string;
  tone: "up" | "warn" | "down";
}[] = [
  { key: "auto", th: "FULL AUTO", detail: "ให้ AI ตัดสินใจเองทั้งหมด", tone: "up" },
  { key: "reduce", th: "ลดความเสี่ยง", detail: "ลดขนาดทุกสถานะลงครึ่งหนึ่ง", tone: "warn" },
  { key: "pause-symbol", th: "พักคู่ที่เลือก", detail: "ไม่เปิดสถานะใหม่ในคู่นี้", tone: "warn" },
  { key: "pause-venue", th: "พัก Exchange", detail: "หยุดส่งคำสั่งไป venue ที่มีปัญหา", tone: "warn" },
  { key: "hedge-only", th: "เปิดเฉพาะ Hedge", detail: "อนุญาตเฉพาะสถานะป้องกันความเสี่ยง", tone: "warn" },
  { key: "close-only", th: "ปิดสถานะเท่านั้น", detail: "ห้ามเปิดใหม่ ปิดได้อย่างเดียว", tone: "down" },
];

export function WarRoomView() {
  const {
    quotes,
    candles,
    regime,
    context,
    exchanges,
    connected,
    decision,
    symbol,
    emergencyStop,
    setEmergencyStop,
    lastUpdate,
  } = useMarket();

  const [macro, setMacro] = useState<MacroRow[]>(NO_ROWS);
  const [manualWar, setManualWar] = useState(false);
  const [crisis, setCrisis] = useState(CRISIS_SCENARIOS[0].key);
  const [console, setConsole] = useState<Record<string, boolean>>({ auto: true });
  const [latency, setLatency] = useState<number | null>(null);
  const now = useNow(10000);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/macro");
        const data = await res.json();
        if (!cancelled && data.rows?.length) setMacro(data.rows);
      } catch {
        /* keep last board */
      }
      if (!cancelled) timer = setTimeout(load, 120000);
    };
    const frame = requestAnimationFrame(() => {
      if (!cancelled) timer = setTimeout(load, 0);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, []);

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

  const book = useMemo(() => buildBook(quotes), [quotes]);
  const curve = useMemo(() => equityCurve(candles, book.equity), [candles, book.equity]);
  const stats = useMemo(() => curveStats(curve), [curve]);

  const market = useMemo(
    () => marketRisk(regime, context, quotes.get(symbol), exchanges, 0, null),
    [regime, context, quotes, symbol, exchanges],
  );
  const posRisk = useMemo(() => positionRisk(book, regime), [book, regime]);
  const swans = useMemo(
    () => blackSwan(regime, context, quotes, exchanges, null),
    [regime, context, quotes, exchanges],
  );
  const global = useMemo(
    () => globalRisk(book, market, posRisk, null, swans, stats.drawdown),
    [book, market, posRisk, swans, stats.drawdown],
  );

  // War Mode arms itself when a black swan fires or the kill switch is pulled.
  const autoWar = swans.some((s) => s.triggered) || emergencyStop;
  const warActive = manualWar || autoWar;

  const threatRows = useMemo(
    () => threats(market, context, regime, swans, exchanges),
    [market, context, regime, swans, exchanges],
  );
  const defence = useMemo(
    () => defenceLine(book, global, null, regime),
    [book, global, regime],
  );
  const dialogue = useMemo(
    () => aiDialogue(regime, context, global, decision, symbol),
    [regime, context, global, decision, symbol],
  );
  const incidentRows = useMemo(
    () => incidents(exchanges, regime, context, connected, latency),
    [exchanges, regime, context, connected, latency],
  );
  const objective = useMemo(
    () => missionObjective(global, regime, book, warActive),
    [global, regime, book, warActive],
  );
  const tacticRows = useMemo(
    () => tactics(global, regime, book, threatRows, warActive),
    [global, regime, book, threatRows, warActive],
  );
  const crisisResults = useMemo(
    () => CRISIS_SCENARIOS.map((s) => simulateCrisis(book, s)),
    [book],
  );
  const regions = useMemo(() => regionPulse(macro), [macro]);
  const world = useMemo(() => worldStatus(quotes), [quotes]);

  const statusCards = [
    {
      th: "ภัยคุกคามที่ทำงานอยู่",
      en: "Active Threats",
      value: `${threatRows.filter((t) => t.severity !== "LOW").length}`,
      tone: threatRows.some((t) => t.severity === "HIGH" || t.severity === "CRITICAL")
        ? "text-down"
        : "text-up",
    },
    {
      th: "ความผันผวนตลาด",
      en: "Volatility",
      value: `${regime.atr.toFixed(2)}%`,
      tone: regime.atr > 2 ? "text-down" : "text-up",
    },
    {
      th: "คะแนนแนวป้องกัน",
      en: "Defense Score",
      value: `${defence.overall}/100`,
      tone: defence.overall >= 75 ? "text-up" : "text-warn",
    },
    {
      th: "เงินทุนที่คุ้มครอง",
      en: "Protected Capital",
      value: fmtCompact(book.equity),
    },
    {
      th: "ความเสี่ยงรวม",
      en: "Risk",
      value: `${global.score}/100`,
      tone:
        global.band === "safe" ? "text-up" : global.band === "watch" ? "text-warn" : "text-down",
    },
    {
      th: "เหตุการณ์ที่กำลังเกิด",
      en: "Live Incidents",
      value: `${incidentRows.filter((i) => i.active).length}`,
      tone: incidentRows.some((i) => i.active) ? "text-down" : "text-up",
    },
    {
      th: "ทิศทางคริปโตรวม",
      en: "Breadth",
      value: `${world.breadth.toFixed(0)}% ขึ้น`,
      tone: world.breadth >= 50 ? "text-up" : "text-down",
    },
    {
      th: "สถานะสงคราม",
      en: "War Mode",
      value: warActive ? "ON" : "OFF",
      tone: warActive ? "text-down" : "text-up",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {statusCards.map((c) => (
          <div key={c.th} className="panel min-w-0 flex-1 px-2.5 py-1.5">
            <div className="truncate text-[9px] tracking-wide text-dim">
              {c.th} <span className="text-[8px]">{c.en}</span>
            </div>
            <div className={`num truncate text-[15px] font-bold ${c.tone ?? "text-txt"}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <WarModePanel
        active={warActive}
        auto={autoWar}
        onToggle={() => {
          if (autoWar && !manualWar) {
            // The only way to clear an auto-armed war mode is to clear the cause.
            setEmergencyStop(false);
          }
          setManualWar((v) => !v);
        }}
        actions={warModeActions(warActive, book)}
        objective={objective}
      />

      <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <RiskMapPanel regions={regions} />
        <ThreatPanel rows={threatRows} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <DialoguePanel lines={dialogue} at={lastUpdate || now} />
        <DefencePanel rows={defence.rows} overall={defence.overall} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <TacticPanel rows={tacticRows} />
        <IncidentPanel rows={incidentRows} />
      </div>

      <CrisisPanel results={crisisResults} selected={crisis} onSelect={setCrisis} />

      <CommandConsole
        actions={CONSOLE_ACTIONS}
        active={console}
        onToggle={(k) => setConsole((p) => ({ ...p, [k]: !p[k] }))}
      />

      <p className="panel px-3 py-2 text-[9.5px] leading-relaxed text-dim">
        <span className="text-brand">สถานะระบบ:</span> ความเสี่ยงรวม {global.score}/100 (
        {BAND_META[global.band].th}) · ผลตอบแทนวันนี้ {fmtPct(book.dayPnlPct)} ·{" "}
        {warActive
          ? "WAR MODE ทำงานอยู่ ระบบจำกัดความเสี่ยงทั้งหมดจนกว่าเงื่อนไขจะคลี่คลาย"
          : "ระบบทำงานปกติ ทุกแผงอัปเดตจากฟีดจริงและคำนวณใหม่ทุกครั้งที่ราคาเปลี่ยน"}
      </p>
    </div>
  );
}
