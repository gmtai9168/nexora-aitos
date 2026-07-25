"use client";

import { useCallback, useEffect, useState } from "react";
import { TESTNET_SYMBOLS } from "@/lib/testnet";

type AgentRow = {
  id: string;
  name: string;
  nameTh: string;
  kind: "direction" | "monitor";
  vote: number;
  confidence: number;
  note: string;
  ok: boolean | null;
  weight: number;
};

type Pod = { key: string; th: string; en: string; color: string; agents: AgentRow[] };

type CouncilData = {
  symbol: string;
  ranAt: number;
  master: { dir: "LONG" | "SHORT" | null; confidence: number; supporting: number; against: number; net: number };
  deep: boolean;
  pods: Pod[];
};

/** Live view of all 50 agents voting — the same council the trader uses. */
export function CouncilPanel() {
  const [symbol, setSymbol] = useState("BTCUSDT");
  const [data, setData] = useState<CouncilData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (sym: string) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/council?symbol=${sym}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as CouncilData);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (active) load(symbol);
    };
    const first = setTimeout(run, 0); // defer so setState isn't synchronous in the effect body
    const t = setInterval(run, 20000);
    return () => {
      active = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [symbol, load]);

  const m = data?.master;
  const dirTone = m?.dir === "LONG" ? "text-up" : m?.dir === "SHORT" ? "text-down" : "text-dim";

  return (
    <div className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-[12px] font-semibold text-txt">คณะ AI 50 ตัว — โหวตสด</h3>
          <p className="text-[9px] text-dim">ทุกตัวคิดจากข้อมูลจริง · Master AI รวมด้วยน้ำหนักที่เรียนรู้จากผลงาน</p>
        </div>
        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="shrink-0 rounded border border-line bg-[#0a121a] px-1.5 py-1 text-[10px] text-txt"
        >
          {TESTNET_SYMBOLS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Master summary */}
      {m && (
        <div className="flex items-center gap-3 border-b border-line-soft px-3 py-2">
          <span className={`text-[13px] font-bold ${dirTone}`}>{m.dir ?? "รอมติ"}</span>
          <span className="text-[10px] text-dim">มั่นใจ <b className="text-brand">{m.confidence}%</b></span>
          <span className="text-[10px] text-up">{m.supporting} หนุน</span>
          <span className="text-[10px] text-down">{m.against} ค้าน</span>
          <span className="ml-auto text-[9px] text-dim">{data?.deep ? "ข่าว AI" : "ข่าวคีย์เวิร์ด"}</span>
        </div>
      )}

      {err && <p className="px-3 py-6 text-center text-[10px] text-down">โหลดไม่ได้: {err}</p>}
      {!data && loading && <p className="px-3 py-6 text-center text-[10px] text-dim">กำลังรวบรวมคะแนน…</p>}

      {data && (
        <div className="max-h-[520px] overflow-y-auto">
          {data.pods.map((pod) => (
            <div key={pod.key} className="border-b border-line-soft last:border-0">
              <div className="flex items-center gap-1.5 bg-[#0b1219] px-3 py-1">
                <span className="size-1.5 rounded-full" style={{ background: pod.color }} />
                <span className="text-[9.5px] font-semibold text-txt">{pod.th}</span>
                <span className="text-[8px] text-dim">{pod.en}</span>
              </div>
              <ul>
                {pod.agents.map((a) => {
                  const isDir = a.kind === "direction" && Math.abs(a.vote) >= 0.12;
                  const up = a.vote > 0;
                  const voteLabel = isDir ? (up ? "LONG" : "SHORT") : a.ok === false ? "เตือน" : a.ok === true ? "ผ่าน" : "เฝ้าดู";
                  const tone = isDir ? (up ? "text-up" : "text-down") : a.ok === false ? "text-warn" : "text-dim";
                  return (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-[5px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[10px] text-txt">{a.nameTh}</span>
                        <span className="block truncate text-[8.5px] text-dim">{a.note}</span>
                      </span>
                      {isDir && (
                        <span className="h-[3px] w-[42px] shrink-0 overflow-hidden rounded-full bg-[#16242f]">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.round(Math.abs(a.vote) * 100)}%`, background: up ? "#14e2a0" : "#ff4a68" }}
                          />
                        </span>
                      )}
                      <span className={`num w-[46px] shrink-0 text-right text-[9.5px] font-bold ${tone}`}>{voteLabel}</span>
                      <span className="num w-[34px] shrink-0 text-right text-[9px] text-brand" title="น้ำหนักที่เรียนรู้">
                        ×{a.weight.toFixed(2)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
