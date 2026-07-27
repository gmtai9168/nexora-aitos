"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

type Step = "form" | "verify" | "done";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("TH");

  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [emailed, setEmailed] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, country }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        data.error === "email_taken"
          ? "อีเมลนี้ถูกใช้แล้ว"
          : data.error === "invalid_email"
            ? "อีเมลไม่ถูกต้อง"
            : data.error === "weak_password"
              ? "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
              : "สมัครไม่สำเร็จ ลองอีกครั้ง",
      );
      return;
    }
    setEmailed(Boolean(data.emailed));
    setDevCode(data.devCode ?? null);
    setStep("verify");
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.verified) {
      setBusy(false);
      setError("รหัสยืนยันไม่ถูกต้องหรือหมดอายุ");
      return;
    }
    // Email confirmed — sign the new member straight in.
    const signRes = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (signRes?.error) {
      setStep("done");
      return;
    }
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl">
        {step === "form" && (
          <>
            <div className="mb-5 text-center">
              <div className="text-lg font-semibold text-txt">สมัครสมาชิก</div>
              <div className="mt-1 text-xs text-muted">เริ่มต้นใช้งาน NEXORA AITOS</div>
            </div>
            <form onSubmit={onRegister} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs text-muted">ชื่อ</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-brand/60"
                  placeholder="ชื่อของคุณ"
                />
              </label>
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
              <label className="block">
                <span className="mb-1 block text-xs text-muted">รหัสผ่าน</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-brand/60"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-muted">ประเทศ</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-txt outline-none focus:border-brand/60"
                >
                  <option value="TH">ไทย (Thailand)</option>
                  <option value="SG">Singapore</option>
                  <option value="US">United States</option>
                  <option value="GB">United Kingdom</option>
                  <option value="JP">Japan</option>
                  <option value="OTHER">อื่น ๆ (Other)</option>
                </select>
              </label>

              {error && <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "กำลังสมัคร…" : "สมัครสมาชิก"}
              </button>
            </form>

            <div className="mt-4">
              <OAuthButtons callbackUrl="/onboarding" />
            </div>

            <div className="mt-5 text-center text-xs text-muted">
              มีบัญชีอยู่แล้ว?{" "}
              <Link href="/login" className="text-brand hover:underline">
                เข้าสู่ระบบ
              </Link>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <div className="mb-5 text-center">
              <div className="text-lg font-semibold text-txt">ยืนยันอีเมล</div>
              <div className="mt-1 text-xs text-muted">
                {emailed ? `ส่งรหัส 6 หลักไปที่ ${email}` : "กรอกรหัส 6 หลักเพื่อยืนยัน"}
              </div>
            </div>

            {devCode && (
              <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
                โหมดทดสอบ (ยังไม่ได้ตั้งค่าอีเมล): รหัสของคุณคือ{" "}
                <span className="font-mono font-bold">{devCode}</span>
              </div>
            )}

            <form onSubmit={onVerify} className="space-y-3">
              <input
                inputMode="numeric"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-line bg-bg px-3 py-3 text-center font-mono text-lg tracking-[0.5em] text-txt outline-none focus:border-brand/60"
                placeholder="000000"
              />

              {error && <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

              <button
                type="submit"
                disabled={busy || code.length !== 6}
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? "กำลังยืนยัน…" : "ยืนยันและเข้าสู่ระบบ"}
              </button>
            </form>
          </>
        )}

        {step === "done" && (
          <div className="text-center">
            <div className="text-lg font-semibold text-txt">ยืนยันสำเร็จ</div>
            <p className="mt-2 text-sm text-muted">บัญชีของคุณพร้อมใช้งานแล้ว</p>
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
