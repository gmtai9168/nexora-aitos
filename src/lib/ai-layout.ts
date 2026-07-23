import { AGENTS, GROUPS, type Agent } from "./agents";

export const MAP_W = 1200;
export const MAP_H = 880;
export const CX = MAP_W / 2;
export const CY = MAP_H / 2;

export const HUB_R = 52;
const RING_1 = 232;
const RING_2 = 336;
const LABEL_R = 408;
/** Half-width of the arc a pod occupies, in degrees. */
const SPREAD = 12;

export type NodePos = {
  agent: Agent;
  x: number;
  y: number;
  color: string;
  groupKey: string;
  /** 1 = inner arc, 2 = outer arc. Labels flip side so they never collide. */
  ring: 1 | 2;
};

export type GroupLabel = {
  key: string;
  th: string;
  en: string;
  x: number;
  y: number;
  color: string;
  anchor: "start" | "middle" | "end";
};

function polar(angleDeg: number, radius: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
}

/** Master pods sit at the hub; the other nine fan out clockwise from the top. */
const RADIAL = GROUPS.filter((g) => g.key !== "master");

export function buildLayout(): { nodes: NodePos[]; labels: GroupLabel[]; hub: NodePos[] } {
  const nodes: NodePos[] = [];
  const labels: GroupLabel[] = [];
  const hub: NodePos[] = [];

  const step = 360 / RADIAL.length;

  RADIAL.forEach((g, gi) => {
    const base = -90 + gi * step;
    const members = AGENTS.filter((a) => a.group === g.key);

    // Two arcs keep six-agent pods from crowding into one another.
    const inner = members.slice(0, Math.ceil(members.length / 2));
    const outer = members.slice(Math.ceil(members.length / 2));

    const place = (list: Agent[], radius: number, ring: 1 | 2) => {
      list.forEach((agent, i) => {
        const t = list.length === 1 ? 0 : (i / (list.length - 1)) * 2 - 1;
        // The outer arc is offset half a step so nodes never line up radially.
        const offset = ring === 2 ? SPREAD / Math.max(list.length, 2) : 0;
        const { x, y } = polar(base + t * SPREAD + offset, radius);
        nodes.push({ agent, x, y, color: g.color, groupKey: g.key, ring });
      });
    };

    place(inner, RING_1, 1);
    place(outer, RING_2, 2);

    const lp = polar(base, LABEL_R);
    const cos = Math.cos((base * Math.PI) / 180);
    labels.push({
      key: g.key,
      th: g.th,
      en: g.en,
      x: lp.x,
      y: lp.y,
      color: g.color,
      anchor: Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end",
    });
  });

  const masters = AGENTS.filter((a) => a.group === "master");
  const masterColor = GROUPS.find((g) => g.key === "master")!.color;
  masters.forEach((agent, i) => {
    const { x, y } = polar(-90 + i * (360 / masters.length), HUB_R + 52);
    hub.push({ agent, x, y, color: masterColor, groupKey: "master", ring: 1 });
  });

  return { nodes, labels, hub };
}
