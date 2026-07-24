"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMarket, useNow } from "@/lib/market-context";
import {
  appendAudit,
  DEFAULT_SETTINGS,
  diffSettings,
  loadAudit,
  loadSettings,
  saveSettings,
  settingsToJson,
  tabsForRole,
  type AuditEntry,
  type RoleId,
  type Settings,
  type TabId,
} from "@/lib/settings";
import { Panel, Tag } from "../Panel";
import {
  AccountTab,
  AiTab,
  AuditTab,
  BillingTab,
  DataTab,
  DisplayTab,
  ExchangeTab,
  NotificationsTab,
  RiskTab,
  RoleSwitcher,
  SecurityTab,
  TradingTab,
  UsersTab,
} from "./SettingsTabs";

const CONNECTION_LABEL = ["Binance", "Bybit", "OKX", "Bitget", "Hyperliquid"];

export function SettingsView() {
  const { exchanges } = useMarket();

  // AfterMount guarantees this renders client-side only, so localStorage is
  // available for the lazy initialisers — no hydration mismatch, no effect.
  const [saved, setSaved] = useState<Settings>(loadSettings);
  const [draft, setDraft] = useState<Settings>(loadSettings);
  const [audit, setAudit] = useState<AuditEntry[]>(loadAudit);
  const [tab, setTab] = useState<TabId>("account");
  const [flash, setFlash] = useState<"" | "saved" | "reset">("");
  const importRef = useRef<HTMLInputElement>(null);
  const now = useNow(30_000) ?? 0;

  const set = useCallback(
    <K extends keyof Settings>(section: K, patch: Partial<Settings[K]>) => {
      setDraft((d) => ({ ...d, [section]: { ...(d[section] as object), ...patch } }));
    },
    [],
  );

  const setRole = (role: RoleId) => setDraft((d) => ({ ...d, role }));

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const tabs = useMemo(() => tabsForRole(draft.role), [draft.role]);

  // Derive the visible tab: if the acting role can't see the selected one,
  // fall back to its first tab without storing a second source of truth.
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0].id;

  const save = () => {
    const rows = diffSettings(saved, draft, Date.now(), draft.account.displayName || "Super Admin");
    saveSettings(draft);
    setSaved(draft);
    if (rows.length) setAudit(appendAudit(rows));
    setFlash("saved");
    setTimeout(() => setFlash(""), 2500);
  };

  const reset = () => {
    setDraft(DEFAULT_SETTINGS);
    setFlash("reset");
    setTimeout(() => setFlash(""), 2500);
  };

  const revert = () => setDraft(saved);

  const download = (name: string, body: string, type: string) => {
    const url = URL.createObjectURL(new Blob([body], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setDraft((d) => ({ ...d, ...parsed }));
      } catch {
        /* ignore malformed import */
      }
    };
    reader.readAsText(file);
  };

  const online = exchanges.filter((e) => e.online).length;

  const body = () => {
    switch (activeTab) {
      case "account":
        return <AccountTab s={draft} set={set} />;
      case "security":
        return <SecurityTab s={draft} set={set} />;
      case "exchange":
        return <ExchangeTab s={draft} set={set} exchanges={exchanges} />;
      case "trading":
        return <TradingTab s={draft} set={set} />;
      case "risk":
        return <RiskTab s={draft} set={set} />;
      case "ai":
        return <AiTab s={draft} set={set} />;
      case "notifications":
        return <NotificationsTab s={draft} set={set} />;
      case "users":
        return <UsersTab />;
      case "display":
        return <DisplayTab s={draft} set={set} />;
      case "data":
        return <DataTab s={draft} set={set} />;
      case "billing":
        return <BillingTab />;
      case "audit":
        return <AuditTab audit={audit} />;
    }
  };

  return (
    <div className="grid items-start gap-2.5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-2.5">
        {/* Tab bar */}
        <div className="panel flex flex-wrap gap-1 p-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded px-2.5 py-[6px] text-[10.5px] transition-colors ${
                activeTab === t.id ? "bg-brand text-black font-semibold" : "text-muted hover:bg-[#0f1c26] hover:text-txt"
              }`}
            >
              {t.th}
            </button>
          ))}
        </div>

        {body()}

        {/* Save bar */}
        <section className="panel sticky bottom-2 z-10 flex flex-wrap items-center gap-2 p-2.5">
          <span className="flex items-center gap-1.5 text-[10.5px]">
            {flash === "saved" ? (
              <Tag tone="up">บันทึกแล้ว</Tag>
            ) : flash === "reset" ? (
              <Tag tone="warn">คืนค่าเริ่มต้น (ยังไม่บันทึก)</Tag>
            ) : dirty ? (
              <Tag tone="warn">มีการเปลี่ยนแปลงที่ยังไม่บันทึก</Tag>
            ) : (
              <Tag tone="neutral">ไม่มีการเปลี่ยนแปลง</Tag>
            )}
          </span>

          <button
            type="button"
            onClick={save}
            disabled={!dirty}
            className={`rounded px-3 py-[7px] text-[11px] font-bold transition-colors ${
              dirty ? "bg-gradient-to-r from-brand to-[#0b9fd8] text-black hover:brightness-110" : "cursor-not-allowed bg-[#12222c] text-dim"
            }`}
          >
            ✓ บันทึกการตั้งค่า
          </button>
          <button type="button" onClick={revert} disabled={!dirty} className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted hover:text-txt disabled:opacity-35">
            ยกเลิกการแก้ไข
          </button>
          <button type="button" onClick={reset} className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted hover:text-txt">
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>

          <span className="mx-1 h-5 w-px bg-line" />

          <button type="button" onClick={() => download("nexora-settings.json", settingsToJson(draft), "application/json")} className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted hover:text-txt">
            Export ตั้งค่า
          </button>
          <button type="button" onClick={() => importRef.current?.click()} className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted hover:text-txt">
            Import ตั้งค่า
          </button>
          <input
            ref={importRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => setTab("audit")} className="rounded border border-line bg-[#0f1c26] px-2.5 py-[6px] text-[10.5px] text-muted hover:text-txt">
            ดูบันทึกตรวจสอบ
          </button>

          <span className="ml-auto text-[9px] text-dim">
            การตั้งค่าเก็บในเบราว์เซอร์เครื่องนี้ · แก้แล้วต้องกดบันทึกจึงมีผล
          </span>
        </section>
      </div>

      {/* Right rail */}
      <div className="flex flex-col gap-2.5">
        <RoleSwitcher role={draft.role} onChange={setRole} />

        <Panel title="สถานะการเชื่อมต่อ" titleEn="Connections" right={<Tag tone={online >= 4 ? "up" : "warn"}>{online}/{exchanges.length || 5}</Tag>} bodyClassName="p-2.5">
          <ul className="space-y-1">
            {(exchanges.length ? exchanges : CONNECTION_LABEL.map((name, i) => ({ id: String(i), name, online: false, latency: 0, status: 0 }))).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 text-[10.5px]">
                <span className="truncate text-txt">{e.name}</span>
                <span className={`flex shrink-0 items-center gap-1 ${e.online ? "text-up" : "text-down"}`}>
                  <span className={`h-[6px] w-[6px] rounded-full ${e.online ? "bg-up" : "bg-down"}`} />
                  {e.online ? `${e.latency} ms` : "ไม่ตอบสนอง"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[9px] text-dim">สถานะและความหน่วงวัดจริงจากปลายทางสาธารณะ</p>
        </Panel>

        <Panel title="ข้อมูลระบบ" titleEn="System" bodyClassName="p-2.5">
          <dl className="text-[10.5px]">
            {[
              ["เวอร์ชัน", "v0.1.0"],
              ["สภาพแวดล้อม", "Production"],
              ["เซิร์ฟเวอร์", "Singapore · sin1"],
              ["แหล่งข้อมูล", "Binance · Yahoo Finance"],
              ["Execution", "จำลอง (PAPER)"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line-soft py-[5px] last:border-0">
                <dt className="text-muted">{k}</dt>
                <dd className={k === "Execution" ? "text-warn" : "text-txt"}>{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-[9px] leading-snug text-dim">
            แพลตฟอร์มทำงานบนข้อมูลสาธารณะและการจำลอง ไม่รับ API Key และไม่ส่งคำสั่งจริง
            {now > 0 && ` · อัปเดตล่าสุด ${new Date(now).toLocaleTimeString("th-TH", { timeZone: "Asia/Bangkok", hour12: false })}`}
          </p>
        </Panel>
      </div>
    </div>
  );
}
