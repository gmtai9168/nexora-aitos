"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Choice = { value: string; label: string; hint?: string };

const EXPERIENCE: Choice[] = [
  { value: "new", label: "มือใหม่", hint: "เพิ่งเริ่มเทรด อยากให้ AI ช่วยดูแล" },
  { value: "some", label: "พอมีประสบการณ์", hint: "เคยเทรดมาบ้าง เข้าใจพื้นฐาน" },
  { value: "pro", label: "มืออาชีพ", hint: "เทรดจริงจัง ต้องการเครื่องมือครบ" },
];

const RISK: Choice[] = [
  { value: "low", label: "ระมัดระวัง", hint: "เน้นรักษาเงินต้น กำไรทีละน้อย" },
  { value: "medium", label: "สมดุล", hint: "รับความเสี่ยงได้ปานกลาง" },
  { value: "high", label: "รุกหนัก", hint: "รับความผันผวนเพื่อผลตอบแทนสูง" },
];

const MARKETS: Choice[] = [
  { value: "crypto", label: "คริปโต" },
  { value: "th-stock", label: "หุ้นไทย" },
  { value: "us-stock", label: "หุ้นต่างประเทศ" },
  { value: "forex", label: "ฟอเร็กซ์/ทอง" },
];

const GOALS: Choice[] = [
  { value: "grow", label: "เพิ่มพอร์ตระยะยาว" },
  { value: "income", label: "หารายได้ประจำ" },
  { value: "learn", label: "เรียนรู้จาก AI" },
  { value: "automate", label: "ให้ AI เทรดอัตโนมัติ" },
];

const CAPITAL: Choice[] = [
  { value: "<10k", label: "ต่ำกว่า 10,000" },
  { value: "10k-100k", label: "10,000 – 100,000" },
  { value: "100k-1m", label: "100,000 – 1,000,000" },
  { value: "1m+", label: "มากกว่า 1,000,000" },
];

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
        active ? "border-brand bg-brand/10 text-txt" : "border-line bg-panel text-muted hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [experience, setExperience] = useState("");
  const [risk, setRisk] = useState("");
  const [markets, setMarkets] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [capital, setCapital] = useState("");
  const [autopilot, setAutopilot] = useState(true);
  const [busy, setBusy] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void, v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const steps = [
    {
      title: "คุณมีประสบการณ์เทรดแค่ไหน?",
      body: (
        <div className="space-y-2">
          {EXPERIENCE.map((c) => (
            <Pill key={c.value} active={experience === c.value} onClick={() => setExperience(c.value)}>
              <div className="font-medium text-txt">{c.label}</div>
              {c.hint && <div className="text-xs text-muted">{c.hint}</div>}
            </Pill>
          ))}
        </div>
      ),
      canNext: !!experience,
    },
    {
      title: "รับความเสี่ยงได้แค่ไหน?",
      body: (
        <div className="space-y-2">
          {RISK.map((c) => (
            <Pill key={c.value} active={risk === c.value} onClick={() => setRisk(c.value)}>
              <div className="font-medium text-txt">{c.label}</div>
              {c.hint && <div className="text-xs text-muted">{c.hint}</div>}
            </Pill>
          ))}
        </div>
      ),
      canNext: !!risk,
    },
    {
      title: "สนใจตลาดไหนบ้าง? (เลือกได้หลายอย่าง)",
      body: (
        <div className="grid grid-cols-2 gap-2">
          {MARKETS.map((c) => (
            <Pill key={c.value} active={markets.includes(c.value)} onClick={() => toggle(markets, setMarkets, c.value)}>
              <span className="text-txt">{c.label}</span>
            </Pill>
          ))}
        </div>
      ),
      canNext: markets.length > 0,
    },
    {
      title: "เป้าหมายของคุณ? (เลือกได้หลายอย่าง)",
      body: (
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map((c) => (
            <Pill key={c.value} active={goals.includes(c.value)} onClick={() => toggle(goals, setGoals, c.value)}>
              <span className="text-txt">{c.label}</span>
            </Pill>
          ))}
        </div>
      ),
      canNext: goals.length > 0,
    },
    {
      title: "เงินทุนเริ่มต้นโดยประมาณ?",
      body: (
        <div className="space-y-2">
          {CAPITAL.map((c) => (
            <Pill key={c.value} active={capital === c.value} onClick={() => setCapital(c.value)}>
              <span className="text-txt">{c.label}</span>
            </Pill>
          ))}
          <label className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3">
            <input type="checkbox" checked={autopilot} onChange={(e) => setAutopilot(e.target.checked)} />
            <span className="text-sm text-txt">
              ให้ AI เทรดอัตโนมัติ (โหมด PAPER/ทดลอง)
              <span className="block text-xs text-muted">ยังไม่มีการใช้เงินจริง จนกว่าจะเชื่อมบัญชีเอง</span>
            </span>
          </label>
        </div>
      ),
      canNext: !!capital,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  async function finish() {
    setBusy(true);
    try {
      const res = await fetch("/api/account/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience, risk, markets, goals, capital, autopilot }),
      });
      const data = await res.json().catch(() => ({}));
      // Mirror the derived prefs locally so the dashboard can honor them immediately.
      try {
        localStorage.setItem(
          "nexora-profile",
          JSON.stringify({ experience, risk, markets, goals, capital, autopilot, suggestedPlan: data?.profile?.suggestedPlan }),
        );
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-4">
        <div className="text-xs text-muted">ผู้ช่วย AI · ตั้งค่าเริ่มต้น {step + 1}/{steps.length}</div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="mb-4 text-lg font-semibold text-txt">{current.title}</h1>
      {current.body}

      <div className="mt-6 flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep((s) => s - 1)}
            className="rounded-lg border border-line px-4 py-2.5 text-sm text-muted hover:text-txt"
          >
            ย้อนกลับ
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!current.canNext}
            className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            ถัดไป
          </button>
        ) : (
          <button
            onClick={finish}
            disabled={!current.canNext || busy}
            className="flex-1 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-bg disabled:opacity-40"
          >
            {busy ? "กำลังตั้งค่า…" : "เริ่มใช้งาน"}
          </button>
        )}
      </div>

      <button
        onClick={() => router.push("/")}
        className="mt-4 text-center text-xs text-muted hover:text-txt"
      >
        ข้ามไปก่อน
      </button>
    </div>
  );
}
