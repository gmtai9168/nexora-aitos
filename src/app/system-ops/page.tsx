import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { SysOpsView } from "@/components/sysops/SysOpsView";

export const metadata = { title: "SYSTEM OPERATIONS · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <div className="grid gap-2.5 xl:grid-cols-2">
        <PanelSkeleton height={280} />
        <PanelSkeleton height={280} />
      </div>
      <PanelSkeleton height={240} />
    </div>
  );
}

export default function SystemOperationsPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">14</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">SYSTEM OPERATIONS</h1>
          <p className="text-[10.5px] text-dim">
            ศูนย์ควบคุมระบบและโครงสร้างพื้นฐาน · Infrastructure · DevOps · Security
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <SysOpsView />
      </AfterMount>
    </div>
  );
}
