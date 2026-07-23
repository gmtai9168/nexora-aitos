import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { StrategyLabView } from "@/components/lab/StrategyLabView";

export const metadata = { title: "AI STRATEGY LAB · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <PanelSkeleton height={260} />
        <PanelSkeleton height={260} />
        <PanelSkeleton height={260} />
      </div>
      <PanelSkeleton height={380} />
    </div>
  );
}

export default function StrategyLabPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">06</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">AI STRATEGY LAB</h1>
          <p className="text-[10.5px] text-dim">
            สร้างกลยุทธ์ · ทดสอบย้อนหลัง · ปรับค่าอัตโนมัติ · ปล่อยใช้งาน
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <StrategyLabView />
      </AfterMount>
    </div>
  );
}
