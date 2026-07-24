import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { HistoryView } from "@/components/history/HistoryView";

export const metadata = { title: "TRADE HISTORY · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={190} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <PanelSkeleton height={480} />
        <PanelSkeleton height={480} />
      </div>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">17</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">ประวัติการเทรด</h1>
          <p className="text-[10.5px] text-dim">
            Trade History · ตรวจสอบทุกคำสั่ง ย้อนดูเหตุการณ์ และอ่านบทสรุปหลังปิดของ AI
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <HistoryView />
      </AfterMount>
    </div>
  );
}
