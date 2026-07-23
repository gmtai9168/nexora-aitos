import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import {
  ExecutionStats,
  ExecutionTimeline,
  RoutingPanel,
} from "@/components/exec/AnalyticsPanels";
import { ExchangeMonitor } from "@/components/exec/ExchangeMonitor";
import { ExecProvider } from "@/components/exec/ExecProvider";
import { ExecutionFlow } from "@/components/exec/ExecutionFlow";
import { OrderEntry } from "@/components/exec/OrderEntry";
import { ActiveOrders, OrderDetail } from "@/components/exec/OrdersPanel";
import { PositionManager, TpSlManager } from "@/components/exec/PositionsPanel";
import { TradingChart } from "@/components/TradingChart";

export const metadata = { title: "LIVE EXECUTION · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={54} />
      <PanelSkeleton height={92} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PanelSkeleton height={420} />
        <PanelSkeleton height={420} />
      </div>
    </div>
  );
}

export default function LiveExecutionPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">04</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">LIVE EXECUTION CENTER</h1>
          <p className="text-[10.5px] text-dim">
            ส่งคำสั่งแบบเรียลไทม์ · เลือกตลาดอัตโนมัติ · หลาย Exchange · หน่วงเวลาต่ำ
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <ExecProvider>
          <div className="flex flex-col gap-2.5">
            <ExchangeMonitor />
            <ExecutionFlow />

            <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <TradingChart />
              <OrderEntry />
            </div>

            <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <ActiveOrders />
              <OrderDetail />
            </div>

            <div className="grid gap-2.5 xl:grid-cols-2">
              <PositionManager />
              <TpSlManager />
            </div>

            <div className="grid gap-2.5 xl:grid-cols-2">
              <ExecutionTimeline />
              <RoutingPanel />
            </div>

            <ExecutionStats />
          </div>
        </ExecProvider>
      </AfterMount>
    </div>
  );
}
