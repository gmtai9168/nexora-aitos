"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fleetStatus, TOTAL_AGENTS } from "@/lib/agents";
import {
  brainState,
  constitution,
  decisionQueue,
  goalProgress,
  systemHealth,
  type AutonomyMode,
  type MissionRecord,
} from "@/lib/autonomous";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import { fmtNum, fmtPct } from "@/lib/format";
import { useMarket } from "@/lib/market-context";
import { stressTest } from "@/lib/portfolio-intel";
import {
  blackSwan,
  committee,
  globalRisk,
  marketRisk,
  positionRisk,
  BAND_META,
} from "@/lib/risk-engine";
import { CRYPTO } from "@/lib/universe";
import { AIActivityFlow } from "../AIActivityFlow";
import { AINetworkPanel } from "../AINetworkPanel";
import {
  CommitteeVoting,
  ConstitutionPanel,
  DecisionQueue,
  GlobalStatusStrip,
  GoalPanel,
  HealthPanel,
  MasterBrain,
  MissionRecorder,
  ModeSelector,
  OverridePanel,
  OwnerRecommendation,
} from "./AutonomousPanels";

const QUEUE_SYMBOLS = CRYPTO.slice(0, 6).map((c) => c.symbol);
const MAX_RECORDS = 40;

export function AutonomousView() {
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
    tick,
  } = useMarket();

  const [mode, setMode] = useState<AutonomyMode>("semi");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [records, setRecords] = useState<MissionRecord[]>([]);
  const [latency, setLatency] = useState<number | null>(null);

  // Emergency mode and the global kill switch are the same thing.
  const effectiveMode: AutonomyMode = emergencyStop ? "emergency" : mode;

  const chooseMode = (m: AutonomyMode) => {
    setMode(m);
    setEmergencyStop(m === "emergency");
  };

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
  const positions = useMemo(() => positionRisk(book, regime), [book, regime]);
  const swans = useMemo(
    () => blackSwan(regime, context, quotes, exchanges, null),
    [regime, context, quotes, exchanges],
  );
  const global = useMemo(
    () => globalRisk(book, market, positions, null, swans, stats.drawdown),
    [book, market, positions, swans, stats.drawdown],
  );
  const board = useMemo(
    () => committee(book, market, positions, null, swans, stats.drawdown),
    [book, market, positions, swans, stats.drawdown],
  );

  const queue = useMemo(
    () => decisionQueue(quotes, QUEUE_SYMBOLS, effectiveMode, global.band),
    [quotes, effectiveMode, global.band],
  );

  const brain = useMemo(
    () => brainState(effectiveMode, decision, regime, global, book, symbol, queue),
    [effectiveMode, decision, regime, global, book, symbol, queue],
  );

  const goals = useMemo(() => goalProgress(book, stats.drawdown), [book, stats.drawdown]);

  const fleet = useMemo(
    () => fleetStatus(connected && !emergencyStop, regime.atr, tick),
    [connected, emergencyStop, regime.atr, tick],
  );
  const agentsOnline = useMemo(
    () => [...fleet.values()].filter((s) => s !== "offline" && s !== "paused").length,
    [fleet],
  );

  const health = useMemo(
    () => systemHealth(exchanges, connected, latency, agentsOnline, TOTAL_AGENTS),
    [exchanges, connected, latency, agentsOnline],
  );

  // Mission Recorder — one entry each time the Master verdict changes.
  const lastVerdict = useRef<string>("");
  useEffect(() => {
    if (!lastUpdate || !decision) return;
    const signature = `${decision.action}|${board.verdict}|${effectiveMode}`;
    if (signature === lastVerdict.current) return;
    lastVerdict.current = signature;

    const entry: MissionRecord = {
      at: lastUpdate,
      actor: "Master AI",
      action: `${decision.action} ${symbol.replace("USDT", "")}`,
      reason: `${decision.supporting} หนุน / ${decision.against} ค้าน · คณะกรรมการ ${board.verdict}`,
      confidence: decision.confidence,
      outcome: board.verdict,
    };

    const id = setTimeout(
      () => setRecords((prev) => [entry, ...prev].slice(0, MAX_RECORDS)),
      0,
    );
    return () => clearTimeout(id);
  }, [lastUpdate, decision, board.verdict, effectiveMode, symbol]);

  const articles = useMemo(
    () =>
      constitution({
        mode: effectiveMode,
        riskApproved: board.verdict !== "BLOCKED",
        drawdown: stats.drawdown,
        drawdownCap: 5,
        book,
        decision,
        recorderCount: records.length,
        untestedInProduction: false,
      }),
    [effectiveMode, board.verdict, stats.drawdown, book, decision, records.length],
  );

  const worstCase = useMemo(
    () => stressTest(book, [{ label: "ตลาด -10%", shockPct: -10 }])[0],
    [book],
  );

  const ownerLines = useMemo(() => {
    const best = queue.find((q) => q.status === "approved");
    const worst = [...positions].sort((a, b) => b.score - a.score)[0];

    return [
      {
        th: best ? `วันนี้ควรเน้น ${best.symbol.replace("USDT", "")} ฝั่ง ${best.side}` : "วันนี้ยังไม่มีสัญญาณที่ผ่านเกณฑ์",
        detail: best ? best.reason : "ทุกคู่ในคิวยังมีความมั่นใจต่ำกว่าเกณฑ์ที่ตั้งไว้",
        tone: best ? ("up" as const) : ("neutral" as const),
      },
      {
        th: worst ? `เฝ้าระวัง ${worst.symbol.replace("USDT", "")}` : "ไม่มีสถานะที่ต้องเฝ้าเป็นพิเศษ",
        detail: worst
          ? `คะแนนเสี่ยง ${worst.score.toFixed(0)} · ห่างจุดบังคับปิด ${worst.liqDistancePct.toFixed(1)}% · ${worst.recommendation}`
          : "ทุกสถานะอยู่ในเกณฑ์ปลอดภัย",
        tone: worst && worst.score >= 60 ? ("down" as const) : ("neutral" as const),
      },
      {
        th: `จำกัดจำนวนสถานะพร้อมกันไม่เกิน ${global.preservationMode ? 3 : 5} รายการ`,
        detail: global.preservationMode
          ? `อยู่ในโหมดรักษาเงินทุน — ${global.preservationReasonTh}`
          : `คะแนนความเสี่ยงรวม ${global.score}/100 อยู่ในโซน${BAND_META[global.band].th}`,
        tone: global.preservationMode ? ("warn" as const) : ("up" as const),
      },
      {
        th: `เลเวอเรจแนะนำไม่เกิน ${global.preservationMode ? 5 : book.configuredLeverage}X`,
        detail: `ตอนนี้ใช้จริง ${book.leverage.toFixed(2)}x · หากตลาดร่วง 10% พอร์ตจะเหลือ ${fmtNum(worstCase.equity, 0)} USD (${fmtPct(worstCase.equityPct)})`,
        tone: worstCase.liquidation ? ("down" as const) : ("up" as const),
      },
    ];
  }, [queue, positions, global, book, worstCase]);

  const statusCards = [
    {
      th: "สถานะระบบ",
      en: "System",
      value: emergencyStop ? "HALTED" : connected ? "ONLINE" : "RECONNECTING",
      tone: emergencyStop ? "text-down" : connected ? "text-up" : "text-warn",
    },
    { th: "AI ออนไลน์", en: "Agents", value: `${agentsOnline}/${TOTAL_AGENTS}`, tone: agentsOnline === TOTAL_AGENTS ? "text-up" : "text-warn" },
    {
      th: "Exchange",
      en: "Venues",
      value: `${exchanges.filter((e) => e.online).length}/${exchanges.length || 5}`,
    },
    { th: "ความหน่วง", en: "Latency", value: latency !== null ? `${latency} ms` : "—" },
    {
      th: "กำไรวันนี้",
      en: "Day P/L",
      value: fmtNum(book.dayPnl, 0),
      tone: book.dayPnl >= 0 ? "text-up" : "text-down",
    },
    {
      th: "ความเสี่ยงรวม",
      en: "Risk",
      value: `${global.score}/100`,
      tone: global.band === "safe" ? "text-up" : global.band === "watch" ? "text-warn" : "text-down",
    },
    {
      th: "ความมั่นใจ AI",
      en: "Confidence",
      value: `${decision?.confidence ?? 0}%`,
      tone: "text-brand",
    },
    {
      th: "โหมดปัจจุบัน",
      en: "Mode",
      value: effectiveMode.toUpperCase(),
      tone: effectiveMode === "emergency" ? "text-down" : effectiveMode === "full" ? "text-up" : "text-warn",
    },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <GlobalStatusStrip cards={statusCards} />

      <ModeSelector mode={effectiveMode} onMode={chooseMode} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <MasterBrain brain={brain} />
        <CommitteeVoting votes={board.votes} verdict={board.verdict} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_240px_minmax(0,1fr)]">
        <DecisionQueue items={queue} />
        <AIActivityFlow />
        <OwnerRecommendation lines={ownerLines} />
      </div>

      <div className="grid items-start gap-2.5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <AINetworkPanel />
        <div className="flex min-w-0 flex-col gap-2.5">
          <div className="grid gap-2.5 md:grid-cols-2">
            <GoalPanel goals={goals} />
            <OverridePanel
              active={overrides}
              onToggle={(k) => setOverrides((p) => ({ ...p, [k]: !p[k] }))}
            />
          </div>
          <HealthPanel rows={health} />
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <MissionRecorder records={records} />
        <ConstitutionPanel articles={articles} />
      </div>
    </div>
  );
}
