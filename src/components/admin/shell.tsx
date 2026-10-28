"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode, type SVGProps } from "react";
import type { AdminViewer } from "@/server/auth/current";
import type { Permission } from "@/server/auth/permissions";
import { cx } from "../ui";
import { Close, Menu, Mail } from "../icons";
import { adminRequest } from "./api";
import { ROLE_LABELS } from "./format";
import { BarChart, Database, ExternalLink, History, ImageIcon, Inbox, LayoutGrid, LogOut, MessageSquare, Package, Settings, User, UserCog } from "./icons";
import { ShoppingBag } from "../icons";
import { Count, ToastProvider } from "./ui";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  permission?: Permission;
  badge?: "newEnquiries" | "newOrders" | "pendingReviews";
  exact?: boolean;
};

const NAV: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutGrid, exact: true },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag, permission: "orders:read", badge: "newOrders" },
      { href: "/admin/enquiries", label: "Enquiries", icon: Inbox, permission: "enquiries:read", badge: "newEnquiries" },
    ],
  },
  {
    heading: "Website",
    items: [
      { href: "/admin/content", label: "Content", icon: Package, permission: "content:write" },
      { href: "/admin/content/testimonials?view=pending", label: "Reviews", icon: MessageSquare, permission: "content:write", badge: "pendingReviews" },
      { href: "/admin/media", label: "Media library", icon: ImageIcon, permission: "media:write" },
      { href: "/admin/settings", label: "Site settings", icon: Settings, permission: "settings:write" },
    ],
  },
  {
    heading: "Insights",
    items: [
      { href: "/admin/analytics", label: "Analytics", icon: BarChart, permission: "analytics:read" },
      { href: "/admin/subscribers", label: "Subscribers", icon: Mail, permission: "subscribers:read" },
    ],
  },
  {
    heading: "Administration",
    items: [
      { href: "/admin/users", label: "Users", icon: UserCog, permission: "users:manage" },
      { href: "/admin/audit", label: "Audit log", icon: History, permission: "audit:read" },
      { href: "/admin/system", label: "Backup & system", icon: Database, permission: "system:manage" },
    ],
  },
];

type Badges = { newEnquiries?: number; newOrders?: number; pendingReviews?: number };

/** Live counts for the sidebar, refreshed on every navigation. */
function useBadges(viewer: AdminViewer, pathname: string): Badges {
  const [badges, setBadges] = useState<Badges>({});
  useEffect(() => {
    const controller = new AbortController();
    const total = (path: string) =>
      adminRequest<unknown[]>(path, { signal: controller.signal }).then((r) => Number(r.meta?.total ?? 0)).catch(() => undefined);
    Promise.all([
      viewer.permissions.includes("enquiries:read") ? total("/api/admin/enquiries?status=new&limit=1") : undefined,
      viewer.permissions.includes("orders:read") ? total("/api/admin/orders?status=new&limit=1") : undefined,
      viewer.permissions.includes("content:write") ? total("/api/admin/content/testimonials?source=public&published=false&limit=1") : undefined,
    ]).then(([newEnquiries, newOrders, pendingReviews]) => {
      if (!controller.signal.aborted) setBadges({ newEnquiries, newOrders, pendingReviews });
    });
    return () => controller.abort();
  }, [viewer, pathname]);
  return badges;
}

export function AdminShell({ viewer, companyName, children }: { viewer: AdminViewer; companyName: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const badges = useBadges(viewer, pathname);


  const sidebar = (
    <Sidebar viewer={viewer} pathname={pathname} badges={badges} companyName={companyName} onClose={open ? () => setOpen(false) : undefined} />
  );

  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-surface">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-r border-border bg-background lg:block print:hidden">{sidebar}</aside>

        {/* Mobile drawer */}
        <div className={cx("fixed inset-0 z-50 lg:hidden", open ? "pointer-events-auto" : "pointer-events-none")} aria-hidden={!open}>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className={cx("absolute inset-0 bg-brand-950/60 transition-opacity", open ? "opacity-100" : "opacity-0")}
          />
          <div className={cx("absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-background shadow-2xl transition-transform", open ? "translate-x-0" : "-translate-x-full")}>
            {sidebar}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur lg:hidden print:hidden">
            <button type="button" onClick={() => setOpen(true)} className="inline-flex size-9 items-center justify-center rounded-lg border border-border" aria-label="Open menu" aria-expanded={open}>
              <Menu className="size-5" />
            </button>
            <span className="font-display text-sm font-semibold">Apex Admin</span>
            <Link href="/admin/account" className="inline-flex size-9 items-center justify-center rounded-lg border border-border" aria-label="My account">
              <User className="size-4" />
            </Link>
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Sidebar({
  viewer,
  pathname,
  badges,
  companyName,
  onClose,
}: {
  viewer: AdminViewer;
  pathname: string;
  badges: Badges;
  companyName: string;
  onClose?: () => void;
}) {
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (item: NavItem) => {
    const base = item.href.split("?")[0];
    if (item.badge === "pendingReviews") return false;
    return item.exact ? pathname === base : pathname === base || pathname.startsWith(`${base}/`);
  };

  async function signOut() {
    setSigningOut(true);
    await adminRequest("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/admin/login");
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between gap-2 border-b border-border px-5">
        <Link href="/admin" className="flex items-center gap-2.5" aria-label={`${companyName} admin`}>
          <Image src="/media/favicon-bg.png" alt="" width={28} height={28} className="size-7 rounded" />
          <span className="leading-tight">
            <span className="font-display block text-sm font-semibold text-foreground">Apex Care</span>
            <span className="block text-[0.7rem] text-muted">Admin panel</span>
          </span>
        </Link>
        {onClose ? (
          <button type="button" onClick={onClose} className="inline-flex size-8 items-center justify-center rounded-lg border border-border" aria-label="Close menu">
            <Close className="size-4" />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
        {NAV.map((group, index) => {
          const items = group.items.filter((item) => !item.permission || viewer.permissions.includes(item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.heading ?? index} className="mb-4">
              {group.heading ? <p className="mb-1 px-3 text-[0.68rem] font-semibold tracking-wider text-muted uppercase">{group.heading}</p> : null}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isActive(item);
                  const count = item.badge ? badges[item.badge] : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={onClose}
                        className={cx(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active ? "bg-brand-800/10 text-brand-800 dark:bg-brand-400/15 dark:text-brand-300" : "text-muted hover:bg-surface hover:text-foreground",
                        )}
                      >
                        <item.icon className="size-4.5 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {count ? <Count value={count} tone="accent" /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="space-y-1 border-t border-border p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground">
          <ExternalLink className="size-4" /> View website
        </a>
        <Link
          href="/admin/account"
          onClick={onClose}
          className={cx(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface",
            pathname === "/admin/account" ? "bg-brand-800/10 text-brand-800 dark:text-brand-300" : "text-foreground",
          )}
        >
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-800 text-xs font-semibold text-white uppercase">
            {viewer.name.trim().charAt(0) || "?"}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-medium">{viewer.name}</span>
            <span className="block truncate text-xs text-muted">{ROLE_LABELS[viewer.role] ?? viewer.role}</span>
          </span>
        </Link>
        <button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface hover:text-foreground disabled:opacity-60">
          <LogOut className="size-4" /> {signingOut ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}
