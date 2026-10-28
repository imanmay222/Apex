"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "../ui";
import { Close } from "../icons";
import { Alert, ChevronLeft, ChevronRight } from "./icons";
import { capitalize, ENQUIRY_STATUS_LABELS, ORDER_STATUS_LABELS } from "./format";
import { btn, inputClass, type BtnSize, type BtnVariant } from "./styles";

export { btn, inputClass, type BtnVariant };

/* ------------------------------------------------------------------ */
/* Buttons & form controls                                             */
/* ------------------------------------------------------------------ */

export function Button({
  variant = "secondary",
  size = "md",
  busy,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; busy?: boolean }) {
  return (
    <button type={type} className={cx(btn(variant, size), className)} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>
      {busy ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required ? <span aria-hidden className="text-safety-500"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className={cx("inline-flex cursor-pointer items-center gap-2.5 text-sm", disabled && "cursor-not-allowed opacity-60")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-emerald-600" : "bg-border")}
      >
        <span className={cx("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", checked && "translate-x-4")} />
      </button>
      <span className="text-foreground">{label}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back}
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, actions, children, className, padded = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cx("rounded-xl border border-border bg-surface-raised", className)}>
      {title || actions ? (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          {title ? <h2 className="text-sm font-semibold text-foreground">{title}</h2> : <span />}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={padded ? "p-5" : undefined}>{children}</div>
    </section>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cx("inline-block size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent", className)} />;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorNotice({ error, onRetry }: { error: { message: string } | string; onRetry?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-600/30 bg-red-600/5 px-4 py-3 text-sm text-red-700 dark:text-red-300" role="alert">
      <Alert className="size-4 shrink-0" />
      <span className="flex-1">{typeof error === "string" ? error : error.message}</span>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-14 text-center">
      <p className="font-medium text-foreground">{title}</p>
      {children ? <div className="mt-1 text-sm text-muted">{children}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

const TONES = {
  gray: "bg-slate-500/10 text-slate-700 ring-slate-500/20 dark:text-slate-300",
  blue: "bg-brand-500/10 text-brand-800 ring-brand-500/25 dark:text-brand-300",
  orange: "bg-safety-500/10 text-safety-700 ring-safety-500/25 dark:text-safety-300",
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-800 ring-amber-500/25 dark:text-amber-300",
  red: "bg-red-500/10 text-red-700 ring-red-500/25 dark:text-red-300",
  violet: "bg-violet-500/10 text-violet-700 ring-violet-500/25 dark:text-violet-300",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", TONES[tone], className)}>{children}</span>;
}

const STATUS_TONES: Record<string, Tone> = {
  new: "orange",
  contacted: "blue",
  quoted: "violet",
  won: "green",
  lost: "gray",
  spam: "red",
  archived: "gray",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{ENQUIRY_STATUS_LABELS[status] ?? capitalize(status)}</Badge>;
}

const ORDER_STATUS_TONES: Record<string, Tone> = {
  new: "orange",
  quoted: "violet",
  confirmed: "blue",
  dispatched: "amber",
  delivered: "green",
  cancelled: "gray",
  spam: "red",
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_STATUS_TONES[status] ?? "gray"}>{ORDER_STATUS_LABELS[status] ?? capitalize(status)}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  if (priority === "normal") return null;
  return <Badge tone={priority === "high" ? "red" : "gray"}>{priority === "high" ? "High priority" : "Low priority"}</Badge>;
}

const DELIVERY_TONES: Record<string, Tone> = { sent: "green", failed: "red", pending: "amber", skipped: "gray" };

export function DeliveryBadge({ status }: { status: string }) {
  return <Badge tone={DELIVERY_TONES[status] ?? "gray"}>{capitalize(status)}</Badge>;
}

/* ------------------------------------------------------------------ */
/* Confirm-in-place: the first click arms, the second acts             */
/* ------------------------------------------------------------------ */

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Yes, delete",
  prompt = "Are you sure?",
  variant = "dangerOutline",
  size = "sm",
  disabled,
  className,
}: {
  onConfirm: () => Promise<unknown> | void;
  children: ReactNode;
  confirmLabel?: string;
  prompt?: string;
  variant?: BtnVariant;
  size?: BtnSize;
  disabled?: boolean;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 6000);
    return () => clearTimeout(timer);
  }, [armed]);

  if (!armed) {
    return (
      <Button variant={variant} size={size} disabled={disabled} className={className} onClick={() => setArmed(true)}>
        {children}
      </Button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted">{prompt}</span>
      <Button
        variant="danger"
        size={size}
        busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setArmed(false);
          }
        }}
      >
        {confirmLabel}
      </Button>
      <Button variant="ghost" size={size} onClick={() => setArmed(false)} disabled={busy}>
        Cancel
      </Button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Pagination                                                          */
/* ------------------------------------------------------------------ */

const singular = (noun: string) => (noun.endsWith("ies") ? `${noun.slice(0, -3)}y` : noun.replace(/s$/, ""));

export function Pagination({ page, totalPages, total, onPage, noun = "items" }: { page: number; totalPages: number; total: number; onPage: (page: number) => void; noun?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted">
      <span>
        {total.toLocaleString("en-IN")} {total === 1 ? singular(noun) : noun}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </span>
      {totalPages > 1 ? (
        <div className="flex gap-1.5">
          <Button size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <button type="button" aria-label="Close dialog" tabIndex={-1} className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cx("relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-border bg-surface-raised shadow-2xl outline-none sm:rounded-2xl", wide ? "sm:max-w-4xl" : "sm:max-w-lg")}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className={btn("ghost", "sm")} aria-label="Close">
            <Close className="size-4" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

type Toast = { id: number; message: string; tone: "success" | "error" };
const ToastContext = createContext<(message: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = ++counter.current;
    setToasts((list) => [...list.slice(-3), { id, message, tone }]);
    setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === "error" ? 7000 : 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2 px-4 sm:items-end sm:pr-6" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto max-w-sm rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg",
              toast.tone === "error" ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700",
            )}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ------------------------------------------------------------------ */
/* Tabs (filter chips)                                                 */
/* ------------------------------------------------------------------ */

export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: { value: T; label: ReactNode }[] }) {
  return (
    <div className="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === option.value ? "bg-brand-800 text-white dark:bg-brand-600" : "text-muted hover:bg-surface hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Small count pill used inside tabs and nav items. */
export function Count({ value, tone = "muted" }: { value: number | undefined; tone?: "muted" | "accent" }) {
  if (value === undefined) return null;
  return (
    <span className={cx("rounded-full px-1.5 py-px text-[0.7rem] font-semibold tabular-nums", tone === "accent" ? "bg-safety-500 text-white" : "bg-current/10")}>
      {value > 999 ? "999+" : value}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Row selection that clears itself when the listing changes           */
/* ------------------------------------------------------------------ */

const NONE: ReadonlySet<string> = new Set();

export function useSelection(listKey: string) {
  const [state, setState] = useState<{ key: string; ids: ReadonlySet<string> }>({ key: listKey, ids: NONE });
  const selected = state.key === listKey ? state.ids : NONE;

  const update = useCallback(
    (next: ReadonlySet<string> | ((previous: ReadonlySet<string>) => ReadonlySet<string>)) =>
      setState((s) => {
        const current = s.key === listKey ? s.ids : NONE;
        return { key: listKey, ids: typeof next === "function" ? next(current) : next };
      }),
    [listKey],
  );

  const toggle = useCallback(
    (id: string) =>
      update((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [update],
  );

  return { selected, setSelected: update, toggle, clear: () => update(NONE) };
}
