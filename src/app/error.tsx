"use client";

import { useEffect } from "react";

/**
 * App-level error boundary. A crash in any page (e.g. a chart library rejecting
 * a malformed feed) now shows a graceful retry instead of blanking the whole
 * app with the browser's "This page couldn't load".
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="text-[38px]">⚠️</div>
      <h2 className="text-[15px] font-semibold text-txt">หน้านี้มีปัญหาชั่วคราว</h2>
      <p className="max-w-md text-[11px] leading-relaxed text-dim">
        เกิดข้อผิดพลาดขณะแสดงผลหน้านี้ — ลองโหลดใหม่อีกครั้ง ระบบเทรดและข้อมูลอื่นยังทำงานปกติ
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-brand px-3 py-1.5 text-[11px] font-bold text-black hover:brightness-110"
        >
          ลองใหม่
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = "/";
          }}
          className="rounded border border-line px-3 py-1.5 text-[11px] text-muted hover:text-txt"
        >
          กลับแดชบอร์ด
        </button>
      </div>
    </div>
  );
}
