import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-60";

const buttonVariants = {
  primary:
    "bg-safety-500 text-white shadow-lg shadow-safety-500/25 hover:bg-safety-600 hover:shadow-safety-500/35 hover:-translate-y-0.5",
  brand:
    "bg-brand-800 text-white shadow-lg shadow-brand-900/25 hover:bg-brand-900 hover:-translate-y-0.5",
  outline:
    "border border-current/25 text-foreground hover:border-safety-500 hover:text-safety-500",
  ghostLight:
    "border border-white/30 text-white backdrop-blur-sm hover:border-white hover:bg-white/10",
} as const;

const buttonSizes = {
  sm: "px-4 py-2 text-[0.8rem]",
  md: "px-5 py-2.5",
  lg: "px-7 py-3.5 text-base",
} as const;

type ButtonStyleProps = {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
};

export function buttonClass({ variant = "primary", size = "md" }: ButtonStyleProps = {}) {
  return cx(buttonBase, buttonVariants[variant], buttonSizes[size]);
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps) {
  return <Link className={cx(buttonClass({ variant, size }), className)} {...props} />;
}

/* ------------------------------------------------------------------ */

export function Section({
  children,
  className,
  tone = "base",
  id,
}: {
  children: ReactNode;
  className?: string;
  tone?: "base" | "surface" | "brand";
  id?: string;
}) {
  const tones = {
    base: "bg-background",
    surface: "bg-surface",
    brand: "bg-brand-950 text-white",
  };
  return (
    <section id={id} className={cx("py-16 sm:py-20 lg:py-24", tones[tone], className)}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  tone = "dark",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: string;
  align?: "center" | "left";
  tone?: "dark" | "light";
}) {
  return (
    <div
      className={cx(
        "max-w-3xl",
        align === "center" ? "mx-auto text-center" : "text-left",
      )}
    >
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2
        className={cx(
          "font-display mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]",
          tone === "light" ? "text-white" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {lead ? (
        <p
          className={cx(
            "mt-4 text-base leading-relaxed text-pretty sm:text-lg",
            tone === "light" ? "text-white/70" : "text-muted",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}

/** Thin accent rule used to break up dark sections. */
export function Rule({ className }: { className?: string }) {
  return (
    <div
      className={cx(
        "h-px w-full bg-gradient-to-r from-transparent via-safety-500/50 to-transparent",
        className,
      )}
    />
  );
}
