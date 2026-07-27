"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    // First factor: verify password and learn whether a 2FA code is required.
    if (!needTotp) {
      const check = await fetch("/api/account/login-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
        .then((r) => r.json())
        .catch(() => ({ ok: false }));
      if (!check.ok) {
        setBusy(false);
        setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      if (check.twoFactor) {
        setBusy(false);
        setNeedTotp(true);
        return;
      }
    }

    const res = await signIn("credentials", { email, password, totp, redirect: false });
    setBusy(false);
    if (res?.error) {
      setError(needTotp ? "รหัส 2FA ไม่ถูกต้อง" : "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-6 shadow-xl">
      <div className="mb-5 text-center">
        <div className="text-lg font-semibold text-txt">เข้าสู่ระบบ</div>
        <div className="mt-1 text-xs text-muted">NEXORA AITOS — AI Trading OS</div>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
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
            placeholder="••••••••"
          />
        </label>

        {needTotp && (
          <label className="block">
            <span className="mb-1 block text-xs text-muted">รหัสยืนยัน 2 ชั้น (จากแอป Authenticator)</span>
            <input
              inputMode="numeric"
              autoFocus
              required
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] text-txt outline-none focus:border-brand/60"
              placeholder="000000"
            />
          </label>
        )}

        {error && <div className="rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{error}</div>}

        <button
          type="submit"
          disabled={busy || (needTotp && totp.length !== 6)}
          className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "กำลังเข้าสู่ระบบ…" : needTotp ? "ยืนยันและเข้าสู่ระบบ" : "เข้าสู่ระบบ"}
        </button>
      </form>

      <div className="mt-4">
        <OAuthButtons callbackUrl={callbackUrl} />
      </div>

      <div className="mt-5 text-center text-xs text-muted">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="text-brand hover:underline">
          สมัครสมาชิก
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
