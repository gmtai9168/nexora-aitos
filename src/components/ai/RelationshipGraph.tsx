"use client";

import { GROUP_BY_KEY } from "@/lib/agents";
import { useMarket } from "@/lib/market-context";
import { Panel, Tag } from "../Panel";

type Node = { id: string; label: string; th: string; x: number; y: number; group?: string };

const W = 1000;
const H = 300;

/** The data path, laid out left to right: feed → analysis → ML → risk → venue. */
const NODES: Node[] = [
  { id: "feed", label: "Exchange Feed", th: "ฟีดจาก Exchange", x: 60, y: 150 },
  { id: "data", label: "Market Data AI", th: "ข้อมูลตลาด", x: 190, y: 150, group: "data" },
  { id: "feature", label: "Feature Engine", th: "สร้างฟีเจอร์", x: 320, y: 150 },
  { id: "trend", label: "Trend AI", th: "เทรนด์", x: 460, y: 55, group: "trend" },
  { id: "smart", label: "Smart Money", th: "เงินใหญ่", x: 460, y: 118, group: "smart" },
  { id: "futures", label: "Futures AI", th: "ฟิวเจอร์ส", x: 460, y: 182, group: "futures" },
  { id: "pattern", label: "Pattern AI", th: "รูปแบบเทรด", x: 460, y: 245, group: "pattern" },
  { id: "ml", label: "Machine Learning", th: "แมชชีนเลิร์นนิง", x: 615, y: 150, group: "ml" },
  { id: "risk", label: "Risk Engine", th: "ระบบความเสี่ยง", x: 740, y: 150, group: "risk" },
  { id: "master", label: "Master AI", th: "มาสเตอร์", x: 855, y: 150, group: "master" },
  { id: "exec", label: "Execution AI", th: "ส่งคำสั่ง", x: 855, y: 245, group: "exec" },
  { id: "venue", label: "Exchange", th: "ตลาด", x: 950, y: 55 },
];

const EDGES: [string, string][] = [
  ["feed", "data"],
  ["data", "feature"],
  ["feature", "trend"],
  ["feature", "smart"],
  ["feature", "futures"],
  ["feature", "pattern"],
  ["trend", "ml"],
  ["smart", "ml"],
  ["futures", "ml"],
  ["pattern", "ml"],
  ["ml", "risk"],
  ["risk", "master"],
  ["master", "exec"],
  ["exec", "venue"],
  ["master", "venue"],
];

const BY_ID = new Map(NODES.map((n) => [n.id, n]));

export function RelationshipGraph() {
  const { connected, emergencyStop } = useMarket();
  const flowing = connected && !emergencyStop;

  const colorOf = (n: Node) =>
    n.group ? (GROUP_BY_KEY.get(n.group)?.color ?? "#6b8497") : "#6b8497";

  return (
    <Panel
      title="ความสัมพันธ์ของ AI"
      titleEn="AI Relationship Graph"
      right={
        <Tag tone={flowing ? "up" : "down"}>
          {flowing ? "ข้อมูลกำลังไหล" : "หยุดไหล"}
        </Tag>
      }
      bodyClassName="p-2"
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="ผังการไหลของข้อมูลระหว่าง AI">
        {EDGES.map(([from, to]) => {
          const a = BY_ID.get(from)!;
          const b = BY_ID.get(to)!;
          const mx = (a.x + b.x) / 2;
          return (
            <path
              key={`${from}-${to}`}
              d={`M ${a.x + 46} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 46} ${b.y}`}
              fill="none"
              stroke={colorOf(b)}
              strokeOpacity="0.45"
              strokeWidth="1.2"
              className={flowing ? "flow-line-slow" : undefined}
            />
          );
        })}

        {NODES.map((n) => {
          const c = colorOf(n);
          return (
            <g key={n.id}>
              <rect
                x={n.x - 46}
                y={n.y - 17}
                width="92"
                height="34"
                rx="6"
                fill="#08131b"
                stroke={c}
                strokeOpacity="0.65"
                strokeWidth="1.2"
              />
              <text
                x={n.x}
                y={n.y - 2}
                textAnchor="middle"
                fill={c}
                fontSize="9.5"
                fontWeight="700"
              >
                {n.label}
              </text>
              <text x={n.x} y={n.y + 10} textAnchor="middle" fill="#6b8497" fontSize="8">
                {n.th}
              </text>
              {flowing && (
                <circle r="2.6" fill={c}>
                  <animate
                    attributeName="opacity"
                    values="0.25;1;0.25"
                    dur="2s"
                    repeatCount="indefinite"
                  />
                  <animateMotion
                    dur="2.4s"
                    repeatCount="indefinite"
                    path={`M ${n.x - 46} ${n.y - 17} h 92`}
                  />
                </circle>
              )}
            </g>
          );
        })}
      </svg>
    </Panel>
  );
}
