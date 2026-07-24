"use client";

import { useEffect, useMemo, useState } from "react";
import { fmtCompact, fmtNum, fmtPct } from "@/lib/format";
import {
  allocateCapital,
  AUM_BASE,
  boardMeeting,
  compliance,
  investors,
  projections,
  revenue,
  simulateCapital,
  treasury,
} from "@/lib/fund";
import { useMarket } from "@/lib/market-context";
import { useLiveAccount } from "@/lib/live-account";
import { buyHoldCurve, curveStat, runRoster } from "@/lib/performance";
import { blackSwan, committee, globalRisk, marketRisk, positionRisk } from "@/lib/risk-engine";
import { buildBook, curveStats, equityCurve } from "@/lib/book";
import type { Candle } from "@/lib/types";
import {
  AllocationPanel,
  BoardPanel,
  CeoPanel,
  CompliancePanel,
  FundKpis,
  InvestorPanel,
  ProjectionPanel,
  RevenuePanel,
  SimulatorPanel,
  TreasuryPanel,
} from "./FundPanels";

const NO_CANDLES: Candle[] = [];

export function FundOpsView() {
  const { symbol, quotes, candles, regime, context, exchanges, emergencyStop } = useMarket();
  const live = useLiveAccount();
  // Real money under management once the testnet account is present; the demo
  // AUM is used only when there is genuinely no account connected.
  const aum = live.connected || live.loading ? live.equity : AUM_BASE;
  const [history, setHistory] = useState<{ key: string; data: Candle[] }>({
    key: "",
    data: NO_CANDLES,
  });
  const [delta, setDelta] = useState(0);

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

  const hist = useMemo(
    () => (history.key === key ? history.data : NO_CANDLES),
    [history, key],
  );

  // The fund's performance comes from the same roster used on page 11.
  const { rows, portfolio } = useMemo(() => runRoster(hist), [hist]);
  const stat = useMemo(() => curveStat(portfolio), [portfolio]);
  const benchStat = useMemo(() => curveStat(buyHoldCurve(hist)), [hist]);

  const alloc = useMemo(() => allocateCapital(rows, aum, stat), [rows, stat, aum]);
  const investorRows = useMemo(() => investors(stat.returnPct, aum), [stat.returnPct, aum]);
  const treasuryRows = useMemo(() => treasury(aum, alloc), [alloc, aum]);

  const totalTrades = rows.reduce((a, r) => a + r.result.trades.length, 0);
  const rev = useMemo(
    () => revenue(aum, stat.returnPct, totalTrades),
    [stat.returnPct, totalTrades, aum],
  );

  // Risk state is shared with the Risk Engine page so the numbers agree.
  const book = useMemo(() => buildBook(quotes, live), [quotes, live]);
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
  const board = useMemo(
    () => committee(book, market, posRisk, null, swans, liveStats.drawdown),
    [book, market, posRisk, swans, liveStats.drawdown],
  );

  const complianceRows = useMemo(
    () =>
      compliance({
        alloc,
        stat,
        emergencyStop,
        venuesOnline: exchanges.filter((e) => e.online).length,
        venuesTotal: exchanges.length || 5,
        riskApproved: board.verdict !== "BLOCKED",
      }),
    [alloc, stat, emergencyStop, exchanges, board.verdict],
  );

  const projRows = useMemo(() => projections(aum, stat), [stat, aum]);
  const sim = useMemo(
    () => simulateCapital(aum, delta, alloc, stat),
    [delta, alloc, stat, aum],
  );
  const meeting = useMemo(
    () => boardMeeting(rows, alloc, stat, quotes, global.score),
    [rows, alloc, stat, quotes, global.score],
  );

  const best = [...rows].sort((a, b) => b.result.profitFactor - a.result.profitFactor)[0];
  const worst = [...rows].sort((a, b) => a.result.profitFactor - b.result.profitFactor)[0];
  const passedCompliance = complianceRows.filter((c) => c.pass).length;

  const summary = useMemo(() => {
    const alpha = stat.returnPct - benchStat.returnPct;
    return (
      `กองทุนมีสินทรัพย์ภายใต้การจัดการ ${fmtCompact(aum)} USD จากนักลงทุน ${investorRows.length} ราย · ` +
      `ผลตอบแทนของพอร์ตในช่วงที่วัด ${fmtPct(stat.returnPct)} เทียบกับการถือ ${symbol.replace("USDT", "")} เฉยๆ ที่ ${fmtPct(benchStat.returnPct)} ` +
      `คิดเป็นส่วนต่าง ${fmtPct(alpha)} ที่ Max Drawdown ${stat.maxDrawdown.toFixed(2)}% · ` +
      `AI-CIO ปล่อยทุนลงตลาด ${alloc.utilisationPct.toFixed(1)}% และถือเงินสด ${alloc.cashPct.toFixed(1)}% · ` +
      `กำไรสุทธิของบริษัทหลังหักต้นทุน ${fmtCompact(rev.net)} USD ต่อเดือน · ` +
      `การกำกับดูแลผ่าน ${passedCompliance} จาก ${complianceRows.length} ข้อ`
    );
  }, [stat, benchStat, symbol, alloc, rev.net, investorRows.length, passedCompliance, complianceRows.length, aum]);

  const kpis = [
    {
      th: "สินทรัพย์ภายใต้การจัดการ",
      en: "AUM",
      value: fmtCompact(aum),
      sub: `${investorRows.length} นักลงทุน`,
    },
    {
      th: "ผลตอบแทนพอร์ต",
      en: "Return",
      value: fmtPct(stat.returnPct),
      tone: stat.returnPct >= 0 ? "text-up" : "text-down",
      sub: `ถือยาว ${fmtPct(benchStat.returnPct)}`,
    },
    {
      th: "ส่วนต่างเหนือเกณฑ์",
      en: "Alpha",
      value: fmtPct(stat.returnPct - benchStat.returnPct),
      tone: stat.returnPct >= benchStat.returnPct ? "text-up" : "text-down",
    },
    {
      th: "อัตราการใช้ทุน",
      en: "Utilisation",
      value: `${alloc.utilisationPct.toFixed(1)}%`,
    },
    {
      th: "เงินสดสำรอง",
      en: "Cash",
      value: `${alloc.cashPct.toFixed(1)}%`,
      tone: alloc.cashPct >= 20 ? "text-up" : "text-warn",
    },
    {
      th: "กำไรสุทธิบริษัท",
      en: "Net Revenue",
      value: fmtCompact(rev.net),
      tone: rev.net >= 0 ? "text-up" : "text-down",
    },
    {
      th: "ความเสี่ยงกองทุน",
      en: "Risk",
      value: `${global.score}/100`,
      tone: global.band === "safe" ? "text-up" : global.band === "watch" ? "text-warn" : "text-down",
    },
    {
      th: "การกำกับดูแล",
      en: "Compliance",
      value: `${passedCompliance}/${complianceRows.length}`,
      tone: passedCompliance === complianceRows.length ? "text-up" : "text-down",
    },
  ];

  const ceoKpis = [
    { th: "AUM", value: fmtCompact(aum) },
    { th: "ผลตอบแทน", value: fmtPct(stat.returnPct), tone: stat.returnPct >= 0 ? "text-up" : "text-down" },
    { th: "Max Drawdown", value: `${stat.maxDrawdown.toFixed(2)}%` },
    { th: "เงินสด", value: `${alloc.cashPct.toFixed(1)}%` },
    { th: "ใช้ทุน", value: `${alloc.utilisationPct.toFixed(1)}%` },
    { th: "กำไรบริษัท", value: fmtCompact(rev.net), tone: rev.net >= 0 ? "text-up" : "text-down" },
    { th: "กลยุทธ์ดีสุด", value: best?.aiName ?? "—", tone: "text-up" },
    { th: "กลยุทธ์อ่อนสุด", value: worst?.aiName ?? "—", tone: "text-down" },
    { th: "ความเสี่ยง", value: `${global.score}/100` },
    { th: "นักลงทุน", value: `${investorRows.length} ราย` },
  ];

  const exportReport = (kind: string) => {
    const payload = {
      generatedFor: "NEXORA AITOS Fund Operations",
      aum: aum,
      portfolioReturnPct: Number(stat.returnPct.toFixed(4)),
      benchmarkReturnPct: Number(benchStat.returnPct.toFixed(4)),
      maxDrawdownPct: Number(stat.maxDrawdown.toFixed(4)),
      cashPct: Number(alloc.cashPct.toFixed(2)),
      netRevenue: Number(rev.net.toFixed(2)),
      sleeves: alloc.sleeves.map((s) => ({
        name: s.name,
        capital: Number(s.capital.toFixed(2)),
        weightPct: Number(s.weightPct.toFixed(2)),
        returnPct: Number(s.returnPct.toFixed(3)),
      })),
      investors: investorRows.map((i) => ({
        name: i.name,
        capital: i.capital,
        netReturnPct: Number(i.returnPct.toFixed(3)),
      })),
    };

    const body =
      kind === "CSV"
        ? [
            "sleeve,capital,weightPct,returnPct",
            ...payload.sleeves.map((s) => `${s.name},${s.capital},${s.weightPct},${s.returnPct}`),
          ].join("\n")
        : JSON.stringify(payload, null, 2);

    try {
      const blob = new Blob([body], {
        type: kind === "CSV" ? "text/csv" : "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexora-fund-report.${kind.toLowerCase()}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* download blocked */
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <FundKpis cards={kpis} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <AllocationPanel alloc={alloc} aum={aum} />
        <TreasuryPanel rows={treasuryRows} alloc={alloc} />
      </div>

      <InvestorPanel rows={investorRows} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <RevenuePanel
          income={rev.income}
          expense={rev.expense}
          totalIncome={rev.totalIncome}
          totalExpense={rev.totalExpense}
          net={rev.net}
        />
        <CompliancePanel rows={complianceRows} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ProjectionPanel rows={projRows} />
        <SimulatorPanel delta={delta} onDelta={setDelta} result={sim} aum={aum} />
      </div>

      <BoardPanel proposals={meeting.proposals} masterPlanTh={meeting.masterPlanTh} />

      <CeoPanel kpis={ceoKpis} summary={summary} onExport={exportReport} />

      <p className="panel px-3 py-2 text-[9.5px] leading-relaxed text-dim">
        <span className="text-brand">หมายเหตุ:</span> ยอด AUM ทะเบียนนักลงทุน และกระแสเงินสด
        เป็นชุดข้อมูลสาธิต ไม่มีบัญชีหรือบุคคลจริง ·{" "}
        <span className="text-muted">
          ส่วนที่คำนวณจากของจริงคือผลตอบแทนของทุกกลยุทธ์ การจัดสรรทุนโดย AI-CIO
          ค่าธรรมเนียมตามผลงาน การคาดการณ์ AUM และผลการตรวจสอบการกำกับดูแล
        </span>{" "}
        ซึ่งทั้งหมดอ้างอิงจาก Backtest บนแท่งเทียนจริง {fmtNum(hist.length, 0)} แท่ง
      </p>
    </div>
  );
}
