/**
 * NEXORA AITOS mark — the N is three strokes: a teal left post, a deep-blue
 * right post, and the bright cyan diagonal laid over both.
 */
export function LogoMark({
  size = 34,
  glow = true,
}: {
  size?: number;
  glow?: boolean;
}) {
  const uid = `nx${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-label="NEXORA AITOS"
      style={glow ? { filter: "drop-shadow(0 0 6px rgba(0,212,255,0.45))" } : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-teal`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5ef2d0" />
          <stop offset="45%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0ea5c9" />
        </linearGradient>
        <linearGradient id={`${uid}-blue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3aa8ff" />
          <stop offset="55%" stopColor="#0b6fe8" />
          <stop offset="100%" stopColor="#0a4fbf" />
        </linearGradient>
        <linearGradient id={`${uid}-diag`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7ef7e4" />
          <stop offset="35%" stopColor="#22ddff" />
          <stop offset="100%" stopColor="#1287f5" />
        </linearGradient>
      </defs>

      <path
        d="M79 88 V16"
        stroke={`url(#${uid}-blue)`}
        strokeWidth="17"
        strokeLinecap="butt"
      />
      <path
        d="M21 90 V24"
        stroke={`url(#${uid}-teal)`}
        strokeWidth="17"
        strokeLinecap="butt"
      />
      <path
        d="M21 22 L79 86"
        stroke={`url(#${uid}-diag)`}
        strokeWidth="17"
        strokeLinecap="butt"
      />
      {/* Bevel highlight along the top-left edge of the diagonal */}
      <path
        d="M24 16 L82 80"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M13 24 V88"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/** Full lockup for the top bar: mark + NEXORA / AITOS + tagline. */
export function LogoLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 36} />
      <span className="min-w-0 leading-none">
        <span className="block bg-gradient-to-b from-white via-[#dbe9f5] to-[#8fa8bd] bg-clip-text text-[15px] font-extrabold tracking-[0.16em] text-transparent">
          NEXORA
        </span>
        <span className="mt-[3px] flex items-baseline gap-1">
          <span className="text-[10px] font-semibold tracking-[0.34em] text-brand">
            AITOS
          </span>
          <span className="text-[6px] text-brand/60">™</span>
        </span>
        {!compact && (
          <span className="mt-[3px] block text-[7px] tracking-[0.18em] text-dim">
            AI TRADING OPERATING SYSTEM
          </span>
        )}
      </span>
    </span>
  );
}
