import type { Testimonial } from "@/lib/types";
import { Quote } from "./icons";

/**
 * Scroll-snap rail. Native momentum scrolling on touch, drag/scroll on desktop —
 * no carousel library, no JS.
 */
export function TestimonialRail({ items }: { items: Testimonial[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ul className="flex snap-x snap-mandatory gap-5">
        {items.map((item) => (
          <li
            key={item.id}
            className="w-[min(22rem,82vw)] shrink-0 snap-start sm:w-[24rem]"
          >
            <figure className="flex h-full flex-col rounded-2xl border border-border bg-surface-raised p-6">
              <Quote className="size-7 text-safety-500/30" />
              <blockquote className="mt-4 flex-1 text-base leading-relaxed text-pretty text-foreground">
                {item.quote}
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                <span className="flex size-10 items-center justify-center rounded-full bg-brand-800 text-sm font-semibold text-white">
                  {item.name.charAt(0)}
                </span>
                <span className="text-sm font-semibold text-foreground">{item.name}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
