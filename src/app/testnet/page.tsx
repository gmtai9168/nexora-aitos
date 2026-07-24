import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { TestnetView } from "@/components/testnet/TestnetView";

export const metadata = { title: "TESTNET EXECUTION · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={44} />
      <PanelSkeleton height={90} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <PanelSkeleton height={360} />
        <PanelSkeleton height={360} />
      </div>
    </div>
  );
}

export default function TestnetPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-warn/30">T</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">การเทรดทดสอบ (Testnet)</h1>
          <p className="text-[10.5px] text-dim">
            เชื่อม Binance Futures Testnet ด้วยเงินปลอม — ทดสอบระบบส่งคำสั่งจริงผ่าน Risk Engine โดยไม่เสี่ยงเงินจริง
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <TestnetView />
      </AfterMount>
    </div>
  );
}
