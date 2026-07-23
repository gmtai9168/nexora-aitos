import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { FundOpsView } from "@/components/fund/FundOpsView";

export const metadata = { title: "FUND OPERATIONS · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <PanelSkeleton height={330} />
        <PanelSkeleton height={330} />
      </div>
      <PanelSkeleton height={240} />
    </div>
  );
}

export default function FundOperationsPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">12</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">FUND OPERATIONS</h1>
          <p className="text-[10.5px] text-dim">
            บริหารจัดการกองทุน เงินทุน นักลงทุน และสภาพคล่อง
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <FundOpsView />
      </AfterMount>
    </div>
  );
}
