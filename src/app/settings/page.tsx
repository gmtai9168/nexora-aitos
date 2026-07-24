import { AfterMount, PanelSkeleton } from "@/components/AfterMount";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata = { title: "SETTINGS · NEXORA AITOS" };

function Skeleton() {
  return (
    <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-2.5">
        <PanelSkeleton height={44} />
        <PanelSkeleton height={420} />
      </div>
      <PanelSkeleton height={420} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-2.5">
      <header className="flex items-baseline gap-3">
        <span className="text-[34px] font-extrabold leading-none text-brand/25">19</span>
        <span>
          <h1 className="text-[19px] font-extrabold tracking-wide">การตั้งค่า</h1>
          <p className="text-[10.5px] text-dim">
            Settings · จัดการบัญชี ความปลอดภัย การเชื่อมต่อ ความเสี่ยง AI และสิทธิ์ผู้ใช้ทั้งหมดในหน้าเดียว
          </p>
        </span>
      </header>

      <AfterMount fallback={<Skeleton />}>
        <SettingsView />
      </AfterMount>
    </div>
  );
}
