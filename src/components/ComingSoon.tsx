import { Panel } from "./Panel";

export function ComingSoon({
  th,
  en,
  points,
}: {
  th: string;
  en: string;
  points: string[];
}) {
  return (
    <Panel title={th} titleEn={en} bodyClassName="p-6">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-[13px] text-txt">หน้านี้ยังอยู่ระหว่างพัฒนา</p>
        <p className="mt-1 text-[11px] text-dim">
          โครงหน้าและเมนูพร้อมแล้ว รอเชื่อมต่อส่วนที่เหลือ
        </p>
        <ul className="mt-4 space-y-1.5 text-left">
          {points.map((p) => (
            <li key={p} className="flex items-start gap-2 text-[11px] text-muted">
              <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-accent/60" />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
