"use client";

import Link from "next/link";
import { useState } from "react";
import type { ExchangeHealth } from "@/lib/market-context";
import {
  AI_MODES,
  KNOWN_VENUES,
  NOTIF_CHANNELS,
  NOTIF_EVENTS,
  PERMISSION_ROLES,
  riskWarnings,
  ROLES,
  securityFactors,
  securityScore,
  type AuditEntry,
  type RoleId,
  type Settings,
} from "@/lib/settings";
import { Card, Field, Note, Num, Seg, Select, Text, Toggle } from "./controls";

type Setter = <K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) => void;

/* ------------------------------------------------------------------ *
 * Account & Profile
 * ------------------------------------------------------------------ */

export function AccountTab({ s, set }: { s: Settings; set: Setter }) {
  const a = s.account;
  const [otp, setOtp] = useState<null | "email" | "phone">(null);

  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="ข้อมูลบัญชี" titleEn="Profile">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ชื่อ">
            <Text value={a.firstName} onChange={(v) => set("account", { firstName: v })} />
          </Field>
          <Field label="นามสกุล">
            <Text value={a.lastName} onChange={(v) => set("account", { lastName: v })} />
          </Field>
          <Field label="ชื่อที่แสดงในระบบ">
            <Text value={a.displayName} onChange={(v) => set("account", { displayName: v })} />
          </Field>
          <Field label="ประเทศ">
            <Text value={a.country} onChange={(v) => set("account", { country: v })} />
          </Field>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="อีเมล" hint="ต้องยืนยันด้วย OTP">
            <div className="flex gap-1">
              <Text value={a.email} onChange={(v) => set("account", { email: v })} disabled />
              <button
                type="button"
                onClick={() => setOtp("email")}
                className="shrink-0 rounded border border-line bg-[#0f1c26] px-2 text-[9.5px] text-muted hover:text-txt"
              >
                เปลี่ยน
              </button>
            </div>
          </Field>
          <Field label="เบอร์โทรศัพท์" hint="ต้องยืนยันด้วย OTP">
            <div className="flex gap-1">
              <Text
                value={a.phone}
                placeholder="ยังไม่ผูกเบอร์"
                onChange={(v) => set("account", { phone: v })}
                disabled
              />
              <button
                type="button"
                onClick={() => setOtp("phone")}
                className="shrink-0 rounded border border-line bg-[#0f1c26] px-2 text-[9.5px] text-muted hover:text-txt"
              >
                เปลี่ยน
              </button>
            </div>
          </Field>
        </div>

        {otp && (
          <div className="mt-2 rounded border border-warn/40 bg-[#20180a] p-2">
            <div className="text-[10px] font-semibold text-warn">
              ยืนยัน{otp === "email" ? "อีเมล" : "เบอร์โทร"}ด้วยรหัส OTP
            </div>
            <p className="mt-[2px] text-[9px] leading-snug text-muted">
              ในระบบจริงจะส่งรหัส 6 หลักไปยังช่องทางเดิมก่อนอนุญาตให้เปลี่ยน —
              ขั้นตอนนี้ต้องมีบริการยืนยันตัวตนฝั่งเซิร์ฟเวอร์ ซึ่งเดโมนี้ยังไม่มี จึงปิดการแก้ไขไว้
            </p>
            <button
              type="button"
              onClick={() => setOtp(null)}
              className="mt-1.5 rounded border border-line px-2 py-[3px] text-[9.5px] text-muted"
            >
              ปิด
            </button>
          </div>
        )}
      </Card>

      <div className="flex flex-col gap-2.5">
        <Card title="สถานะบัญชี" titleEn="Status">
          <dl className="text-[10.5px]">
            {[
              ["ประเภทบัญชี", a.accountType],
              ["ระดับสมาชิก", a.tier],
              ["สถานะ KYC", a.kyc === "verified" ? "ยืนยันแล้ว" : a.kyc === "pending" ? "รอตรวจสอบ" : "ยังไม่ยืนยัน"],
              ["รหัสผู้ใช้", "NEX-000001"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line-soft py-[6px] last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className={k === "สถานะ KYC" && a.kyc === "verified" ? "text-up" : "text-txt"}>{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card title="ข้อมูลและบัญชี" titleEn="Account Data">
          <div className="flex flex-wrap gap-1.5">
            <button className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10px] text-muted hover:text-txt" type="button">
              ดาวน์โหลดข้อมูลบัญชี
            </button>
            <button className="rounded border border-down/40 bg-[#1d0b12] px-2.5 py-[6px] text-[10px] text-down hover:bg-[#2a1019]" type="button">
              ปิดบัญชี
            </button>
          </div>
          <Note>
            เดโมนี้ไม่มีบัญชีฝั่งเซิร์ฟเวอร์ — โปรไฟล์และการตั้งค่าทั้งหมดเก็บไว้ในเบราว์เซอร์ของเครื่องนี้เท่านั้น
            ปุ่มดาวน์โหลด/ปิดบัญชีจึงเป็นตัวอย่างขั้นตอน
          </Note>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Security
 * ------------------------------------------------------------------ */

export function SecurityTab({ s, set }: { s: Settings; set: Setter }) {
  const score = securityScore(s);
  const factors = securityFactors(s);
  const color = score >= 85 ? "#14e2a0" : score >= 60 ? "#ffb020" : "#ff4a68";

  return (
    <div className="grid gap-2.5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card title="คะแนนความปลอดภัย" titleEn="Security Score">
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 120 66" style={{ width: 190 }}>
            <path d="M 12 60 A 48 48 0 0 1 108 60" fill="none" stroke="#16242f" strokeWidth="9" strokeLinecap="round" />
            <path
              d="M 12 60 A 48 48 0 0 1 108 60"
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${(Math.PI * 48 * score) / 100} 999`}
            />
            <text x="60" y="52" textAnchor="middle" fill={color} fontSize="22" fontWeight="700">
              {score}
            </text>
            <text x="60" y="62" textAnchor="middle" fill="#6b8497" fontSize="7">
              / 100
            </text>
          </svg>
          <p className="mt-1 text-center text-[9.5px] text-dim">
            คำนวณจากมาตรการที่เปิดใช้จริงด้านขวา — เปิดเพิ่มเพื่อดันคะแนนขึ้น
          </p>
        </div>
        <ul className="mt-2 space-y-1">
          {factors.map((f) => (
            <li key={f.th} className="flex items-center gap-1.5 text-[9.5px]">
              <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${f.on ? "bg-up" : "bg-[#2a3a46]"}`} />
              <span className={`min-w-0 flex-1 truncate ${f.on ? "text-muted" : "text-dim"}`}>{f.th}</span>
              <span className="num shrink-0 text-dim">+{f.weight}</span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col gap-2.5">
        <Card title="การเข้าสู่ระบบและการยืนยัน" titleEn="Authentication">
          <Toggle label="การยืนยันสองชั้น (2FA)" hint="บังคับใช้กับคำสั่งที่มีความเสี่ยงสูง" on={s.security.twoFactor} onChange={(v) => set("security", { twoFactor: v })} />
          <Toggle label="Passkey" hint="เข้าสู่ระบบด้วยกุญแจในอุปกรณ์" on={s.security.passkey} onChange={(v) => set("security", { passkey: v })} />
          <Toggle label="เข้าสู่ระบบด้วยไบโอเมตริก" on={s.security.biometric} onChange={(v) => set("security", { biometric: v })} />
          <Toggle label="จำกัด IP ที่เข้าถึงได้" on={s.security.ipWhitelist} onChange={(v) => set("security", { ipWhitelist: v })} />
          <Toggle label="ล็อกการถอนเงิน" hint="แนะนำให้เปิดตลอด" on={s.security.withdrawalLock} onChange={(v) => set("security", { withdrawalLock: v })} />
          <Toggle label="ยืนยันก่อนทำรายการที่มีความเสี่ยง" on={s.security.confirmSensitive} onChange={(v) => set("security", { confirmSensitive: v })} />
          <div className="mt-1 grid grid-cols-2 gap-2">
            <Field label="รหัสกันฟิชชิง">
              <Text value={s.security.antiPhishingCode} placeholder="อย่างน้อย 4 ตัว" onChange={(v) => set("security", { antiPhishingCode: v })} />
            </Field>
            <Field label="ออกจากระบบอัตโนมัติ" hint="นาที">
              <Num value={s.security.sessionTimeoutMin} min={5} max={240} step={5} onChange={(v) => set("security", { sessionTimeoutMin: v })} />
            </Field>
          </div>
        </Card>

        <Card title="อุปกรณ์และเซสชัน" titleEn="Devices & Sessions">
          <ul className="space-y-1">
            {[
              { d: "Windows · Chrome", loc: "สิงคโปร์", now: true },
              { d: "iPhone · Safari", loc: "กรุงเทพฯ", now: false },
            ].map((x) => (
              <li key={x.d} className="flex items-center justify-between gap-2 rounded border border-line-soft bg-[#0a121a] px-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-[10.5px] text-txt">{x.d}</span>
                  <span className="block truncate text-[9px] text-dim">{x.loc} · {x.now ? "อุปกรณ์นี้" : "เข้าใช้ล่าสุด 2 ชม.ก่อน"}</span>
                </span>
                {x.now ? (
                  <span className="shrink-0 rounded border border-up/40 bg-[#0d2b23] px-1.5 py-[2px] text-[8.5px] text-up">ใช้งานอยู่</span>
                ) : (
                  <button type="button" className="shrink-0 rounded border border-line px-1.5 py-[2px] text-[9px] text-muted hover:text-txt">ออกจากระบบ</button>
                )}
              </li>
            ))}
          </ul>
          <Note tone="warn">
            รายการอุปกรณ์และประวัติการเข้าสู่ระบบเป็นตัวอย่างโครงสร้าง — ระบบจริงต้องอ่านจากบริการยืนยันตัวตนฝั่งเซิร์ฟเวอร์
            ซึ่งเดโมนี้ยังไม่มี · คำสั่งเสี่ยงสูง (เปลี่ยน API, ปิด Risk Engine, ปิดทุกสถานะ) จะบังคับ 2FA เมื่อมีระบบยืนยันจริง
          </Note>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Exchange & API — the section that must refuse keys
 * ------------------------------------------------------------------ */

export function ExchangeTab({
  s,
  set,
  exchanges,
}: {
  s: Settings;
  set: Setter;
  exchanges: ExchangeHealth[];
}) {
  const [adding, setAdding] = useState(false);
  const byId = new Map(exchanges.map((e) => [e.id, e]));

  return (
    <div className="flex flex-col gap-2.5">
      <Card
        title="การเชื่อมต่อกระดานเทรด"
        titleEn="Exchange Connections"
        right={
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="rounded border border-brand/40 bg-[#062a38] px-2 py-[4px] text-[10px] text-brand"
          >
            + เพิ่ม Exchange
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="py-1.5 pr-2 font-medium">กระดาน</th>
                <th className="px-2 py-1.5 font-medium">สถานะ</th>
                <th className="px-2 py-1.5 text-right font-medium">Latency</th>
                <th className="px-2 py-1.5 font-medium">สิทธิ์ที่ใช้</th>
                <th className="px-2 py-1.5 font-medium">ประเภท</th>
                <th className="px-2 py-1.5 text-right font-medium" />
              </tr>
            </thead>
            <tbody>
              {KNOWN_VENUES.filter((v) => v.id !== "ibkr").map((v) => {
                const h = byId.get(v.id);
                const online = h?.online ?? false;
                return (
                  <tr key={v.id} className="border-t border-line-soft text-[10.5px]">
                    <td className="py-[7px] pr-2">
                      <span className="block text-txt">{v.name}</span>
                      <span className="block text-[8.5px] text-dim">{v.note}</span>
                    </td>
                    <td className="px-2 py-[7px]">
                      <span className={`flex items-center gap-1 ${online ? "text-up" : "text-down"}`}>
                        <span className={`h-[6px] w-[6px] rounded-full ${online ? "bg-up" : "bg-down"}`} />
                        {online ? "เชื่อมต่อแล้ว" : "ไม่ตอบสนอง"}
                      </span>
                    </td>
                    <td className="num px-2 py-[7px] text-right text-muted">
                      {h ? `${h.latency} ms` : "—"}
                    </td>
                    <td className="px-2 py-[7px] text-muted">อ่านราคาสาธารณะ</td>
                    <td className="px-2 py-[7px] text-dim">Public</td>
                    <td className="px-2 py-[7px] text-right">
                      <span className="text-[9px] text-dim">ไม่มีคีย์ส่วนตัว</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[9px] leading-snug text-dim">
          สถานะและ Latency ด้านบนวัดจริงจากปลายทางสาธารณะของแต่ละกระดานทุกไม่กี่วินาที
          ตรงกับที่แสดงในหน้าการส่งคำสั่งสด — แต่การเชื่อมต่อทั้งหมดใช้เฉพาะข้อมูลสาธารณะ ไม่มีการผูกคีย์ส่วนตัวใด ๆ
        </p>
      </Card>

      {adding && (
        <Card title="เพิ่มการเชื่อมต่อใหม่" titleEn="Add Connection">
          <div className="rounded border border-down/40 bg-[#1d0b12] p-2.5">
            <div className="text-[11px] font-bold text-down">แพลตฟอร์มนี้ไม่รับ API Key ของกระดานเทรด</div>
            <p className="mt-1 text-[10px] leading-relaxed text-muted">
              การรับ API Key ที่มีสิทธิ์เทรดหมายถึงการเก็บความลับที่ถอนเงินหรือส่งคำสั่งแทนคุณได้ ซึ่งต้องมี
              การเข้ารหัสฝั่งเซิร์ฟเวอร์ การจัดการคีย์ลับ และการตรวจสอบความปลอดภัยระดับที่เดโมนี้ไม่มี —
              จึงเลือกที่จะ<strong className="text-txt">ไม่รับเลย</strong> ปลอดภัยกว่ารับแล้วเก็บไม่รัดกุม
            </p>
            <p className="mt-1.5 text-[9.5px] leading-snug text-dim">
              ทั้งแพลตฟอร์มทำงานบนข้อมูลสาธารณะและการจำลอง (PAPER) เท่านั้น หากต้องเชื่อมบัญชีจริงในอนาคต
              กฎที่จะบังคับคือ: อนุญาตเฉพาะสิทธิ์อ่านและเทรด · ห้ามเปิดสิทธิ์ถอนเงิน · แนะนำ IP Whitelist ·
              เข้ารหัส Secret ทุกตัว · ไม่แสดง Secret เต็มหลังบันทึก · มีปุ่มเพิกถอนทันที
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 opacity-40">
              <Field label="API Key">
                <Text value="" onChange={() => {}} placeholder="ปิดรับ" disabled />
              </Field>
              <Field label="API Secret">
                <Text value="" onChange={() => {}} placeholder="ปิดรับ" disabled />
              </Field>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="mt-2 rounded border border-line px-2.5 py-[6px] text-[10px] text-muted hover:text-txt"
          >
            เข้าใจแล้ว ปิดหน้าต่างนี้
          </button>
        </Card>
      )}

      <Card title="กระดานเริ่มต้น" titleEn="Preferred Venue">
        <Field label="ใช้เป็นแหล่งราคาและกระดานเริ่มต้น">
          <Select
            value={s.data.preferredVenue}
            onChange={(v) => set("data", { preferredVenue: v })}
            options={KNOWN_VENUES.filter((x) => x.id !== "ibkr").map((x) => ({ id: x.id, label: x.name }))}
          />
        </Field>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trading Defaults
 * ------------------------------------------------------------------ */

export function TradingTab({ s, set }: { s: Settings; set: Setter }) {
  const t = s.trading;
  const futures = t.contract === "futures";
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="คำสั่งเริ่มต้น" titleEn="Order Defaults">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ตลาด">
            <Seg value={t.market} onChange={(v) => set("trading", { market: v })} options={[{ id: "crypto", label: "คริปโต" }, { id: "stock", label: "หุ้น" }]} />
          </Field>
          <Field label="ประเภทสัญญา">
            <Seg value={t.contract} onChange={(v) => set("trading", { contract: v })} options={[{ id: "spot", label: "Spot" }, { id: "futures", label: "Futures" }]} />
          </Field>
          <Field label="ทิศทาง">
            <Seg value={t.direction} onChange={(v) => set("trading", { direction: v })} options={[{ id: "long", label: "Long" }, { id: "short", label: "Short" }, { id: "both", label: "ทั้งคู่" }]} />
          </Field>
          <Field label="Margin Mode">
            <Seg value={t.marginMode} onChange={(v) => set("trading", { marginMode: v })} options={[{ id: "isolated", label: "Isolated" }, { id: "cross", label: "Cross" }]} />
          </Field>
          <Field label="ประเภทออเดอร์">
            <Select value={t.orderType} onChange={(v) => set("trading", { orderType: v })} options={[{ id: "market", label: "Market" }, { id: "limit", label: "Limit" }]} />
          </Field>
          <Field label="Time in Force">
            <Select value={t.timeInForce} onChange={(v) => set("trading", { timeInForce: v })} options={[{ id: "GTC", label: "GTC" }, { id: "IOC", label: "IOC" }, { id: "FOK", label: "FOK" }, { id: "PO", label: "Post Only" }]} />
          </Field>
        </div>
      </Card>

      <Card title="ขนาดและการคุมความเสี่ยงต่อไม้" titleEn="Sizing & Brackets">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ขนาดสถานะเริ่มต้น" hint="% ของทุน">
            <Num value={t.positionPct} min={0.1} max={100} step={0.5} onChange={(v) => set("trading", { positionPct: v })} unit="%" />
          </Field>
          <Field label="Leverage เริ่มต้น" hint={futures ? "" : "Spot = 1x"}>
            <Num value={futures ? t.leverage : 1} min={1} max={125} onChange={(v) => set("trading", { leverage: v })} unit="x" />
          </Field>
          <Field label="Take Profit" hint="%">
            <Num value={t.takeProfitPct} min={0} step={0.5} onChange={(v) => set("trading", { takeProfitPct: v })} unit="%" />
          </Field>
          <Field label="Stop Loss" hint="%">
            <Num value={t.stopLossPct} min={0} step={0.5} onChange={(v) => set("trading", { stopLossPct: v })} unit="%" />
          </Field>
          <Field label="Slippage สูงสุด" hint="%">
            <Num value={t.slippagePct} min={0} step={0.01} onChange={(v) => set("trading", { slippagePct: v })} unit="%" />
          </Field>
        </div>
        <div className="mt-1.5">
          <Toggle label="Trailing Stop" on={t.trailing} onChange={(v) => set("trading", { trailing: v })} />
          <Toggle label="Reduce Only" on={t.reduceOnly} onChange={(v) => set("trading", { reduceOnly: v })} />
          <Toggle label="Post Only" on={t.postOnly} onChange={(v) => set("trading", { postOnly: v })} />
        </div>
        <Note>ค่าเหล่านี้เป็นเพียงค่าเริ่มต้นเวลาสร้างคำสั่ง — ทุกคำสั่งยังต้องผ่าน Risk Engine ก่อนเสมอ</Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Risk & Leverage — with the live impact preview
 * ------------------------------------------------------------------ */

export function RiskTab({ s, set }: { s: Settings; set: Setter }) {
  const r = s.risk;
  const warnings = riskWarnings(r, s.trading);

  const rows: [keyof Settings["risk"], string, string, number, number, number][] = [
    ["maxLeverage", "Leverage สูงสุด", "x", 1, 125, 1],
    ["riskPerTradePct", "ความเสี่ยงต่อไม้", "%", 0.05, 10, 0.05],
    ["dailyLossLimitPct", "ขีดจำกัดขาดทุนรายวัน", "%", 0.5, 50, 0.5],
    ["weeklyLossLimitPct", "ขีดจำกัดขาดทุนรายสัปดาห์", "%", 1, 80, 0.5],
    ["maxDrawdownPct", "Drawdown สูงสุด", "%", 1, 90, 0.5],
    ["marginUsageLimitPct", "เพดานการใช้มาร์จิน", "%", 5, 100, 5],
    ["maxOpenPositions", "จำนวน Position สูงสุด", "", 1, 50, 1],
    ["perSymbolExposurePct", "Exposure ต่อเหรียญ", "%", 5, 100, 5],
    ["perVenueExposurePct", "Exposure ต่อกระดาน", "%", 5, 100, 5],
    ["correlationLimit", "เพดานค่าสหสัมพันธ์", "", 0.1, 1, 0.05],
    ["minLiquidationDistancePct", "ระยะถึงการบังคับปิดขั้นต่ำ", "%", 1, 50, 1],
    ["consecutiveLossLimit", "แพ้ติดกันสูงสุด", "ไม้", 1, 20, 1],
    ["newsLockoutMin", "งดเทรดก่อน/หลังข่าว", "นาที", 0, 120, 5],
  ];

  return (
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Card title="นโยบายความเสี่ยง" titleEn="Risk Policy">
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map(([key, label, unit, min, max, step]) => (
            <Field key={key} label={label} hint={unit}>
              <Num
                value={r[key]}
                min={min}
                max={max}
                step={step}
                unit={unit}
                onChange={(v) => set("risk", { [key]: v } as Partial<Settings["risk"]>)}
              />
            </Field>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2.5">
        <Card title="ผลกระทบก่อนบันทึก" titleEn="Impact Preview">
          {warnings.length === 0 ? (
            <p className="py-3 text-center text-[10.5px] text-up">
              ค่าที่ตั้งไว้อยู่ในกรอบที่สมเหตุสมผล ไม่พบความขัดแย้ง
            </p>
          ) : (
            <ul className="space-y-1.5">
              {warnings.map((w, i) => (
                <li
                  key={i}
                  className={`rounded border px-2 py-1.5 text-[9.5px] leading-snug ${
                    w.level === "danger"
                      ? "border-down/40 bg-[#1d0b12] text-down"
                      : "border-warn/30 bg-[#20180a] text-warn"
                  }`}
                >
                  {w.text}
                </li>
              ))}
            </ul>
          )}
          <Note>
            การเปลี่ยน Global Risk ในระบบจริงต้องมีผู้อนุมัติก่อนมีผล และจะถูกกระจายไปยัง Risk Engine,
            การจัดสรรทุน และ Execution ทุกจุด
          </Note>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * AI & Automation
 * ------------------------------------------------------------------ */

export function AiTab({ s, set }: { s: Settings; set: Setter }) {
  const ai = s.ai;
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="โหมดการทำงานของ AI" titleEn="Automation Mode">
        <div className="grid gap-1.5">
          {AI_MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => set("ai", { mode: m.id })}
              className={`flex items-center gap-2 rounded border px-2 py-1.5 text-left transition-colors ${
                ai.mode === m.id ? "border-brand/50 bg-[#062a38]" : "border-line-soft bg-[#0a121a] hover:bg-[#0d1922]"
              }`}
            >
              <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${ai.mode === m.id ? "bg-brand" : "bg-[#2a3a46]"}`} />
              <span className="min-w-0">
                <span className={`block truncate text-[11px] ${ai.mode === m.id ? "text-brand" : "text-txt"}`}>{m.th}</span>
                <span className="block truncate text-[9px] text-dim">{m.detail}</span>
              </span>
            </button>
          ))}
        </div>
        <Note tone="warn">
          แม้เลือก &ldquo;อัตโนมัติเต็มรูปแบบ&rdquo; AI ก็ยังส่งคำสั่งผ่าน Risk Engine เสมอและข้ามไม่ได้ —
          และในแพลตฟอร์มนี้ทุกคำสั่งเป็นการจำลอง ไม่ถูกส่งไปยังกระดานจริง
        </Note>
      </Card>

      <Card title="เงื่อนไขและการอนุญาต" titleEn="Guards & Permissions">
        <div className="grid grid-cols-2 gap-2">
          <Field label="ความมั่นใจ AI ขั้นต่ำ" hint="%">
            <Num value={ai.minConfidence} min={0} max={100} onChange={(v) => set("ai", { minConfidence: v })} unit="%" />
          </Field>
          <Field label="ฉันทามติขั้นต่ำ" hint="%">
            <Num value={ai.minConsensus} min={0} max={100} onChange={(v) => set("ai", { minConsensus: v })} unit="%" />
          </Field>
          <Field label="Risk/Reward ขั้นต่ำ">
            <Num value={ai.minRiskReward} min={0.5} max={10} step={0.1} onChange={(v) => set("ai", { minRiskReward: v })} />
          </Field>
        </div>
        <div className="mt-1.5">
          <Toggle label="ปรับสมดุลพอร์ตอัตโนมัติ" on={ai.autoRebalance} onChange={(v) => set("ai", { autoRebalance: v })} />
          <Toggle label="ป้องกันความเสี่ยงอัตโนมัติ (Auto Hedge)" on={ai.autoHedge} onChange={(v) => set("ai", { autoHedge: v })} />
          <Toggle label="ปรับ Leverage แบบไดนามิก" on={ai.dynamicLeverage} onChange={(v) => set("ai", { dynamicLeverage: v })} />
          <Toggle label="ลดขนาดสถานะอัตโนมัติเมื่อเสี่ยง" on={ai.autoReduce} onChange={(v) => set("ai", { autoReduce: v })} />
          <Toggle label="ล็อกเวอร์ชันโมเดล" hint="ไม่อัปเดตโมเดลเองระหว่างรัน" on={ai.modelVersionLock} onChange={(v) => set("ai", { modelVersionLock: v })} />
        </div>
        <div className="mt-1.5">
          <Toggle label="จำกัดชั่วโมงที่อนุญาตให้เทรด" on={ai.tradingHours.restricted} onChange={(v) => set("ai", { tradingHours: { ...ai.tradingHours, restricted: v } })} />
          {ai.tradingHours.restricted && (
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Field label="ตั้งแต่">
                <input type="time" className="num w-full rounded border border-line bg-[#0a121a] px-2 py-[5px] text-[11px] text-txt" value={ai.tradingHours.from} onChange={(e) => set("ai", { tradingHours: { ...ai.tradingHours, from: e.target.value } })} />
              </Field>
              <Field label="ถึง">
                <input type="time" className="num w-full rounded border border-line bg-[#0a121a] px-2 py-[5px] text-[11px] text-txt" value={ai.tradingHours.to} onChange={(e) => set("ai", { tradingHours: { ...ai.tradingHours, to: e.target.value } })} />
              </Field>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

export function NotificationsTab({ s, set }: { s: Settings; set: Setter }) {
  const n = s.notifications;
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="ช่องทาง" titleEn="Channels">
        {NOTIF_CHANNELS.map((c) => (
          <Toggle
            key={c.id}
            label={c.th}
            hint={c.real ? "ส่งได้จริงในระบบ" : "ต้องมีบริการฝั่งเซิร์ฟเวอร์"}
            on={!!n.channels[c.id]}
            onChange={(v) => set("notifications", { channels: { ...n.channels, [c.id]: v } })}
          />
        ))}
        <Field label="รูปแบบการส่ง">
          <Seg
            value={n.digest}
            onChange={(v) => set("notifications", { digest: v })}
            options={[{ id: "instant", label: "ทันที" }, { id: "hourly", label: "สรุปรายชั่วโมง" }, { id: "daily", label: "สรุปรายวัน" }]}
          />
        </Field>
      </Card>

      <Card title="ประเภทที่จะรับ" titleEn="Event Types">
        <div className="grid grid-cols-2 gap-x-3">
          {NOTIF_EVENTS.map((e) => (
            <Toggle
              key={e.id}
              label={e.th}
              on={!!n.events[e.id]}
              onChange={(v) => set("notifications", { events: { ...n.events, [e.id]: v } })}
            />
          ))}
        </div>
        <Note>
          ตั้งค่านี้เชื่อมกับหน้าการแจ้งเตือน — ช่องทางในระบบทำงานจริง ส่วนช่องทางอื่นเก็บเป็นค่าตั้งไว้จนกว่าจะมีบริการส่งฝั่งเซิร์ฟเวอร์
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Users & Permissions
 * ------------------------------------------------------------------ */

export function UsersTab() {
  return (
    <div className="flex flex-col gap-2.5">
      <Card
        title="ผู้ใช้และบทบาท"
        titleEn="Users & Roles"
        right={<span className="text-[9px] text-dim">Team · Fund · Enterprise</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="py-1.5 pr-2 font-medium">บทบาท</th>
                <th className="px-2 py-1.5 font-medium">ขอบเขตสิทธิ์</th>
                <th className="px-2 py-1.5 text-right font-medium">2FA</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_ROLES.map((r) => (
                <tr key={r.en} className="border-t border-line-soft text-[10.5px]">
                  <td className="py-[7px] pr-2">
                    <span className="block text-txt">{r.th}</span>
                    <span className="block text-[8.5px] text-dim">{r.en}</span>
                  </td>
                  <td className="px-2 py-[7px] text-muted">{r.scope}</td>
                  <td className="px-2 py-[7px] text-right text-up">บังคับ</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["เชิญสมาชิก", "สร้างบทบาท", "กำหนดสิทธิ์รายหน้า", "กำหนดวงเงินอนุมัติ", "ระงับบัญชี"].map((x) => (
            <button key={x} type="button" className="rounded border border-line bg-[#0f1c26] px-2 py-[5px] text-[10px] text-muted hover:text-txt">
              {x}
            </button>
          ))}
        </div>
        <Note tone="warn">
          การจัดการผู้ใช้ต้องมีฐานข้อมูลบัญชีและการตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์ ซึ่งเดโมนี้ยังไม่มี —
          ตารางนี้แสดงโครงสร้างบทบาทและสิทธิ์ · ทุกการเปลี่ยนสิทธิ์ในระบบจริงต้องบันทึกลงบันทึกตรวจสอบ
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Display, Language & Time Zone
 * ------------------------------------------------------------------ */

export function DisplayTab({ s, set }: { s: Settings; set: Setter }) {
  const d = s.display;
  const ACCENTS = ["#00d4ff", "#14e2a0", "#a78bfa", "#ffb020", "#f472b6"];
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="การแสดงผล" titleEn="Display">
        <Field label="ภาษา">
          <Seg value={d.language} onChange={(v) => set("display", { language: v })} options={[{ id: "th", label: "ไทย" }, { id: "en", label: "English" }]} />
        </Field>
        <div className="mt-2">
          <Field label="สี Accent">
            <div className="flex gap-1.5">
              {ACCENTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`accent ${c}`}
                  onClick={() => set("display", { accent: c })}
                  className={`h-7 w-7 rounded-full border-2 ${d.accent === c ? "border-white" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </Field>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Field label="ขนาดตัวอักษร">
            <Seg value={d.fontScale} onChange={(v) => set("display", { fontScale: v })} options={[{ id: "compact", label: "เล็ก" }, { id: "normal", label: "ปกติ" }, { id: "large", label: "ใหญ่" }]} />
          </Field>
          <Field label="ความหนาแน่นเลย์เอาต์">
            <Seg value={d.layout} onChange={(v) => set("display", { layout: v })} options={[{ id: "compact", label: "แน่น" }, { id: "comfortable", label: "โปร่ง" }]} />
          </Field>
        </div>
        <div className="mt-1">
          <Toggle label="ซ่อนยอดเงิน" hint="แทนตัวเลขด้วยเครื่องหมาย" on={d.hideBalances} onChange={(v) => set("display", { hideBalances: v })} />
        </div>
        <Note>
          ธีมของแพลตฟอร์มออกแบบมาสำหรับโหมดมืดโดยเฉพาะ — ตัวเลือกธีมสว่างจะถูกบันทึกไว้แต่ยังไม่มีผลจนกว่าจะสร้างชุดสีสว่างเสร็จ
          จึงเลือกที่จะบอกตรง ๆ แทนที่จะให้ปุ่มที่กดแล้วหน้าตาไม่เปลี่ยน
        </Note>
      </Card>

      <Card title="วันเวลาและตัวเลข" titleEn="Date, Time & Numbers">
        <div className="grid grid-cols-2 gap-2">
          <Field label="เขตเวลา">
            <Select
              value={d.timezone}
              onChange={(v) => set("display", { timezone: v })}
              options={[
                { id: "Asia/Bangkok", label: "(UTC+7) กรุงเทพฯ" },
                { id: "Asia/Singapore", label: "(UTC+8) สิงคโปร์" },
                { id: "UTC", label: "UTC" },
                { id: "America/New_York", label: "(UTC-5/-4) นิวยอร์ก" },
              ]}
            />
          </Field>
          <Field label="สกุลเงินอ้างอิง">
            <Select value={d.referenceCurrency} onChange={(v) => set("display", { referenceCurrency: v })} options={[{ id: "USDT", label: "USDT" }, { id: "THB", label: "บาท (THB)" }, { id: "USD", label: "USD" }]} />
          </Field>
          <Field label="รูปแบบวันที่">
            <Select value={d.dateFormat} onChange={(v) => set("display", { dateFormat: v })} options={[{ id: "YYYY-MM-DD", label: "YYYY-MM-DD" }, { id: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { id: "MM/DD/YYYY", label: "MM/DD/YYYY" }]} />
          </Field>
          <Field label="รูปแบบตัวเลข">
            <Seg value={d.numberFormat} onChange={(v) => set("display", { numberFormat: v })} options={[{ id: "thousands", label: "1,234.56" }, { id: "compact", label: "1.2K" }]} />
          </Field>
        </div>
        <div className="mt-1">
          <Toggle label="ใช้เวลาแบบ 24 ชั่วโมง" on={d.time24h} onChange={(v) => set("display", { time24h: v })} />
        </div>
        <Note>ค่าแนะนำสำหรับผู้ใช้ไทย: ภาษาไทย · เขตเวลา Asia/Bangkok · เวลา 24 ชั่วโมง · อ้างอิง USDT หรือ THB</Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Data & Market
 * ------------------------------------------------------------------ */

export function DataTab({ s, set }: { s: Settings; set: Setter }) {
  const d = s.data;
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="แหล่งข้อมูล" titleEn="Data Sources">
        <dl className="text-[10.5px]">
          {[
            ["ข้อมูลตลาด", d.marketProvider],
            ["ข่าว", d.newsProvider],
            ["ข้อมูลออนเชน", d.onchainProvider],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2 border-b border-line-soft py-[6px] last:border-0">
              <dt className="shrink-0 text-muted">{k}</dt>
              <dd className="min-w-0 truncate text-right text-txt">{v}</dd>
            </div>
          ))}
        </dl>
        <Note>แหล่งข้อมูลเหล่านี้เป็นปลายทางสาธารณะที่แพลตฟอร์มใช้จริงอยู่แล้ว หากแหล่งหลักล่ม ระบบจะสลับไปมิเรอร์และแจ้งเตือนในหน้าการแจ้งเตือน</Note>
      </Card>

      <Card title="คุณภาพและความถี่ข้อมูล" titleEn="Refresh & Quality">
        <div className="grid grid-cols-2 gap-2">
          <Field label="อัตรารีเฟรช" hint="วินาที">
            <Num value={d.refreshRateSec} min={1} max={60} onChange={(v) => set("data", { refreshRateSec: v })} unit="วิ" />
          </Field>
          <Field label="เกณฑ์ข้อมูลเก่า" hint="วินาที">
            <Num value={d.staleThresholdSec} min={5} max={300} step={5} onChange={(v) => set("data", { staleThresholdSec: v })} unit="วิ" />
          </Field>
          <Field label="เพดานส่วนต่างราคา" hint="%">
            <Num value={d.priceDeviationPct} min={0.1} max={5} step={0.1} onChange={(v) => set("data", { priceDeviationPct: v })} unit="%" />
          </Field>
        </div>
        <Note>เกณฑ์ส่วนต่างราคาเชื่อมกับกฎ &ldquo;ราคาระหว่างกระดานต่างกันผิดปกติ&rdquo; ในหน้าการแจ้งเตือน</Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Billing
 * ------------------------------------------------------------------ */

export function BillingTab() {
  return (
    <div className="grid gap-2.5 lg:grid-cols-2">
      <Card title="แพ็กเกจปัจจุบัน" titleEn="Subscription">
        <dl className="text-[10.5px]">
          {[
            ["แพ็กเกจ", "Enterprise"],
            ["ผู้ใช้", "ไม่จำกัด"],
            ["AI Agents", "50 ตัว (10 pod)"],
            ["การเชื่อมต่อกระดาน", "5 กระดาน (ข้อมูลสาธารณะ)"],
            ["วันต่ออายุ", "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between border-b border-line-soft py-[6px] last:border-0">
              <dt className="text-muted">{k}</dt>
              <dd className="text-txt">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["เปลี่ยนแพ็กเกจ", "ใบแจ้งหนี้", "วิธีชำระเงิน"].map((x) => (
            <button key={x} type="button" className="rounded border border-line bg-[#0f1c26] px-2 py-[5px] text-[10px] text-muted hover:text-txt">
              {x}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Enterprise" titleEn="Contract & SLA">
        <Note tone="warn">
          ส่วนการเรียกเก็บเงินต้องเชื่อมกับผู้ให้บริการชำระเงินและระบบสัญญา ซึ่งเดโมนี้ไม่มี —
          ข้อมูลด้านซ้ายแสดงโครงสร้างแพ็กเกจของแพลตฟอร์ม ไม่มีการเรียกเก็บเงินจริงและไม่รับข้อมูลบัตร
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Audit & Logs
 * ------------------------------------------------------------------ */

export function AuditTab({ audit }: { audit: AuditEntry[] }) {
  const [criticalOnly, setCriticalOnly] = useState(false);
  const rows = criticalOnly ? audit.filter((a) => a.critical) : audit;

  const fmt = (t: number) =>
    new Date(t).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

  return (
    <Card
      title="บันทึกการตรวจสอบ"
      titleEn="Audit Log"
      right={
        <label className="flex cursor-pointer items-center gap-1.5 text-[9.5px] text-muted">
          <input type="checkbox" checked={criticalOnly} onChange={(e) => setCriticalOnly(e.target.checked)} className="accent-[#00d4ff]" />
          เฉพาะรายการสำคัญ
        </label>
      }
    >
      {rows.length === 0 ? (
        <p className="py-8 text-center text-[10.5px] text-dim">
          ยังไม่มีการเปลี่ยนแปลงในเซสชันนี้ — แก้ค่าใด ๆ แล้วกด &ldquo;บันทึกการตั้งค่า&rdquo; รายการจะปรากฏที่นี่
        </p>
      ) : (
        <div className="max-h-[440px] overflow-y-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead className="sticky top-0 bg-panel">
              <tr className="text-[8.5px] uppercase tracking-wide text-dim">
                <th className="py-1.5 pr-2 font-medium">เวลา</th>
                <th className="px-2 py-1.5 font-medium">ผู้ทำ</th>
                <th className="px-2 py-1.5 font-medium">รายการ</th>
                <th className="px-2 py-1.5 font-medium">เดิม → ใหม่</th>
                <th className="px-2 py-1.5 text-right font-medium">ระดับ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-t border-line-soft text-[10px]">
                  <td className="num whitespace-nowrap py-[6px] pr-2 text-dim">{fmt(a.time)}</td>
                  <td className="px-2 py-[6px] text-muted">{a.actor}</td>
                  <td className="px-2 py-[6px] text-txt">{a.label}</td>
                  <td className="num px-2 py-[6px] text-muted">
                    <span className="text-down/80">{a.from}</span> <span className="text-dim">→</span>{" "}
                    <span className="text-up/80">{a.to}</span>
                  </td>
                  <td className="px-2 py-[6px] text-right">
                    {a.critical ? (
                      <span className="rounded border border-down/40 bg-[#2c1119] px-1 py-[1px] text-[8px] text-down">สำคัญ</span>
                    ) : (
                      <span className="text-[8.5px] text-dim">ปกติ</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Note>
        ทุกการบันทึกการตั้งค่าจะเขียนบันทึกนี้พร้อมค่าเดิม ค่าใหม่ เวลา และผู้ทำ — เก็บไว้ในเบราว์เซอร์ของเครื่องนี้
        รายการระดับสำคัญ (Leverage, ขีดจำกัดขาดทุน, โหมด AI, 2FA, บทบาท) ถูกทำเครื่องหมายไว้และไม่มีปุ่มลบจากหน้านี้
        {" "}
        <Link href="/alerts" className="text-brand">
          ดูเหตุการณ์ระบบที่หน้าการแจ้งเตือน
        </Link>
      </Note>
    </Card>
  );
}

/* ------------------------------------------------------------------ *
 * Right rail
 * ------------------------------------------------------------------ */

export function RoleSwitcher({ role, onChange }: { role: RoleId; onChange: (r: RoleId) => void }) {
  return (
    <Card title="มุมมองตามบทบาท" titleEn="Acting Role">
      <Select value={role} onChange={onChange} options={ROLES.map((r) => ({ id: r.id, label: `${r.th} (${r.en})` }))} />
      <Note>เปลี่ยนบทบาทเพื่อดูว่าผู้ใช้ระดับนั้นเห็นแท็บใดบ้าง — แท็บที่ไม่มีสิทธิ์จะถูกซ่อน และการเปลี่ยนบทบาทถูกบันทึกในบันทึกตรวจสอบ</Note>
    </Card>
  );
}
