"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BasketButton } from "./quote/basket-link";
import { SearchDialog } from "./search-dialog";
import { ArrowRight, Close, Menu, Phone } from "./icons";
import { buttonClass, cx } from "./ui";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/products", label: "Products" },
  { href: "/survey", label: "Surveys" },
  { href: "/training", label: "Training & Demos" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ companyName, phone }: { companyName: string; phone: string }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className={cx(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-background/85 backdrop-blur-xl"
          : "bg-background",
      )}
    >
      <div className="shell shell-wide flex h-16 items-center justify-between gap-4 lg:h-20">
        <Link href="/" className="flex shrink-0 items-center" aria-label={companyName}>
          <Image
            src="/media/navbrand.png"
            alt={companyName}
            width={190}
            height={48}
            priority
            className="h-9 w-auto lg:h-11 dark:brightness-0 dark:invert"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "relative rounded-full px-4 py-2 text-sm font-medium transition-colors",
                isActive(item.href)
                  ? "text-safety-500"
                  : "text-muted hover:text-foreground",
              )}
            >
              {item.label}
              {isActive(item.href) ? (
                <span className="absolute inset-x-4 -bottom-0.5 h-0.5 rounded-full bg-safety-500" />
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <SearchDialog />
          <BasketButton />
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            <Phone className="size-4" />
            {phone}
          </a>
          <Link href="/contact" className={buttonClass({ size: "sm" })}>
            Get a quote
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
        <SearchDialog />
        <BasketButton />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-foreground"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={cx(
          "fixed inset-0 z-50 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className={cx(
            "absolute inset-0 bg-brand-950/60 backdrop-blur-sm transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cx(
            "absolute inset-y-0 right-0 flex w-[min(20rem,85vw)] flex-col bg-background shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <Image
              src="/media/navbrand.png"
              alt={companyName}
              width={150}
              height={40}
              className="h-8 w-auto dark:brightness-0 dark:invert"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex size-9 items-center justify-center rounded-full border border-border"
              aria-label="Close menu"
            >
              <Close className="size-5" />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cx(
                  "rounded-xl px-4 py-3 text-base font-medium transition-colors",
                  isActive(item.href)
                    ? "bg-safety-500/10 text-safety-500"
                    : "text-foreground hover:bg-surface",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="space-y-3 border-t border-border p-4">
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="flex items-center gap-2 px-1 text-sm font-medium text-muted"
            >
              <Phone className="size-4" />
              {phone}
            </a>
            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className={cx(buttonClass(), "w-full")}
            >
              Get a quote
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
