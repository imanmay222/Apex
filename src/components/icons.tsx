import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ---- navigation / ui ---- */

export const Menu = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Base>
);

export const Close = (p: IconProps) => (
  <Base {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Base>
);

export const ArrowRight = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Base>
);

export const ArrowLeft = (p: IconProps) => (
  <Base {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </Base>
);

export const ChevronDown = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9 6 6 6-6" />
  </Base>
);

export const Check = (p: IconProps) => (
  <Base {...p}>
    <path d="m20 6-11 11-5-5" />
  </Base>
);

export const Search = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
);

export const ZoomIn = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
  </Base>
);

export const Download = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
  </Base>
);

export const Quote = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M9.5 5C6.46 5 4 7.46 4 10.5c0 2.9 2.2 5.2 5 5.47V17c0 1.1-.9 2-2 2v2c2.76 0 5-2.24 5-5v-5.5C12 7.46 9.54 5 9.5 5Zm10 0C16.46 5 14 7.46 14 10.5c0 2.9 2.2 5.2 5 5.47V17c0 1.1-.9 2-2 2v2c2.76 0 5-2.24 5-5v-5.5C22 7.46 19.54 5 19.5 5Z" />
  </svg>
);

/* ---- contact ---- */

export const Phone = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.6 3h-.9A2.7 2.7 0 0 0 3 5.7C3 14.7 9.3 21 18.3 21a2.7 2.7 0 0 0 2.7-2.7v-.9a1.2 1.2 0 0 0-.85-1.15l-3.4-1.02a1.2 1.2 0 0 0-1.26.4l-.85 1.03a12.3 12.3 0 0 1-5.03-5.03l1.03-.85a1.2 1.2 0 0 0 .4-1.26L9.75 6.15A1.2 1.2 0 0 0 8.6 5.3" />
  </Base>
);

export const Mail = (p: IconProps) => (
  <Base {...p}>
    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
    <path d="m3 7 8.13 5.42a1.6 1.6 0 0 0 1.74 0L21 7" />
  </Base>
);

export const MapPin = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 10.5c0 5.2-8 11-8 11s-8-5.8-8-11a8 8 0 1 1 16 0Z" />
    <circle cx="12" cy="10.5" r="2.75" />
  </Base>
);

export const Clock = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.2l3.2 1.9" />
  </Base>
);

/* ---- social ---- */

export const Facebook = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.45 2.89h-2.33v6.99A10 10 0 0 0 22 12Z" />
  </svg>
);

export const Instagram = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="3.8" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </Base>
);

export const WhatsApp = (p: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12.04 2C6.6 2 2.2 6.4 2.2 11.84c0 1.94.53 3.75 1.46 5.3L2 22l5-1.6a9.8 9.8 0 0 0 4.99 1.36h.01c5.43 0 9.84-4.4 9.84-9.84C21.84 6.4 17.47 2 12.04 2Zm0 17.92h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.07.98.99-2.99-.2-.31a8.05 8.05 0 0 1-1.24-4.31c0-4.5 3.66-8.16 8.17-8.16 2.18 0 4.23.85 5.77 2.4a8.11 8.11 0 0 1 2.39 5.77c0 4.5-3.67 8.16-8.17 8.16Zm4.48-6.11c-.25-.13-1.45-.71-1.68-.79-.22-.08-.39-.13-.55.13-.16.25-.63.79-.77.95-.14.16-.28.18-.53.06-.25-.13-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.71-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.44-.06-.13-.55-1.34-.76-1.83-.2-.48-.4-.42-.55-.43h-.47c-.16 0-.42.06-.64.31-.22.25-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.69 2.58 4.1 3.62.57.25 1.02.39 1.37.5.58.18 1.1.16 1.52.1.46-.07 1.45-.59 1.65-1.17.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.47-.29Z" />
  </svg>
);

/* ---- content icons ---- */

export const Wind = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 8h9.5a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M3 16h7.5a2.5 2.5 0 1 1-2.5 2.5" />
  </Base>
);

export const Gauge = (p: IconProps) => (
  <Base {...p}>
    <path d="M4.5 18a9 9 0 1 1 15 0" />
    <path d="m12 14 3.5-3.5" />
    <circle cx="12" cy="15" r="1.4" />
  </Base>
);

export const Lock = (p: IconProps) => (
  <Base {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Base>
);

export const Forklift = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="18" r="2.5" />
    <circle cx="14" cy="18" r="2.5" />
    <path d="M8.5 18h3M3 14V8h7l2.5 6M17 4v14M17 18h4" />
  </Base>
);

export const HeartPulse = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 20.5s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 8.2a4.4 4.4 0 0 1 7.5 2.7c0 5-7.5 9.6-7.5 9.6Z" />
    <path d="M4.8 12.5h3l1.4-2.4 2 4.2 1.5-2.8h6.4" />
  </Base>
);

export const Flame = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 2.5s5.5 4.4 5.5 9.3a5.5 5.5 0 1 1-11 0c0-1.9.8-3.3 1.7-4.5.3 1.2 1 2 1.9 2 1.2 0 1.6-1.6 1.2-3.3-.3-1.4-.3-2.6.7-3.5Z" />
  </Base>
);

export const ShieldCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21.5c4.5-1.7 7.5-5.4 7.5-10V5.8L12 2.5 4.5 5.8v5.7c0 4.6 3 8.3 7.5 10Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Base>
);

export const Droplets = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21a5 5 0 0 0 5-5c0-3.2-5-9-5-9s-5 5.8-5 9a5 5 0 0 0 5 5Z" />
    <path d="M6.5 8.5C5.6 7.1 5 5.9 5 5a2.5 2.5 0 1 1 5 0" />
  </Base>
);

export const Zap = (p: IconProps) => (
  <Base {...p}>
    <path d="M13.5 2 4 13.5h6.5L10 22l9.5-11.5H13l.5-8.5Z" />
  </Base>
);

export const HardHat = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.5 17a8.5 8.5 0 0 1 17 0" />
    <path d="M2.5 17h19v2.5h-19z" />
    <path d="M9.5 9.2V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5v3.7" />
  </Base>
);

export const Rocket = (p: IconProps) => (
  <Base {...p}>
    <path d="M13.5 3.5c3.5 0 7 3.5 7 7 0 4-4.5 8-8 9.5l-2-2 1-3-3.5-3.5-3 1-2-2C4.5 8 8.5 3.5 13.5 3.5Z" />
    <circle cx="14.5" cy="9.5" r="1.6" />
    <path d="M6.5 17.5 4 20" />
  </Base>
);

export const Award = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="9" r="6" />
    <path d="m8.5 14.5-1.5 7 5-2.5 5 2.5-1.5-7" />
  </Base>
);

export const Users = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.4a6.5 6.5 0 0 1 4 5.6" />
  </Base>
);

export const Building = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V21" />
    <path d="M14 10h4.5A1.5 1.5 0 0 1 20 11.5V21M2.5 21h19" />
    <path d="M7 8h4M7 12h4M7 16h4M17 14h1M17 17.5h1" />
  </Base>
);

export const BadgeCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 2.5 2.4 1.8 3-.2.9 2.9 2.5 1.7-1.2 2.8 1.2 2.8-2.5 1.7-.9 2.9-3-.2-2.4 1.8-2.4-1.8-3 .2-.9-2.9-2.5-1.7L4.4 11.5 3.2 8.7l2.5-1.7.9-2.9 3 .2Z" />
    <path d="m9.2 12 2 2 3.6-4" />
  </Base>
);

export const Rupee = (p: IconProps) => (
  <Base {...p}>
    <path d="M7 4h10M7 8.5h10M14.5 4c0 3.3-2.4 4.5-5 4.5H7l7.5 11.5" />
  </Base>
);

export const Truck = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 6.5h11v10h-11z" />
    <path d="M13.5 10h4l3 3v3.5h-7" />
    <circle cx="7" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Base>
);

export const Factory = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 21V11l6 3.5V11l6 3.5V7l7 4v10z" />
    <path d="M6 17.5h2M12 17.5h2M18 17.5h1" />
  </Base>
);

export const Wrench = (p: IconProps) => (
  <Base {...p}>
    <path d="M15.5 3.5a5.5 5.5 0 0 0-5 7.7L3.8 17.9a2 2 0 0 0 2.8 2.8l6.7-6.7a5.5 5.5 0 0 0 7-6.9l-3 3-2.8-2.8 3-3a5.5 5.5 0 0 0-2-.8Z" />
  </Base>
);

export const ClipboardCheck = (p: IconProps) => (
  <Base {...p}>
    <rect x="5" y="4.5" width="14" height="16.5" rx="2" />
    <path d="M9 4.5V3.8A1.8 1.8 0 0 1 10.8 2h2.4A1.8 1.8 0 0 1 15 3.8v.7" />
    <path d="m9.2 13 2 2 3.6-4" />
  </Base>
);

export const Sparkle = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9z" />
  </Base>
);

/** Registry so content files can reference icons by name. */
export const iconMap = {
  Wind,
  Gauge,
  Lock,
  Forklift,
  HeartPulse,
  Flame,
  ShieldCheck,
  Droplets,
  Zap,
  HardHat,
  Rocket,
  Award,
  Users,
  Building2: Building,
  BadgeCheck,
  IndianRupee: Rupee,
  Truck,
  Factory,
  Wrench,
  ClipboardCheck,
  Sparkle,
} as const;

export type IconName = keyof typeof iconMap;

export function Icon({ name, ...props }: { name: string } & IconProps) {
  const Cmp = iconMap[name as IconName] ?? Sparkle;
  return <Cmp {...props} />;
}
