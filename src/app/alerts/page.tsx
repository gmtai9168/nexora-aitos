import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { AlertsView } from "@/components/alerts/AlertsView";

export const metadata = { title: "ALERTS CENTER · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <PanelSkeleton key={i} height={78} />
        ))}
      </div>
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <PanelSkeleton height={520} />
        <PanelSkeleton height={520} />
      </div>
    </div>
  );
}

export default function AlertsPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">18</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">การแจ้งเตือน</h1>
          <p className="text-[10.5px] text-dim">
            Alerts Center · ศูนย์รับมือเหตุการณ์ที่เชื่อม Risk Engine, Execution, AI Network
            และ System Operations เข้าด้วยกัน
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <AlertsView />
      </AfterMount>
    </div>
  );
}
