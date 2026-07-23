import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { CoinIntelView } from "@/components/coin/CoinIntelView";

export const metadata = { title: "COIN INTELLIGENCE · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <div className="grid gap-2.5 xl:grid-cols-[300px_minmax(0,1fr)_336px]">
        <PanelSkeleton height={520} />
        <PanelSkeleton height={520} />
        <PanelSkeleton height={520} />
      </div>
      <div className="grid gap-2.5 xl:grid-cols-2">
        <PanelSkeleton height={300} />
        <PanelSkeleton height={300} />
      </div>
    </div>
  );
}

export default function CoinIntelligencePage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">03</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">COIN INTELLIGENCE</h1>
          <p className="text-[10.5px] text-dim">
            วิเคราะห์เชิงลึกด้วย AI · ให้คะแนน 9 ปัจจัย · ค้นหาโอกาสในตลาด
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <CoinIntelView />
      </AfterMount>
    </div>
  );
}
