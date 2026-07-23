import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { AIActivityFlow } from "@/components/AIActivityFlow";
import { AINetworkPanel } from "@/components/AINetworkPanel";
import { CoinHeatmap } from "@/components/CoinHeatmap";
import { LivePositions } from "@/components/LivePositions";
import { MasterDecision } from "@/components/MasterDecision";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { RiskEngine } from "@/components/RiskEngine";
import { TopAIToday } from "@/components/TopAIToday";
import { TradingChart } from "@/components/TradingChart";

function Skeleton() {
  return (
    <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-2.5">
        <PanelSkeleton height={210} />
        <PanelSkeleton height={190} />
        <PanelSkeleton height={430} />
      </div>
      <div className="flex flex-col gap-2.5">
        <PanelSkeleton height={330} />
        <PanelSkeleton height={230} />
        <PanelSkeleton height={250} />
      </div>
    </div>
  );
}

export default function CommandCenter() {
  return (
    <AfterMount fallback={<Skeleton />}>
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Centre column — portfolio, positions, chart */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <PortfolioOverview />
          <LivePositions />
          <TradingChart />
        </div>

        {/* Right rail — the three panels that answer "is it safe, what now?" */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <AINetworkPanel />
          <RiskEngine />
          <MasterDecision />
        </div>

        {/* Bottom band spans both columns */}
        <div className="grid gap-2.5 xl:col-span-2 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
          <AIActivityFlow />
          <CoinHeatmap />
          <TopAIToday />
        </div>
      </div>
    </AfterMount>
  );
}
