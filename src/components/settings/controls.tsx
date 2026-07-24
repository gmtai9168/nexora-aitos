"use client";

import type { ReactNode } from "react";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-[3px] flex items-baseline justify-between gap-1">
        <span className="truncate text-[10px] text-muted">{label}</span>
        {hint && <span className="num shrink-0 text-[8.5px] text-dim">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const INPUT =
  "w-full rounded border border-line bg-[#0a121a] px-2 py-[6px] text-[11px] text-txt outline-none focus:border-brand/60 disabled:opacity-40";

export function Text({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      className={INPUT}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function Num({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        className={`num ${INPUT}`}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(min, max === undefined ? v : Math.min(max, v)));
        }}
      />
      {unit && <span className="shrink-0 text-[9.5px] text-dim">{unit}</span>}
    </span>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      className={INPUT}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as T)}
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({
  on,
  onChange,
  label,
  hint,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-[5px]">
      <span className="min-w-0">
        <span className="block truncate text-[11px] text-txt">{label}</span>
        {hint && <span className="block truncate text-[9px] text-dim">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className={`relative h-[19px] w-[36px] shrink-0 rounded-full transition-colors ${
          on ? "bg-brand" : "bg-[#1d2f3c]"
        }`}
      >
        <span
          className={`absolute top-[2px] h-[15px] w-[15px] rounded-full bg-white transition-[left] ${
            on ? "left-[19px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

export function Seg<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <div className="flex overflow-hidden rounded border border-line">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`flex-1 px-1.5 py-[6px] text-[10px] transition-colors ${
            value === o.id
              ? "bg-brand text-black font-semibold"
              : "bg-[#0a121a] text-muted hover:text-txt"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  title,
  titleEn,
  children,
  right,
}: {
  title: string;
  titleEn?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3 py-2">
        <h3 className="flex items-baseline gap-1.5 text-[12px] font-semibold text-txt">
          {title}
          {titleEn && <span className="text-[9.5px] font-normal text-dim">{titleEn}</span>}
        </h3>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <p
      className={`rounded border px-2 py-1.5 text-[9.5px] leading-snug ${
        tone === "warn"
          ? "border-warn/30 bg-[#20180a] text-warn"
          : "border-line-soft bg-[#081017] text-dim"
      }`}
    >
      {children}
    </p>
  );
}
