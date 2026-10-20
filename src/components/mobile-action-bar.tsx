import Link from "next/link";
import { getSiteSettings } from "@/server/data/public";
import { MapPin, Phone, Search, WhatsApp } from "./icons";

/** Fixed quick-actions bar on small screens. Clicks are counted via `data-track`. */
export async function MobileActionBar() {
  const site = await getSiteSettings();

  const actions = [
    { href: `tel:${site.phones[0]?.replace(/\s/g, "") ?? ""}`, label: "Call", track: "call", icon: <Phone className="size-5" />, external: false },
    { href: site.social.whatsapp, label: "WhatsApp", track: "whatsapp", icon: <WhatsApp className="size-5" />, external: true },
    { href: "/products", label: "Products", track: "products", icon: <Search className="size-5" />, external: false },
    { href: site.mapsLink, label: "Locate", track: "map", icon: <MapPin className="size-5" />, external: true },
  ];

  const itemClass =
    "flex flex-col items-center gap-1 py-3 text-[0.7rem] font-medium text-muted transition-colors active:text-safety-500";

  return (
    <>
      {/* Spacer so the bar never covers page content */}
      <div className="h-[4.5rem] lg:hidden" aria-hidden="true" />

      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {actions.map((action) => (
            <li key={action.label}>
              {action.external ? (
                <a href={action.href} target="_blank" rel="noopener noreferrer" data-track={action.track} className={itemClass}>
                  {action.icon}
                  {action.label}
                </a>
              ) : (
                <Link href={action.href} data-track={action.track} className={itemClass}>
                  {action.icon}
                  {action.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
