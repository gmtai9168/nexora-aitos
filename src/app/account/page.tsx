"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ROLES, type Role } from "@/lib/rbac";
import { BillingSection } from "@/components/account/BillingSection";
import { ExchangeSection } from "@/components/account/ExchangeSection";
import { OrgSection } from "@/components/account/OrgSection";
import { KycSection } from "@/components/account/KycSection";

type Me = {
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  kyc: "none" | "pending" | "approved" | "rejected";
  plan: string;
  profile?: { suggestedPlan?: string };
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <h2 className="mb-3 text-sm font-semibold text-txt">{title}</h2>
      {children}
    </section>
  );
}

function TwoFactor({ me, onChange }: { me: Me; onChange: () => void }) {
  const [phase, setPhase] = useState<"idle" | "setup" | "disable">("idle");
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function begin() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/account/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "setup" }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.secret) {
      setSecret(r.secret);
      setOtpauth(r.otpauth);
      setPhase("setup");
      setCode("");
    }
  }

  async function commit(action: "enable" | "disable") {
    setBusy(true);
    setError("");
    const r = await fetch("/api/account/2fa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, code }),
    });
    setBusy(false);
    if (!r.ok) {
      setError("รหัสไม่ถูกต้อง ลองใหม่อีกครั้ง");
      return;
    }
    setPhase("idle");
    setCode("");
    onChange();
  }

  if (me.twoFactorEnabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-up">● เปิดใช้งาน 2FA แล้ว</div>
        {phase !== "disable" ? (
          <button
            onClick={() => {
              setPhase("disable");
              setCode("");
              setError("");
            }}
            className="rounded-lg border border-line px-3 py-2 text-xs text-muted hover:text-txt"
          >
            ปิด 2FA
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted">กรอกรหัสปัจจุบันจากแอปเพื่อยืนยันการปิด</p>
            <input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-40 rounded-lg border border-line bg-bg px-3 py-2 text-center font-mono tracking-widest text-txt outline-none"
              placeholder="000000"
            />
            {error && <div className="text-xs text-down">{error}</div>}
            <div className="flex gap-2">
              <button
                onClick={() => commit("disable")}
                disabled={busy || code.length !== 6}
                className="rounded-lg bg-down px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              >
                ยืนยันปิด 2FA
              </button>
              <button onClick={() => setPhase("idle")} className="px-3 py-2 text-xs text-muted">
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        เพิ่มความปลอดภัยด้วยรหัส 6 หลักจากแอป Authenticator (Google Authenticator, Authy ฯลฯ)
      </p>
      {phase !== "setup" ? (
        <button
          onClick={begin}
          disabled={busy}
          className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-bg disabled:opacity-50"
        >
          {busy ? "กำลังเตรียม…" : "ตั้งค่า 2FA"}
        </button>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-line bg-bg p-3">
            <p className="mb-1 text-xs text-muted">เพิ่มคีย์นี้ในแอป Authenticator (Manual entry):</p>
            <code className="block break-all font-mono text-sm text-brand">{secret}</code>
            <a href={otpauth} className="mt-2 inline-block text-[11px] text-muted underline">
              หรือเปิดลิงก์ otpauth:// ในอุปกรณ์นี้
            </a>
          </div>
          <p className="text-xs text-muted">แล้วกรอกรหัส 6 หลักที่แอปแสดงเพื่อเปิดใช้งาน</p>
          <input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="w-40 rounded-lg border border-line bg-bg px-3 py-2 text-center font-mono tracking-widest text-txt outline-none"
            placeholder="000000"
          />
          {error && <div className="text-xs text-down">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={() => commit("enable")}
              disabled={busy || code.length !== 6}
              className="rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-bg disabled:opacity-40"
            >
              เปิดใช้งาน 2FA
            </button>
            <button onClick={() => setPhase("idle")} className="px-3 py-2 text-xs text-muted">
              ยกเลิก
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { id: "overview", th: "ภาพรวม" },
  { id: "security", th: "ความปลอดภัย" },
  { id: "billing", th: "แพ็กเกจ" },
  { id: "exchange", th: "Exchange" },
  { id: "org", th: "องค์กร" },
  { id: "kyc", th: "ยืนยันตัวตน" },
] as const;

export default function AccountPage() {
  const { status } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  const load = useCallback(() => {
    fetch("/api/account/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMe(d?.user ?? null))
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
    else if (status === "unauthenticated") setLoading(false);
  }, [status, load]);

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold text-txt">บัญชีของฉัน</h1>
        <p className="mt-2 text-sm text-muted">กรุณาเข้าสู่ระบบเพื่อจัดการบัญชีและความปลอดภัย</p>
        <Link href="/login" className="mt-4 inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg">
          เข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  if (loading || !me) {
    return <div className="py-16 text-center text-sm text-muted">กำลังโหลด…</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-4">
      <h1 className="text-lg font-semibold text-txt">บัญชีของฉัน</h1>

      <div className="flex flex-wrap gap-1.5 border-b border-line pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              tab === t.id ? "bg-brand text-bg" : "text-muted hover:text-txt"
            }`}
          >
            {t.th}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <Card title="โปรไฟล์">
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted">ชื่อ</dt>
              <dd className="text-txt">{me.name}</dd>
              <dt className="text-muted">อีเมล</dt>
              <dd className="text-txt">
                {me.email}{" "}
                {me.emailVerified ? (
                  <span className="text-up">· ยืนยันแล้ว</span>
                ) : (
                  <span className="text-warn">· ยังไม่ยืนยัน</span>
                )}
              </dd>
              <dt className="text-muted">ระดับสมาชิก</dt>
              <dd className="text-brand">{ROLES[me.role]?.th ?? me.role}</dd>
              <dt className="text-muted">แพ็กเกจ</dt>
              <dd className="text-txt">{me.plan.toUpperCase()}</dd>
              <dt className="text-muted">2FA</dt>
              <dd className={me.twoFactorEnabled ? "text-up" : "text-muted"}>
                {me.twoFactorEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}
              </dd>
            </dl>
          </Card>
        </>
      )}

      {tab === "security" && (
        <Card title="การยืนยันตัวตน 2 ชั้น (2FA)">
          <TwoFactor me={me} onChange={load} />
        </Card>
      )}

      {tab === "billing" && (
        <Card title="แพ็กเกจสมาชิก">
          <BillingSection plan={me.plan} onChange={load} />
        </Card>
      )}

      {tab === "exchange" && (
        <Card title="เชื่อมต่อ Exchange">
          <ExchangeSection />
        </Card>
      )}

      {tab === "org" && (
        <Card title="องค์กร / ทีม">
          <OrgSection />
        </Card>
      )}

      {tab === "kyc" && (
        <Card title="ยืนยันตัวตน (KYC)">
          <KycSection onChange={load} />
        </Card>
      )}
    </div>
  );
}
