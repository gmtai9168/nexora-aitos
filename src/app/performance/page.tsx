import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { PerformanceView } from "@/components/perf/PerformanceView";

export const metadata = { title: "PERFORMANCE ANALYTICS · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={44} />
      <PanelSkeleton height={58} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PanelSkeleton height={300} />
        <PanelSkeleton height={300} />
      </div>
    </div>
  );
}

export default function PerformanceAnalyticsPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">11</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">PERFORMANCE ANALYTICS</h1>
          <p className="text-[10.5px] text-dim">
            วิเคราะห์ผลการดำเนินงานเชิงลึกด้วย AI · ที่มาของกำไร · ความเสี่ยง · สิ่งที่ควรปรับ
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <PerformanceView />
      </AfterMount>
    </div>
  );
}
