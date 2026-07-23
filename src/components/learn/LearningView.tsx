"use client";

import { useEffect, useMemo, useState } from "react";
import { TOTAL_AGENTS } from "@/lib/agents";
import {
  datasets,
  driftReport,
  featureImportance,
  minedRules,
  modelVersions,
  researchQueue,
  rewardStream,
  type ModelVersion,
} from "@/lib/learning";
import { useMarket, useNow } from "@/lib/market-context";
import { DEFAULT_PARAMS, type StrategyParams } from "@/lib/strategy";
import type { Candle } from "@/lib/types";
import { useCoinIntel } from "@/lib/use-coin-intel";
import {
  DatasetPanel,
  DriftPanel,
  ExplainabilityPanel,
  KnowledgePanel,
  LearningPipeline,
  ModelLibrary,
  ResearchPanel,
  RewardPanel,
} from "./LearningPanels";

const NO_CANDLES: Candle[] = [];
const HORIZON = 12;

export function LearningView() {
  const { symbol, exchanges, lastUpdate, context } = useMarket();
  const intel = useCoinIntel(symbol);
  const now = useNow(10000);

  const [history, setHistory] = useState<{ key: string; data: Candle[] }>({
    key: "",
    data: NO_CANDLES,
  });
  const [params, setParams] = useState<StrategyParams>(DEFAULT_PARAMS);
  const [activeVersion, setActiveVersion] = useState("v5.3");

  const key = `${symbol}|1h|2000`;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&interval=1h&bars=2000`,
        );
        const data: { candles: Candle[] } = await res.json();
        if (!cancelled) setHistory({ key, data: data.candles ?? NO_CANDLES });
      } catch {
        if (!cancelled) setHistory({ key, data: NO_CANDLES });
      }
    };
    const id = setTimeout(load, 0);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [symbol, key]);

  const candles = useMemo(
    () => (history.key === key ? history.data : NO_CANDLES),
    [history, key],
  );
  const loading = history.key !== key;

  // Every panel below is derived from this one real candle series.
  const features = useMemo(() => featureImportance(candles, HORIZON), [candles]);
  const rules = useMemo(() => minedRules(candles, HORIZON), [candles]);
  const drift = useMemo(() => driftReport(candles, params), [candles, params]);
  const versions = useMemo(() => modelVersions(candles, params), [candles, params]);
  const rewards = useMemo(
    () => rewardStream(drift.recent, symbol),
    [drift.recent, symbol],
  );
  const research = useMemo(
    () => researchQueue(features, drift, rules, versions),
    [features, drift, rules, versions],
  );

  const dataSets = useMemo(
    () =>
      datasets({
        candles: candles.length,
        bookLevels: intel.micro.bids.length + intel.micro.asks.length,
        tradeCount: intel.micro.trades.length,
        hasFutures: context.supported && context.funding !== null,
        hasOnChain: intel.onchain.hasChainData,
        newsCount: intel.news.length,
        venuesOnline: exchanges.filter((e) => e.online).length,
        venuesTotal: exchanges.length,
        lastUpdate,
        now: now ?? lastUpdate,
      }),
    [candles.length, intel, context, exchanges, lastUpdate, now],
  );

  const avgAccuracy = versions.length
    ? versions.reduce((a, v) => a + v.accuracy, 0) / versions.length
    : 0;
  const dataQuality = dataSets.length
    ? dataSets.reduce((a, d) => a + d.quality, 0) / dataSets.length
    : 0;

  // Overall progress blends how much data is flowing with how the models score.
  const progress = Math.max(
    5,
    Math.min(100, dataQuality * 0.4 + avgAccuracy * 0.4 + (loading ? 0 : 20)),
  );

  const applyVersion = (v: ModelVersion) => {
    setActiveVersion(v.version);
    setParams(v.params);
  };

  const stats = [
    { th: "โมเดลทั้งหมด", en: "Models", v: `${versions.length}` },
    { th: "AI ในระบบ", en: "Agents", v: `${TOTAL_AGENTS}` },
    { th: "ความแม่นยำเฉลี่ย", en: "Accuracy", v: `${avgAccuracy.toFixed(1)}%` },
    { th: "แท่งเทียนที่เรียนรู้", en: "Bars", v: candles.length.toLocaleString() },
    { th: "คุณภาพข้อมูล", en: "Data Quality", v: `${dataQuality.toFixed(0)}%` },
    { th: "รูปแบบที่จำไว้", en: "Rules", v: `${rules.filter((r) => r.verdict === "จำไว้ใช้").length}` },
    {
      th: "มิติที่เบี่ยงเบน",
      en: "Drift",
      v: `${drift.drifts.filter((d) => d.alert).length}/${drift.drifts.length}`,
    },
    { th: "งานวิจัยรอทำ", en: "Research", v: `${research.length}` },
  ];

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        {stats.map((s) => (
          <div key={s.th} className="panel min-w-0 flex-1 px-2.5 py-1.5">
            <div className="truncate text-[9px] tracking-wide text-dim">
              {s.th} <span className="text-[8px]">{s.en}</span>
            </div>
            <div className="num truncate text-[15px] font-bold text-txt">{s.v}</div>
          </div>
        ))}
      </div>

      <LearningPipeline progress={progress} needsRetrain={drift.needsRetrain} />

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ModelLibrary
          versions={versions}
          onSelect={applyVersion}
          activeVersion={activeVersion}
        />
        <DatasetPanel items={dataSets} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-2">
        <ExplainabilityPanel features={features} horizon={HORIZON} />
        <KnowledgePanel rules={rules} />
      </div>

      <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <DriftPanel
          drifts={drift.drifts}
          needsRetrain={drift.needsRetrain}
          accuracyDrop={drift.accuracyDrop}
        />
        <RewardPanel events={rewards} />
      </div>

      <ResearchPanel tasks={research} />

      <p className="panel px-3 py-2 text-[9.5px] leading-relaxed text-dim">
        <span className="text-brand">หมายเหตุความโปร่งใส:</span>{" "}
        หน้านี้ไม่ได้ฝึกโมเดลด้วย GPU จริง สิ่งที่เป็นของจริงคือการ
        <span className="text-muted"> วัดน้ำหนักฟีเจอร์จากสหสัมพันธ์กับผลตอบแทนล่วงหน้า</span>,
        <span className="text-muted"> ขุดรูปแบบเงื่อนไขจากแท่งเทียนย้อนหลัง {candles.length.toLocaleString()} แท่ง</span>,
        <span className="text-muted"> ตรวจการเสื่อมของโมเดลด้วยการเทียบครึ่งแรกกับครึ่งหลังของข้อมูล</span> และ
        <span className="text-muted"> เปรียบเทียบเวอร์ชันด้วยการรัน Backtest จริงทุกตัว</span> —
        ส่วนคำว่า &quot;Training / GPU&quot; ในระบบจริงจะทำงานฝั่งเซิร์ฟเวอร์ ซึ่งยังไม่ได้เชื่อมต่อ
      </p>
    </div>
  );
}
