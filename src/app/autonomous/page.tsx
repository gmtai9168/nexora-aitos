import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { AutonomousView } from "@/components/autonomous/AutonomousView";

export const metadata = { title: "AI AUTONOMOUS CENTER · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <PanelSkeleton height={110} />
      <div className="grid gap-2.5 xl:grid-cols-2">
        <PanelSkeleton height={260} />
        <PanelSkeleton height={260} />
      </div>
    </div>
  );
}

export default function AutonomousCenterPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">10</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">AI AUTONOMOUS CENTER</h1>
          <p className="text-[10.5px] text-dim">
            ศูนย์ปฏิบัติการอัตโนมัติด้วย AI แบบเรียลไทม์ · Mission Control
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <AutonomousView />
      </AfterMount>
    </div>
  );
}
