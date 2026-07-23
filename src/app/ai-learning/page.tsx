import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { LearningView } from "@/components/learn/LearningView";

export const metadata = { title: "AI LEARNING CENTER · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="flex flex-col gap-2.5">
      <PanelSkeleton height={58} />
      <PanelSkeleton height={140} />
      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <PanelSkeleton height={240} />
        <PanelSkeleton height={240} />
      </div>
    </div>
  );
}

export default function AiLearningPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">08</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">AI LEARNING CENTER</h1>
          <p className="text-[10.5px] text-dim">
            เรียนรู้ต่อเนื่อง · ฝึกโมเดล · จัดการชุดข้อมูล · วิวัฒนาการของ AI
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <LearningView />
      </AfterMount>
    </div>
  );
}
