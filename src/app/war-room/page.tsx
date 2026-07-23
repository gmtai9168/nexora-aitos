import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { WarRoomView } from "@/components/war/WarRoomView";

export const metadata = { title: "AI WAR ROOM · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <PanelSkeleton height={200} />
      <div className="grid gap-2.5 xl:grid-cols-2">
        <PanelSkeleton height={300} />
        <PanelSkeleton height={300} />
      </div>
    </div>
  );
}

export default function WarRoomPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">13</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">AI WAR ROOM</h1>
          <p className="text-[10.5px] text-dim">
            ศูนย์บัญชาการกลยุทธ์ AI แบบเรียลไทม์ · Global Mission Control
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <WarRoomView />
      </AfterMount>
    </div>
  );
}
