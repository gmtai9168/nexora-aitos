"use client";

import { useState } from "react";
import Link from "next/link";

type Step = "request" | "reset" | "done";

export default function ForgotPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onRequest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    // Always advance — the API doesn't reveal whether the email exists.
    setEmailed(Boolean(data.emailed));
    setDevCode(data.devCode ?? null);
    setStep("reset");
  }

  async function onReset(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.reset) {
      setError(
        data.error === "invalid_code"
          ? "รหัสไม่ถูกต้องหรือหมดอายุ"
          : data.error === "weak_password"
            ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
            : "ตั้งรหัสผ่านใหม่ไม่สำเร็จ ลองอีกครั้ง",
      );
      return;
    }
    setStep("done");
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl">
        {step === "request" && (
          <>
            <div className="mb-5 text-center">
              <div className="text-lg font-semibold text-txt">ลืมรหัสผ่าน</div>
              <div className="mt-1 text-xs text-muted">กรอกอีเมลเพื่อรับรหัสตั้งรหัสผ่านใหม่</div>
            </div>
            <form onSubmit={onRequest} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">อีเมล</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-brand/60"
                  placeholder="you@email.com"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !email.includes("@")}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "กำลังส่ง…" : "ส่งรหัสยืนยัน"}
              </button>
            </form>
            <div className="mt-5 text-center text-xs text-muted">
              จำรหัสผ่านได้แล้ว?{" "}
              <Link href="/login" className="text-brand hover:underline">
                เข้าสู่ระบบ
              </Link>
            </div>
          </>
        )}

        {step === "reset" && (
          <>
            <div className="mb-5 text-center">
              <div className="text-lg font-semibold text-txt">ตั้งรหัสผ่านใหม่</div>
              <div className="mt-1 text-xs text-muted">
                {emailed ? `ส่งรหัส 6 หลักไปที่ ${email}` : "กรอกรหัส 6 หลักและรหัสผ่านใหม่"}
              </div>
            </div>

            {devCode && (
              <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                โหมดทดสอบ (ยังไม่ได้ตั้งค่าอีเมล): รหัสของคุณคือ{" "}
                <span className="font-mono font-bold">{devCode}</span>
              </div>
            )}

            <form onSubmit={onReset} className="space-y-3">
              <input
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-line bg-bg px-3 py-3 text-center font-mono text-lg tracking-[0.5em] text-txt outline-none focus:border-brand/60"
                placeholder="000000"
              />
              <label className="block">
                <span className="mb-1 block text-xs text-muted">รหัสผ่านใหม่</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-brand/60"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </label>

              {error && <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "กำลังตั้งรหัสใหม่…" : "ตั้งรหัสผ่านใหม่"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-lg font-semibold text-txt">ตั้งรหัสผ่านใหม่สำเร็จ</div>
            <p className="mt-2 text-sm text-muted">เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้เลย</p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg"
            >
              เข้าสู่ระบบ
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
