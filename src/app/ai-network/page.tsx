import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { AiNetworkView } from "@/components/ai/AiNetworkView";

export const metadata = { title: "AI 50 NETWORK · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={62} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_336px]">
        <PanelSkeleton height={620} />
        <div className="flex flex-col gap-2.5">
          <PanelSkeleton height={360} />
          <PanelSkeleton height={250} />
        </div>
      </div>
    </div>
  );
}

export default function AiNetworkPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">02</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">AI 50 NETWORK</h1>
          <p className="text-[10.5px] text-dim">
            ศูนย์ควบคุม AI ทั้ง 50 ตัวแบบเรียลไทม์ · Collective Intelligence Network
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <AiNetworkView />
      </AfterMount>
    </div>
  );
}
