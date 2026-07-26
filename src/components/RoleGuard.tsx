"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useRole } from "@/lib/role-context";
import { ACCESS_META, PAGES, ROLE_ORDER, ROLES } from "@/lib/rbac";

/**
 * Gates the page content by the active role. A page the role can't open shows
 * an access-denied notice (with who *can* open it); a view-only or demo page
 * renders with a banner so the restriction is visible. Full access is silent.
 */
export function RoleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { role, access } = useRole();
  const level = access(pathname);

  if (level === "none") {
    const page = PAGES.find((p) => p.href === pathname);
    const allowed = page
      ? ROLE_ORDER.filter((r) => page.acc[ROLE_ORDER.indexOf(r)] !== "none").map((r) => ROLES[r].th)
      : [];
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="text-[34px]">🔒</div>
        <h2 className="text-[15px] font-semibold text-txt">ไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="max-w-md text-[11px] leading-relaxed text-dim">
          บทบาทปัจจุบันของคุณคือ <span className="font-semibold text-brand">{ROLES[role].th}</span>{" "}
          (ระดับ {ROLES[role].level}) ซึ่งไม่มีสิทธิ์ในหน้า {page?.th ?? pathname}
          {allowed.length > 0 && (
            <>
              <br />
              เข้าถึงได้เฉพาะ: {allowed.join(" · ")}
            </>
          )}
        </p>
        <Link href="/" className="rounded bg-brand px-3 py-1.5 text-[11px] font-bold text-black hover:brightness-110">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  const meta = ACCESS_META[level];
  const banner =
    level === "view" ? (
      <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-warn/40 bg-[#20180a] px-3 py-1.5">
        <span className="text-[12px]">👁</span>
        <span className="text-[10px] text-warn">
          โหมดดูอย่างเดียว — บทบาท {ROLES[role].th} ดูข้อมูลหน้านี้ได้ แต่ไม่มีสิทธิ์แก้ไข/สั่งการ
        </span>
      </div>
    ) : level === "demo" ? (
      <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-brand/30 bg-[#0a1a20] px-3 py-1.5">
        <span className="shrink-0 rounded bg-brand px-1.5 py-[1px] text-[9px] font-bold text-black">DEMO</span>
        <span className="text-[10px] text-dim">
          ตัวอย่างระบบ — สมัครสมาชิกเพื่อใช้งานข้อมูลจริงและฟีเจอร์เต็มรูปแบบ ({meta.th})
        </span>
      </div>
    ) : null;

  return (
    <>
      {banner}
      {children}
    </>
  );
}
