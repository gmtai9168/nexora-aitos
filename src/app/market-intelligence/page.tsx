import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { GlobalIntelView } from "@/components/global/GlobalIntelView";

export const metadata = { title: "GLOBAL MARKET INTELLIGENCE · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={190} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <PanelSkeleton height={280} />
        <PanelSkeleton height={280} />
      </div>
    </div>
  );
}

export default function GlobalMarketIntelligencePage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">09</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">
            GLOBAL MARKET INTELLIGENCE
          </h1>
          <p className="text-[10.5px] text-dim">
            วิเคราะห์ตลาดโลกเรียลไทม์ · เศรษฐกิจมหภาค · อารมณ์ตลาด · ข่าว · โอกาส
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <GlobalIntelView />
      </AfterMount>
    </div>
  );
}
