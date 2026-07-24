"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMarket } from "@/lib/market-context";
import { useUi } from "@/lib/ui-context";
import {
  IconBell,
  IconBot,
  IconCrosshair,
  IconFlask,
  IconGear,
  IconGrid,
  IconHistory,
  IconLayers,
  IconPie,
  IconPower,
  IconPulse,
  IconShield,
  IconStar,
  IconTarget,
} from "./icons";

type NavItem = {
  href: string;
  th: string;
  en: string;
  Icon: (p: { size?: number }) => React.ReactElement;
};

const NAV: NavItem[] = [
  { href: "/", th: "แดชบอร์ด", en: "Dashboard", Icon: IconGrid },
  { href: "/markets", th: "ข้อมูลเหรียญ", en: "Coin Intelligence", Icon: IconLayers },
  { href: "/ai-network", th: "เครือข่าย AI 50", en: "AI 50 Network", Icon: IconBot },
  { href: "/execution", th: "การส่งคำสั่งสด", en: "Live Execution", Icon: IconPulse },
  { href: "/portfolio", th: "พอร์ตการลงทุน", en: "Portfolio", Icon: IconPie },
  { href: "/strategies", th: "กลยุทธ์", en: "Strategy", Icon: IconTarget },
  { href: "/backtest", th: "ทดสอบย้อนหลัง", en: "Backtesting", Icon: IconFlask },
  { href: "/ai-learning", th: "การเรียนรู้ AI", en: "AI Learning", Icon: IconBot },
  { href: "/risk", th: "ระบบความเสี่ยง", en: "Risk Engine", Icon: IconShield },
  { href: "/market-intelligence", th: "ตลาดโลก", en: "Global Intelligence", Icon: IconCrosshair },
  { href: "/autonomous", th: "ศูนย์อัตโนมัติ", en: "Autonomous Center", Icon: IconTarget },
  { href: "/performance", th: "วิเคราะห์ผลงาน", en: "Performance Analytics", Icon: IconPulse },
  { href: "/fund", th: "บริหารกองทุน", en: "Fund Operations", Icon: IconPie },
  { href: "/war-room", th: "ห้องบัญชาการ", en: "AI War Room", Icon: IconShield },
  { href: "/system-ops", th: "ระบบและโครงสร้าง", en: "System Operations", Icon: IconGear },
  { href: "/executive", th: "ศูนย์ผู้บริหาร", en: "Executive Center", Icon: IconStar },
  { href: "/history", th: "ประวัติการเทรด", en: "Trade History", Icon: IconHistory },
  { href: "/testnet", th: "เทรดทดสอบ", en: "Testnet Execution", Icon: IconPulse },
  { href: "/alerts", th: "การแจ้งเตือน", en: "Alerts", Icon: IconBell },
  { href: "/settings", th: "ตั้งค่า", en: "Settings", Icon: IconGear },
];

function EmergencyStop() {
  const { emergencyStop, setEmergencyStop } = useMarket();
  const [confirming, setConfirming] = useState(false);

  if (emergencyStop) {
    return (
      <div className="space-y-1.5 rounded-md border border-down/60 bg-[#2a0f18] p-2">
        <div className="text-[10.5px] font-bold text-down">🛑 หยุดฉุกเฉินแล้ว</div>
        <ul className="space-y-0.5 text-[9px] text-muted">
          <li>· หยุด AI ทั้งหมด</li>
          <li>· ยกเลิกคำสั่งค้าง</li>
          <li>· ไม่เปิดโพซิชันใหม่</li>
          <li>· แจ้งเตือนผู้ดูแลแล้ว</li>
        </ul>
        <button
          type="button"
          onClick={() => setEmergencyStop(false)}
          className="w-full rounded border border-line bg-[#111e28] py-1 text-[10px] text-muted hover:text-txt"
        >
          กลับสู่การทำงานปกติ
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-1.5 rounded-md border border-down/60 bg-[#1d0b12] p-2">
        <div className="text-[10px] text-txt">ยืนยันหยุดระบบทั้งหมด?</div>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              setEmergencyStop(true);
              setConfirming(false);
            }}
            className="flex-1 rounded bg-down py-1 text-[10px] font-bold text-white"
          >
            ยืนยัน
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex-1 rounded border border-line py-1 text-[10px] text-muted"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-[#6b1f31] bg-gradient-to-b from-[#3a1220] to-[#2a0f18] py-2.5 text-[11px] font-bold tracking-wide text-down transition-colors hover:from-[#4d1729] hover:to-[#35131f]"
    >
      <IconPower size={14} />
      EMERGENCY STOP
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { navOpen, closeNav } = useUi();

  return (
    <>
      {/* Backdrop — only on mobile when the drawer is open */}
      {navOpen && (
        <button
          type="button"
          aria-label="ปิดเมนู"
          onClick={closeNav}
          className="fixed inset-0 top-[70px] z-20 bg-black/50 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[196px] flex-col border-r border-line bg-shell pt-[70px] transition-transform duration-200 lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2.5">
          {NAV.map(({ href, th, en, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={closeNav}
                className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] transition-colors ${
                  active
                    ? "bg-gradient-to-r from-[#062a38] to-transparent text-brand"
                    : "text-muted hover:bg-[#0d1922] hover:text-txt"
                }`}
              >
                {active && (
                  <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand shadow-[0_0_10px_rgba(0,212,255,0.8)]" />
                )}
                <Icon size={16} />
                <span className="min-w-0 leading-tight">
                  <span className="block truncate text-[11.5px] font-medium">{th}</span>
                  <span
                    className={`block truncate text-[9px] ${
                      active ? "text-brand/60" : "text-dim"
                    }`}
                  >
                    {en}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line p-2">
          <EmergencyStop />
        </div>
      </aside>
    </>
  );
}
