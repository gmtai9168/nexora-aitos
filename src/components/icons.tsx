import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconGrid = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </Svg>
);

export const IconCoins = (p: IconProps) => (
  <Svg {...p}>
    <ellipse cx="9" cy="6.5" rx="6" ry="3" />
    <path d="M3 6.5v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
    <path d="M15 11.2c3 .3 6 1.5 6 3.3v3c0 1.7-2.7 3-6 3s-6-1.3-6-3v-2" />
  </Svg>
);

export const IconBot = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="8" width="16" height="12" rx="3" />
    <path d="M12 8V4" />
    <circle cx="12" cy="3" r="1.4" />
    <path d="M9 13.5h.01M15 13.5h.01M9.5 17h5" />
  </Svg>
);

export const IconPulse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12h4l2.5-7 4 14 2.5-7h7" />
  </Svg>
);

export const IconPie = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3a9 9 0 1 0 9 9h-9V3Z" />
    <path d="M15 3.5A9 9 0 0 1 20.5 9H15V3.5Z" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3 5 6v6c0 4.4 3 7.8 7 9 4-1.2 7-4.6 7-9V6l-7-3Z" />
    <path d="M12 8v4.5M12 15.5h.01" />
  </Svg>
);

export const IconTarget = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </Svg>
);

export const IconFlask = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9.5 3v6L4.6 17.4A2 2 0 0 0 6.3 20.5h11.4a2 2 0 0 0 1.7-3.1L14.5 9V3" />
    <path d="M8.5 3h7M7 14.5h10" />
  </Svg>
);

export const IconHistory = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3.5 4.5V9H8" />
    <path d="M12 7.5V12l3 1.8" />
  </Svg>
);

export const IconBell = (p: IconProps) => (
  <Svg {...p}>
    <path d="M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5Z" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </Svg>
);

export const IconGear = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 14H3.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.6V3.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.1a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.2.8Z" />
  </Svg>
);

export const IconPower = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v9" />
    <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  </Svg>
);

export const IconExpand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
  </Svg>
);

export const IconMaximize = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
  </Svg>
);

export const IconWifi = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 8.5a15 15 0 0 1 19 0" />
    <path d="M5.5 12a11 11 0 0 1 13 0" />
    <path d="M8.5 15.5a6.5 6.5 0 0 1 7 0" />
    <circle cx="12" cy="19" r="1" fill="currentColor" />
  </Svg>
);

export const IconChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconDots = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </Svg>
);

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12 2.5 2.5 4.5-5" />
  </Svg>
);

export const IconStar = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3.5 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17.3 6.7 20.1l1.1-6L3.4 9.9l6-.8L12 3.5Z" />
  </Svg>
);

export const IconCrosshair = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </Svg>
);

export const IconLayers = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);

export const IconClock = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const IconRefresh = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 11a8.5 8.5 0 0 0-14.9-4.4M3.5 13a8.5 8.5 0 0 0 14.9 4.4" />
    <path d="M20.5 5.5V11h-5.5M3.5 18.5V13H9" />
  </Svg>
);

export const IconLogo = ({ size = 28, ...rest }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    aria-hidden="true"
    {...rest}
  >
    <path
      d="M20 2 36 11v18L20 38 4 29V11L20 2Z"
      stroke="#16e0a0"
      strokeWidth="1.6"
      opacity="0.55"
    />
    <path
      d="M12 26.5 17 18l4 5 3.5-7L29 22"
      stroke="#16e0a0"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="29" cy="22" r="2.2" fill="#16e0a0" />
  </svg>
);

export const IconMenu = (p: IconProps) => (
  <Svg {...p}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </Svg>
);

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </Svg>
);
