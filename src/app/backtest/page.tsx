import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { BacktestView } from "@/components/backtest/BacktestView";

export const metadata = { title: "BACKTESTING CENTER · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={104} />
      <PanelSkeleton height={92} />
      <PanelSkeleton height={200} />
      <div className="grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <PanelSkeleton height={420} />
        <PanelSkeleton height={420} />
      </div>
    </div>
  );
}

export default function BacktestPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">16</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">ทดสอบย้อนหลัง</h1>
          <p className="text-[10.5px] text-dim">
            Backtesting Center · ทดสอบกลยุทธ์กับข้อมูลในอดีตเพื่อประเมินประสิทธิภาพและความเสี่ยง
            ก่อนอนุญาตให้เข้าสู่ Paper Trading
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <BacktestView />
      </AfterMount>
    </div>
  );
}
