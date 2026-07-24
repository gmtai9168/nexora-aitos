"use client";

import Link from "next/link";
import { useState } from "react";
import {
  actionsFor,
  RULE_BY_ID,
  SEVERITY_META,
  SOURCE_META,
  STATUS_META,
  type Alert,
  type AlertAction,
} from "@/lib/alerts";
import { eventDate, eventTime, KindIcon, relative } from "./AlertPanels";

const ASSIGNEES = ["Risk Manager", "Trading Desk", "DevOps", "Quant Team", "Security Team"];

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line-soft py-[5px] last:border-0">
      <span className="shrink-0 text-[9.5px] text-muted">{label}</span>
      <span className={`num min-w-0 truncate text-right text-[10.5px] ${tone ?? "text-txt"}`}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-[10px] font-semibold text-brand">{title}</h3>
      <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1">{children}</div>
    </section>
  );
}

export function AlertDrawer({
  alert,
  now,
  onClose,
  onAction,
  onAssign,
}: {
  alert: Alert;
  now: number;
  onClose: () => void;
  onAction: (a: AlertAction) => void;
  onAssign: (who: string | null) => void;
}) {
  const [confirming, setConfirming] = useState<AlertAction | null>(null);
  const sev = SEVERITY_META[alert.severity];
  const rule = RULE_BY_ID.get(alert.ruleId);
  const precise =
    alert.source === "sysops" || alert.source === "exchange" || alert.source === "execution";
  const actions = actionsFor(alert);

  const run = (a: AlertAction) => {
    if (!a.available) return;
    if (a.confirm) {
      setConfirming(a);
      return;
    }
    onAction(a);
  };

  return (
    <>
      <button
        type="button"
        aria-label="ปิดแผงรายละเอียด"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[470px] flex-col border-l border-line bg-shell shadow-2xl">
        <header
          className="flex items-start gap-2 border-b border-line px-3 py-2.5"
          style={{ borderLeft: `3px solid ${sev.color}` }}
        >
          <KindIcon kind={alert.kind} size={34} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-txt">
                {alert.title}
              </h2>
              <span
                className="shrink-0 rounded border px-1.5 py-[1px] text-[9px] font-semibold"
                style={{ color: sev.color, background: sev.bg, borderColor: `${sev.color}55` }}
              >
                {sev.th}
              </span>
            </div>
            <p className="num truncate text-[9.5px] text-dim">
              {alert.id} · {SOURCE_META[alert.source].en}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-line px-1.5 py-[2px] text-[11px] text-muted hover:text-txt"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-2.5 overflow-y-auto p-2.5">
          <p className="text-[10.5px] leading-relaxed text-muted">{alert.detail}</p>

          <Section title="ข้อมูลเหตุการณ์">
            <Row label="รหัสเหตุการณ์" value={alert.id} />
            <Row label="กฎที่ตรวจจับ" value={rule ? `${rule.th} (${rule.id})` : alert.ruleId} />
            <Row
              label="เวลาเริ่ม"
              value={`${eventDate(alert.firstSeen)} ${eventTime(alert.firstSeen, precise)}`}
            />
            <Row
              label="เวลาล่าสุด"
              value={`${eventDate(alert.lastSeen)} ${eventTime(alert.lastSeen, precise)}`}
            />
            <Row label="เกิดซ้ำ" value={`${alert.occurrences} ครั้ง (รวมเป็นเหตุการณ์เดียว)`} />
            <Row label="ระบบต้นทาง" value={SOURCE_META[alert.source].en} />
            {alert.entity.symbol && <Row label="สินทรัพย์" value={alert.entity.symbol} />}
            {alert.entity.venue && <Row label="กระดานเทรด" value={alert.entity.venue} />}
            <Row
              label="ระดับความรุนแรง"
              value={`${sev.th} (${sev.en})`}
              tone=""
            />
            <Row label="สถานะ" value={STATUS_META[alert.status].th} />
            <Row label="ผู้รับผิดชอบ" value={alert.assignee ?? "ยังไม่มอบหมาย"} />
          </Section>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
              <div className="text-[9px] text-dim">ค่าที่ตรวจพบ</div>
              <div className="num truncate text-[14px] font-bold" style={{ color: sev.color }}>
                {alert.observed}
              </div>
            </div>
            <div className="rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
              <div className="text-[9px] text-dim">เกณฑ์ที่ตั้งไว้</div>
              <div className="num truncate text-[14px] font-bold text-muted">{alert.threshold}</div>
            </div>
          </div>

          <Section title="ผลกระทบที่อาจเกิดขึ้น">
            <p className="py-1 text-[10px] leading-relaxed text-muted">{alert.impact}</p>
          </Section>

          <Section title="AI วิเคราะห์สาเหตุ">
            <p className="py-1 text-[10px] leading-relaxed text-muted">{alert.rootCause}</p>
          </Section>

          <Section title="ระบบตอบสนองอย่างไร">
            <ul className="space-y-[3px] py-1">
              {alert.systemResponse.map((r, i) => (
                <li key={i} className="flex gap-1.5 text-[10px] leading-snug text-muted">
                  <span className="text-up">·</span>
                  <span className="min-w-0">{r}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="มอบหมายให้ทีมงาน">
            <div className="flex flex-wrap gap-1 py-1">
              {ASSIGNEES.map((who) => (
                <button
                  key={who}
                  type="button"
                  onClick={() => onAssign(alert.assignee === who ? null : who)}
                  className={`rounded border px-1.5 py-[3px] text-[9.5px] transition-colors ${
                    alert.assignee === who
                      ? "border-brand/50 bg-[#062a38] text-brand"
                      : "border-line bg-[#0f1c26] text-muted hover:text-txt"
                  }`}
                >
                  {who}
                </button>
              ))}
            </div>
          </Section>

          <Section title="ดำเนินการ">
            <div className="flex flex-wrap gap-1 py-1">
              {actions.map((a) =>
                a.href && a.available ? (
                  <Link
                    key={a.id}
                    href={a.href}
                    className="rounded border border-line bg-[#0f1c26] px-2 py-[5px] text-[10px] text-muted transition-colors hover:text-txt"
                  >
                    {a.th}
                  </Link>
                ) : (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => run(a)}
                    disabled={!a.available}
                    title={a.reason}
                    className={`rounded border px-2 py-[5px] text-[10px] transition-colors ${
                      a.available
                        ? a.confirm
                          ? "border-down/40 bg-[#1d0b12] text-down hover:bg-[#2a1019]"
                          : "border-line bg-[#0f1c26] text-muted hover:text-txt"
                        : "cursor-not-allowed border-line bg-[#0d1922] text-dim opacity-45"
                    }`}
                  >
                    {a.th}
                    {!a.available && " 🔒"}
                  </button>
                ),
              )}
            </div>
            {actions.some((a) => !a.available) && (
              <p className="pb-1 text-[9px] leading-snug text-dim">
                ปุ่มที่มีแม่กุญแจทำงานไม่ได้จริง — แพลตฟอร์มนี้ไม่รับ API Key ของกระดานเทรด
                และไม่ส่งคำสั่งซื้อขาย จึงไม่แสดงปุ่มที่กดแล้วไม่เกิดอะไรขึ้นโดยไม่บอก
              </p>
            )}
          </Section>

          <Section title="บันทึกการตรวจสอบ">
            <ol className="space-y-1.5 py-1">
              {alert.audit.map((s, i) => (
                <li key={i} className="border-b border-line-soft pb-1.5 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={`num text-[9.5px] font-bold ${
                        s.action === "AUTO_RESOLVE" || s.action === "RESOLVE"
                          ? "text-up"
                          : s.action === "DETECT" || s.action === "REOPEN"
                            ? "text-down"
                            : "text-brand"
                      }`}
                    >
                      {s.action}
                    </span>
                    <span className="num shrink-0 text-[9px] text-dim">
                      {eventTime(s.time, precise)}
                    </span>
                  </div>
                  <div className="truncate text-[10px] text-txt">{s.actor}</div>
                  <div className="text-[9.5px] leading-snug text-muted">{s.detail}</div>
                </li>
              ))}
            </ol>
          </Section>

          <p className="text-[9px] leading-snug text-dim">
            ตรวจพบครั้งแรก {relative(alert.firstSeen, now)} · เหตุการณ์ระดับสำคัญเร่งด่วนจะไม่ถูกลบ
            ออกจากบันทึกตรวจสอบ และการปิดเหตุการณ์จะระบุผู้ดำเนินการเสมอ
          </p>
        </div>

        {confirming && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-[340px] rounded border border-down/50 bg-[#12070c] p-3">
              <h3 className="text-[12px] font-bold text-down">ยืนยันการดำเนินการ</h3>
              <p className="mt-1 text-[10.5px] leading-snug text-muted">{confirming.confirm}</p>
              <p className="mt-1.5 rounded border border-line bg-[#0a121a] px-2 py-1 text-[9.5px] text-dim">
                ผู้ดำเนินการ: Super Admin · การกระทำนี้จะถูกบันทึกในบันทึกตรวจสอบพร้อมเวลา
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onAction(confirming);
                    setConfirming(null);
                  }}
                  className="flex-1 rounded bg-down py-[6px] text-[10.5px] font-bold text-white"
                >
                  ยืนยัน
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="flex-1 rounded border border-line py-[6px] text-[10.5px] text-muted"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
