"use client";

/** Filled sparkline used by the equity curve and the per-bot mini charts. */
export function Sparkline({
  values,
  height = 40,
  stroke = "#14e2a0",
  fill = true,
  className = "",
}: {
  values: number[];
  height?: number;
  stroke?: string;
  fill?: boolean;
  className?: string;
}) {
  if (values.length < 2) {
    return <div className={className} style={{ height }} />;
  }

  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = height - ((v - min) / span) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const id = `sp-${stroke.replace("#", "")}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ height, width: "100%" }}
      aria-hidden="true"
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon
            points={`0,${height} ${pts.join(" ")} ${w},${height}`}
            fill={`url(#${id})`}
          />
        </>
      )}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth="1.4"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Half-circle gauge with a green→amber→red band, as in the Risk Engine card. */
export function ArcGauge({
  value,
  max = 100,
  size = 150,
  label,
  sub,
}: {
  value: number;
  max?: number;
  size?: number;
  label: string;
  sub?: string;
}) {
  const r = 56;
  const cx = 70;
  const cy = 70;
  const pct = Math.max(0, Math.min(1, value / max));

  const point = (t: number) => {
    const a = Math.PI * (1 - t);
    return [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number) => {
    const [x1, y1] = point(from);
    const [x2, y2] = point(to);
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const [nx, ny] = point(pct);
  const tone = pct < 0.34 ? "#14e2a0" : pct < 0.67 ? "#ffb020" : "#ff4a68";

  return (
    <svg
      viewBox="0 0 140 88"
      style={{ width: size, maxWidth: "100%" }}
      aria-label={`${label} ${value.toFixed(2)}`}
    >
      <path d={arc(0, 0.34)} stroke="#14e2a0" strokeWidth="9" fill="none" strokeLinecap="round" />
      <path d={arc(0.35, 0.66)} stroke="#ffb020" strokeWidth="9" fill="none" />
      <path d={arc(0.67, 1)} stroke="#ff4a68" strokeWidth="9" fill="none" strokeLinecap="round" />
      <line
        x1={cx}
        y1={cy}
        x2={nx}
        y2={ny}
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r="3.5" fill={tone} />
      <text
        x={cx}
        y={cy - 14}
        textAnchor="middle"
        fill="#d5e2ee"
        fontSize="15"
        fontWeight="700"
      >
        {label}
      </text>
      {sub && (
        <text x={cx} y={cy + 15} textAnchor="middle" fill="#6b8497" fontSize="8.5">
          {sub}
        </text>
      )}
    </svg>
  );
}

/** Full ring used for AI Signal Quality. */
export function RingGauge({
  value,
  size = 120,
  label,
  sub,
  color = "#14e2a0",
}: {
  value: number;
  size?: number;
  label: string;
  sub?: string;
  color?: string;
}) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;

  return (
    <svg viewBox="0 0 100 100" style={{ width: size, maxWidth: "100%" }} aria-label={label}>
      <circle cx="50" cy="50" r={r} stroke="#16242f" strokeWidth="7" fill="none" />
      <circle
        cx="50"
        cy="50"
        r={r}
        stroke={color}
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${(c * pct).toFixed(2)} ${c.toFixed(2)}`}
        transform="rotate(-90 50 50)"
        style={{ filter: `drop-shadow(0 0 5px ${color}66)` }}
      />
      <text
        x="50"
        y="49"
        textAnchor="middle"
        fill={color}
        fontSize="20"
        fontWeight="700"
      >
        {label}
      </text>
      {sub && (
        <text x="50" y="63" textAnchor="middle" fill="#6b8497" fontSize="7.5">
          {sub}
        </text>
      )}
    </svg>
  );
}

export type DonutSlice = { label: string; value: number; color: string };

export function Donut({
  slices,
  size = 128,
  thickness = 16,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
}) {
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = 50 - thickness / 2;
  const c = 2 * Math.PI * r;

  // Arc lengths and their running start offsets, resolved before rendering.
  const arcs = slices.reduce<{ slice: DonutSlice; len: number; offset: number }[]>(
    (acc, slice) => {
      const prev = acc.at(-1);
      const offset = prev ? prev.offset + prev.len : 0;
      acc.push({ slice, len: (slice.value / total) * c, offset });
      return acc;
    },
    [],
  );

  return (
    <svg viewBox="0 0 100 100" style={{ width: size, maxWidth: "100%" }} aria-hidden="true">
      {arcs.map(({ slice, len, offset }) => (
        <circle
          key={slice.label}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={slice.color}
          strokeWidth={thickness}
          strokeDasharray={`${len.toFixed(2)} ${(c - len).toFixed(2)}`}
          strokeDashoffset={-offset}
          transform="rotate(-90 50 50)"
        />
      ))}
    </svg>
  );
}
