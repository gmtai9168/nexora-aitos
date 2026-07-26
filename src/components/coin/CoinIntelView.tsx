"use client";

import { useMemo } from "react";
import { useMarket } from "@/lib/market-context";
import {
  consensus as buildConsensus,
  entryPlan,
  riskAnalysis,
  scoreCoin,
} from "@/lib/scoring";
import { newsBalance, useCoinIntel } from "@/lib/use-coin-intel";
import { ErrorBoundary } from "../ErrorBoundary";
import { TradingChart } from "../TradingChart";
import { AiScorePanel } from "./AiScorePanel";
import { CoinProfile } from "./CoinProfile";
import { ConsensusPanel } from "./ConsensusPanel";
import { EntryPlanPanel } from "./EntryPlanPanel";
import { FuturesPanel } from "./FuturesPanel";
import { NewsPanel } from "./NewsPanel";
import { OnChainPanel } from "./OnChainPanel";
import { OrderBookPanel } from "./OrderBookPanel";
import { ReasoningPanel } from "./ReasoningPanel";
import { ReplayPanel } from "./ReplayPanel";
import { RiskPanel } from "./RiskPanel";
import { SmartMoneyPanel } from "./SmartMoneyPanel";
import { TopCoinsTable } from "./TopCoinsTable";

export function CoinIntelView() {
  const { symbol, candles, regime, context, quotes, decision, exchanges } = useMarket();
  const intel = useCoinIntel(symbol);

  const balance = useMemo(() => newsBalance(intel.news), [intel.news]);

  const score = useMemo(
    () =>
      scoreCoin(
        candles,
        regime,
        context,
        intel.onchain,
        intel.correlations,
        balance,
        quotes.get(symbol),
      ),
    [candles, regime, context, intel.onchain, intel.correlations, balance, quotes, symbol],
  );

  const consensus = useMemo(() => buildConsensus(score, quotes), [score, quotes]);
  const plan = useMemo(() => entryPlan(decision), [decision]);

  const risks = useMemo(
    () =>
      riskAnalysis(
        regime,
        context,
        intel.correlations,
        intel.onchain,
        exchanges.filter((e) => !e.online).length,
        balance.negative,
      ),
    [regime, context, intel.correlations, intel.onchain, exchanges, balance.negative],
  );

  const isStock = !/USDT$/.test(symbol);

  return (
    <div className="flex flex-col gap-2.5">
      <CoinProfile
        onchain={intel.onchain}
        correlations={intel.correlations}
        confidence={decision?.confidence ?? 0}
      />

      {isStock && (
        <div className="rounded-lg border border-brand/30 bg-[#0a1a20] px-3 py-2 text-[10px] leading-relaxed text-dim">
          <span className="font-semibold text-brand">โหมดหุ้น/ดัชนี/สินค้าโภคภัณฑ์:</span> วิเคราะห์จากราคาจริง — เทรนด์ · โมเมนตัม · ความผันผวน · วอลุ่ม · ตำแหน่งในกรอบวัน · ความสัมพันธ์สินทรัพย์
          <br />
          ปัจจัยเฉพาะคริปโต (Funding · สัญญาคงค้าง OI · แรงซื้อวาฬ · Liquidation · ออนเชน · Order Book เชิงลึก) ไม่มีในตลาดนี้ จึงแสดงเป็น N/A
        </div>
      )}

      {/* Screen → chart → verdict */}
      <div className="grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)_336px]">
        <TopCoinsTable />
        <ErrorBoundary resetKey={symbol}><TradingChart /></ErrorBoundary>
        <div className="flex min-w-0 flex-col gap-2.5">
          <ErrorBoundary resetKey={symbol}><AiScorePanel score={score} /></ErrorBoundary>
          <ErrorBoundary resetKey={symbol}><ConsensusPanel data={consensus} /></ErrorBoundary>
        </div>
      </div>

      {/* Microstructure and flow */}
      <div className="grid gap-2.5 xl:grid-cols-2">
        <ErrorBoundary resetKey={symbol}><OrderBookPanel micro={intel.micro} /></ErrorBoundary>
        <ErrorBoundary resetKey={symbol}><SmartMoneyPanel micro={intel.micro} /></ErrorBoundary>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ErrorBoundary resetKey={symbol}><FuturesPanel /></ErrorBoundary>
        <ErrorBoundary resetKey={symbol}><OnChainPanel data={intel.onchain} /></ErrorBoundary>
      </div>

      {/* Decision and its consequences */}
      <div className="grid gap-2.5 xl:grid-cols-2">
        <ErrorBoundary resetKey={symbol}><EntryPlanPanel plan={plan} /></ErrorBoundary>
        <ErrorBoundary resetKey={symbol}><RiskPanel rows={risks} /></ErrorBoundary>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ErrorBoundary resetKey={symbol}>
          <ReasoningPanel
            score={score}
            consensus={consensus}
            plan={plan}
            micro={intel.micro}
            onchain={intel.onchain}
          />
        </ErrorBoundary>
        <ErrorBoundary resetKey={symbol}><NewsPanel items={intel.news} /></ErrorBoundary>
      </div>

      <ErrorBoundary resetKey={symbol}><ReplayPanel score={score} /></ErrorBoundary>
    </div>
  );
}
