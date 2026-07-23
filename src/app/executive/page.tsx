import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { ExecutiveView } from "@/components/exec-center/ExecutiveView";

export const metadata = { title: "EXECUTIVE CENTER · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={230} />
      <div className="grid gap-2.5 xl:grid-cols-2">
        <PanelSkeleton height={280} />
        <PanelSkeleton height={280} />
      </div>
      <PanelSkeleton height={240} />
    </div>
  );
}

export default function ExecutiveCenterPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">15</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">EXECUTIVE CENTER</h1>
          <p className="text-[10.5px] text-dim">
            ศูนย์บริหารจัดการระดับองค์กร · CEO · Board · Investor Intelligence
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <ExecutiveView />
      </AfterMount>
    </div>
  );
}
