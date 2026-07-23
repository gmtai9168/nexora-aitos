"use client";

import { useEffect, useMemo, useState } from "react";
import { fleetStatus, TOTAL_AGENTS } from "@/lib/agents";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import {
  aiVision,
  boardRoom,
  companyTwin,
  COMPANY_AUM,
  COMPANY_DECISIONS,
  financials,
  forecast,
  globalKpis,
  investorIntelligence,
  strategicMoves,
} from "@/lib/executive";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import { allocateCapital, investors } from "@/lib/fund";
import { useMarket } from "@/lib/market-context";
import { buyHoldCurve, curveStat, runRoster } from "@/lib/performance";
import { blackSwan, globalRisk, marketRisk, positionRisk } from "@/lib/risk-engine";
import { clusterNodes, EMPTY_HEALTH, type ServerHealth } from "@/lib/sysops";
import type { Candle } from "@/lib/types";
import {
  BoardRoomPanel,
  CommandPanel,
  CompanyTwinPanel,
  ExecutiveOverview,
  FinancialPanel,
  ForecastPanel,
  GlobalKpiPanel,
  InvestorIntelPanel,
  StrategyPanel,
} from "./ExecPanels";

const NO_CANDLES: Candle[] = [];

export function ExecutiveView() {
  const {
    symbol,
    quotes,
    candles,
    regime,
    context,
    exchanges,
    connected,
    emergencyStop,
    setEmergencyStop,
    tick,
  } = useMarket();

  const [history, setHistory] = useState<{ key: string; data: Candle[] }>({
    key: "",
    data: NO_CANDLES,
  });
  const [health, setHealth] = useState<ServerHealth>(EMPTY_HEALTH);
  const [twinKey, setTwinKey] = useState(COMPANY_DECISIONS[0].key);
  const [commands, setCommands] = useState<Record<string, boolean>>({});

  const key = `${symbol}|1h|2000`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&interval=1h&bars=2000`,
        );
        const data: { candles: Candle[] } = await res.json();
        if (!cancelled) setHistory({ key, data: data.candles ?? NO_CANDLES });
      } catch {
        if (!cancelled) setHistory({ key, data: NO_CANDLES });
      }
    };
    const id = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [symbol, key]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        if (!cancelled) setHealth(await res.json());
      } catch {
        /* keep last reading */
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
  }, []);

  const hist = useMemo(
    () => (history.key === key ? history.data : NO_CANDLES),
    [history, key],
  );

  // The whole company view reduces to one roster run plus the live risk state.
  const { rows } = useMemo(() => runRoster(hist), [hist]);
  const portfolio = useMemo(() => runRoster(hist).portfolio, [hist]);
  const stat = useMemo(() => curveStat(portfolio), [portfolio]);
  const benchStat = useMemo(() => curveStat(buyHoldCurve(hist)), [hist]);
  const alloc = useMemo(() => allocateCapital(rows, COMPANY_AUM, stat), [rows, stat]);
  const investorRows = useMemo(() => investors(stat.returnPct), [stat.returnPct]);
  const segments = useMemo(() => investorIntelligence(investorRows), [investorRows]);

  const book = useMemo(() => buildBook(quotes), [quotes]);
  const liveCurve = useMemo(() => equityCurve(candles, book.equity), [candles, book.equity]);
  const liveStats = useMemo(() => curveStats(liveCurve), [liveCurve]);
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
    () => globalRisk(book, market, posRisk, null, swans, liveStats.drawdown),
    [book, market, posRisk, swans, liveStats.drawdown],
  );

  const online = connected && !emergencyStop;
  const fleet = useMemo(
    () => fleetStatus(online, regime.atr, tick),
    [online, regime.atr, tick],
  );
  const agentsOnline = useMemo(
    () => [...fleet.values()].filter((s) => s !== "offline" && s !== "paused").length,
    [fleet],
  );
  const busyRatio = useMemo(() => {
    const busy = [...fleet.values()].filter(
      (s) => s === "thinking" || s === "voting" || s === "executing" || s === "learning",
    ).length;
    return busy / TOTAL_AGENTS;
  }, [fleet]);
  const nodes = useMemo(() => clusterNodes(busyRatio, online), [busyRatio, online]);

  const totalTrades = rows.reduce((a, r) => a + r.result.trades.length, 0);
  const fin = useMemo(
    () => financials(COMPANY_AUM, stat.returnPct, totalTrades, nodes.length),
    [stat.returnPct, totalTrades, nodes.length],
  );

  const forecastRows = useMemo(
    () => forecast(COMPANY_AUM, stat, investorRows.length),
    [stat, investorRows.length],
  );

  const heapPct = health.heapTotalMb ? (health.heapUsedMb / health.heapTotalMb) * 100 : 0;

  const board = useMemo(
    () => boardRoom({ rows, alloc, stat, global, fin, health, heapPct }),
    [rows, alloc, stat, global, fin, health, heapPct],
  );

  const twins = useMemo(
    () =>
      COMPANY_DECISIONS.map((d) =>
        companyTwin(
          d,
          {
            aum: COMPANY_AUM,
            fin,
            nodes: nodes.length,
            riskScore: global.score,
            agents: TOTAL_AGENTS,
          },
          stat.returnPct,
          totalTrades,
        ),
      ),
    [fin, nodes.length, global.score, stat.returnPct, totalTrades],
  );

  const moves = useMemo(
    () =>
      strategicMoves({
        rows,
        alloc,
        stat,
        global,
        fin,
        twins,
        venuesDown: exchanges.filter((e) => !e.online).length,
      }),
    [rows, alloc, stat, global, fin, twins, exchanges],
  );

  const kpis = useMemo(
    () =>
      globalKpis({
        stat,
        benchStat,
        global,
        fin,
        health,
        agentsOnline,
        agentsTotal: TOTAL_AGENTS,
        probesOk: exchanges.filter((e) => e.online).length,
        probesTotal: exchanges.length || 5,
        investors: investorRows.length,
      }),
    [stat, benchStat, global, fin, health, agentsOnline, exchanges, investorRows.length],
  );

  const vision = useMemo(
    () => aiVision({ stat, alloc, fin, rows, global }),
    [stat, alloc, fin, rows, global],
  );

  // One number for the whole company.
  const companyHealth = Math.round(
    Math.max(
      0,
      Math.min(
        100,
        (100 - global.score) * 0.3 +
          Math.min(100, Math.max(0, fin.ebitdaMarginPct)) * 0.2 +
          (agentsOnline / TOTAL_AGENTS) * 100 * 0.2 +
          Math.min(100, Math.max(0, 50 + (stat.returnPct - benchStat.returnPct) * 2)) * 0.3,
      ),
    ),
  );

  const alpha = stat.returnPct - benchStat.returnPct;

  const summary = useMemo(() => {
    const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
    return (
      `กองทุนบริหารสินทรัพย์ ${fmtCompact(COMPANY_AUM)} USD จากนักลงทุน ${investorRows.length} ราย · ` +
      `พอร์ตให้ผลตอบแทน ${fmtPct(stat.returnPct)} เทียบกับการถือ ${symbol.replace("USDT", "")} เฉยๆ ที่ ${fmtPct(benchStat.returnPct)} คิดเป็นส่วนต่าง ${fmtPct(alpha)} ที่ Drawdown ${stat.maxDrawdown.toFixed(2)}% · ` +
      `${best ? `กลยุทธ์ที่แข็งที่สุดคือ ${best.name} (PF ${best.result.profitFactor.toFixed(2)})` : "ยังไม่มีกลยุทธ์ที่โดดเด่น"} · ` +
      `ธุรกิจ${fin.ebitda >= 0 ? `ทำกำไร EBITDA ${fmtCompact(fin.ebitda)} USD/เดือน` : `ยังขาดทุน ${fmtCompact(Math.abs(fin.ebitda))} USD/เดือน`} ที่อัตรากำไร ${fin.ebitdaMarginPct.toFixed(1)}% · ` +
      `ความเสี่ยงรวม ${global.score}/100 และ AI ทำงาน ${agentsOnline}/${TOTAL_AGENTS} ตัว` +
      `${emergencyStop ? " · ระบบอยู่ในโหมดหยุดฉุกเฉิน" : ""}`
    );
  }, [rows, investorRows.length, stat, benchStat, alpha, symbol, fin, global.score, agentsOnline, emergencyStop]);

  const overviewCards = [
    { th: "มูลค่ากองทุน", en: "AUM", value: fmtCompact(COMPANY_AUM) },
    {
      th: "ผลตอบแทนพอร์ต",
      en: "Return",
      value: fmtPct(stat.returnPct),
      tone: stat.returnPct >= 0 ? "text-up" : "text-down",
    },
    {
      th: "เหนือเกณฑ์",
      en: "Alpha",
      value: fmtPct(alpha),
      tone: alpha >= 0 ? "text-up" : "text-down",
    },
    {
      th: "EBITDA/เดือน",
      en: "EBITDA",
      value: fmtCompact(fin.ebitda),
      tone: fin.ebitda >= 0 ? "text-up" : "text-down",
    },
    {
      th: "ความเสี่ยงรวม",
      en: "Risk",
      value: `${global.score}/100`,
      tone: global.band === "safe" ? "text-up" : global.band === "watch" ? "text-warn" : "text-down",
    },
    { th: "เงินสดสำรอง", en: "Cash", value: `${alloc.cashPct.toFixed(1)}%` },
    {
      th: "AI ทำงานอยู่",
      en: "Agents",
      value: `${agentsOnline}/${TOTAL_AGENTS}`,
      tone: agentsOnline === TOTAL_AGENTS ? "text-up" : "text-warn",
    },
    { th: "นักลงทุน", en: "Investors", value: `${investorRows.length} ราย` },
    {
      th: "Max Drawdown",
      en: "DD",
      value: `${stat.maxDrawdown.toFixed(2)}%`,
      tone: stat.maxDrawdown > 15 ? "text-down" : "text-up",
    },
    {
      th: "สถานะระบบ",
      en: "System",
      value: emergencyStop ? "HALTED" : connected ? "ONLINE" : "DEGRADED",
      tone: emergencyStop ? "text-down" : connected ? "text-up" : "text-warn",
    },
  ];

  const runCommand = (k: string) => {
    setCommands((p) => ({ ...p, [k]: !p[k] }));
    if (k === "emergency") setEmergencyStop(!emergencyStop);
  };

  const exportReport = (kind: string) => {
    const payload = {
      company: "NEXORA AITOS",
      aum: COMPANY_AUM,
      portfolioReturnPct: Number(stat.returnPct.toFixed(4)),
      benchmarkReturnPct: Number(benchStat.returnPct.toFixed(4)),
      alphaPct: Number(alpha.toFixed(4)),
      maxDrawdownPct: Number(stat.maxDrawdown.toFixed(4)),
      riskScore: global.score,
      ebitda: Number(fin.ebitda.toFixed(2)),
      ebitdaMarginPct: Number(fin.ebitdaMarginPct.toFixed(2)),
      investors: investorRows.length,
      companyHealth,
      board: board.seats.map((s) => ({ officer: s.officer, proposal: s.proposalTh })),
      strategy: moves.map((m) => ({ move: m.th, priority: m.priority })),
    };

    const body =
      kind === "CSV"
        ? [
            "metric,value",
            ...Object.entries(payload)
              .filter(([, v]) => typeof v !== "object")
              .map(([k2, v]) => `${k2},${v}`),
          ].join("\n")
        : JSON.stringify(payload, null, 2);

    try {
      const blob = new Blob([body], {
        type: kind === "CSV" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexora-board-report.${kind.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* download blocked */
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <ExecutiveOverview health={companyHealth} summary={summary} cards={overviewCards} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <FinancialPanel fin={fin} />
        <InvestorIntelPanel rows={segments} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <BoardRoomPanel seats={board.seats} ceoPlanTh={board.ceoPlanTh} />
        <StrategyPanel moves={moves} />
      </div>

      <ForecastPanel rows={forecastRows} />

      <CompanyTwinPanel
        twins={twins}
        selected={twinKey}
        onSelect={setTwinKey}
        decisions={COMPANY_DECISIONS}
      />

      <GlobalKpiPanel rows={kpis} />

      <CommandPanel
        vision={vision}
        onCommand={runCommand}
        active={commands}
        onExport={exportReport}
      />

      <p className="panel px-3 py-2 text-[9.5px] leading-relaxed text-dim">
        <span className="text-brand">หมายเหตุ:</span> AUM {fmtNum(COMPANY_AUM, 0)} USD
        ทะเบียนนักลงทุน และค่าใช้จ่ายด้านบุคลากร เป็นชุดข้อมูลสาธิต ·{" "}
        <span className="text-muted">
          ส่วนที่คำนวณจากของจริงคือผลตอบแทนของทุกกลยุทธ์ (Backtest บนแท่งเทียนจริง{" "}
          {fmtNum(hist.length, 0)} แท่ง), การจัดสรรทุนของ AI-CIO, ค่าธรรมเนียมตามผลงาน,
          คะแนนความเสี่ยง, telemetry ของเซิร์ฟเวอร์ และการคำนวณทุกฉากใน Company Digital Twin
        </span>
      </p>
    </div>
  );
}
