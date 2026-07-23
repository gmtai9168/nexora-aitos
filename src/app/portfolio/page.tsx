import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { PortfolioIntelView } from "@/components/portfolio/PortfolioIntelView";

export const metadata = { title: "PORTFOLIO INTELLIGENCE · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <PanelSkeleton height={230} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <PanelSkeleton height={240} />
        <PanelSkeleton height={240} />
      </div>
    </div>
  );
}

export default function PortfolioIntelligencePage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">05</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">
            PORTFOLIO INTELLIGENCE
          </h1>
          <p className="text-[10.5px] text-dim">
            บริหารพอร์ตด้วย AI แบบเรียลไทม์ · สัดส่วน · กำไร · ความเสี่ยง · Exposure
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <PortfolioIntelView />
      </AfterMount>
    </div>
  );
}
