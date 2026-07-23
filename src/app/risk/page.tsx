import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { RiskEngineView } from "@/components/risk/RiskEngineView";

export const metadata = { title: "RISK ENGINE · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <PanelSkeleton height={230} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <PanelSkeleton height={240} />
        <PanelSkeleton height={240} />
      </div>
    </div>
  );
}

export default function RiskEnginePage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">07</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">RISK ENGINE</h1>
          <p className="text-[10.5px] text-dim">
            บริหารความเสี่ยงเรียลไทม์ · ควบคุมสถานะ · เฝ้า Exposure · ปกป้องเงินทุน
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <RiskEngineView />
      </AfterMount>
    </div>
  );
}
