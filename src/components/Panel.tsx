import type { ReactNode } from "react";

export function Panel({
  title,
  titleEn,
  right,
  children,
  className = "",
  bodyClassName = "p-3",
}: {
  title: string;
  titleEn?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`panel flex min-w-0 flex-col ${className}`}>
      <div className="panel-head">
        <h2 className="flex items-baseline gap-1.5 truncate text-[12.5px] font-semibold text-txt">
          {title}
          {titleEn && (
            <span className="text-[10.5px] font-normal text-dim">({titleEn})</span>
          )}
        </h2>
        {right}
      </div>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "up" | "down" | "neutral" | "warn";
  children: ReactNode;
}) {
  const cls = {
    up: "bg-[#0d2b23] text-up border-[#1c5a47]",
    down: "bg-[#2c1119] text-down border-[#5c2130]",
    warn: "bg-[#2d2310] text-warn border-[#5e4a17]",
    neutral: "bg-[#111e28] text-muted border-line",
  }[tone];
  return (
    <span
      className={`inline-block rounded border px-1.5 py-[1px] text-[9.5px] font-semibold tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  labelEn,
  value,
  sub,
  tone,
}: {
  label: string;
  labelEn?: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "up" | "down" | "neutral";
}) {
  const color =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-txt";
  return (
    <div className="min-w-0">
      <div className="truncate text-[10.5px] text-muted">
        {label}
        {labelEn && <span className="ml-1 text-dim">{labelEn}</span>}
      </div>
      <div className={`num truncate text-[14px] font-semibold ${color}`}>{value}</div>
      {sub && <div className="num truncate text-[10px] text-dim">{sub}</div>}
    </div>
  );
}
