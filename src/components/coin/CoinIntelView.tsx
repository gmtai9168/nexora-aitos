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

  return (
    <div className="flex flex-col gap-2.5">
      <CoinProfile
        onchain={intel.onchain}
        correlations={intel.correlations}
        confidence={decision?.confidence ?? 0}
      />

      {/* Screen → chart → verdict */}
      <div className="grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)_336px]">
        <TopCoinsTable />
        <TradingChart />
        <div className="flex min-w-0 flex-col gap-2.5">
          <AiScorePanel score={score} />
          <ConsensusPanel data={consensus} />
        </div>
      </div>

      {/* Microstructure and flow */}
      <div className="grid gap-2.5 xl:grid-cols-2">
        <OrderBookPanel micro={intel.micro} />
        <SmartMoneyPanel micro={intel.micro} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <FuturesPanel />
        <OnChainPanel data={intel.onchain} />
      </div>

      {/* Decision and its consequences */}
      <div className="grid gap-2.5 xl:grid-cols-2">
        <EntryPlanPanel plan={plan} />
        <RiskPanel rows={risks} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ReasoningPanel
          score={score}
          consensus={consensus}
          plan={plan}
          micro={intel.micro}
          onchain={intel.onchain}
        />
        <NewsPanel items={intel.news} />
      </div>

      <ReplayPanel score={score} />
    </div>
  );
}
