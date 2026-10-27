import { cx } from "../ui";

/* Class helpers, kept out of the client module so server components can use them too. */

const BTN_VARIANTS = {
  primary: "bg-safety-500 text-white hover:bg-safety-600",
  brand: "bg-brand-800 text-white hover:bg-brand-900 dark:bg-brand-600 dark:hover:bg-brand-700",
  secondary: "border border-border bg-surface-raised text-foreground hover:border-brand-800/40 hover:bg-surface",
  ghost: "text-muted hover:bg-surface hover:text-foreground",
  danger: "bg-red-600 text-white hover:bg-red-700",
  dangerOutline: "border border-red-600/40 text-red-600 hover:bg-red-600/10 dark:text-red-400",
} as const;

export const BTN_SIZES = { xs: "h-7 px-2.5 text-xs", sm: "h-8 px-3 text-[0.8rem]", md: "h-10 px-4 text-sm" } as const;

export type BtnVariant = keyof typeof BTN_VARIANTS;
export type BtnSize = keyof typeof BTN_SIZES;

export function btn(variant: BtnVariant = "secondary", size: BtnSize = "md") {
  return cx(
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    BTN_VARIANTS[variant],
    BTN_SIZES[size],
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted/60 focus:border-brand-800 focus:ring-2 focus:ring-brand-800/20 focus:outline-none disabled:opacity-60 dark:focus:border-brand-400";

/** For selects and inputs that sit inline in a toolbar and size to their content. */
export const inlineInputClass = inputClass.replace("w-full ", "");
