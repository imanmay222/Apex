import { revalidateTag, unstable_cache } from "next/cache";
import { logger } from "./logger";

/** Cache tags, one per content collection. Admin writes invalidate the matching tag. */
export const TAGS = {
  products: "products",
  groups: "product-groups",
  surveys: "surveys",
  training: "training",
  gallery: "gallery",
  testimonials: "testimonials",
  logos: "logos",
  leaders: "leaders",
  settings: "settings",
} as const;

export type Tag = (typeof TAGS)[keyof typeof TAGS];

/**
 * Wraps a data read in Next's data cache, tagged for on-demand invalidation. Every cached
 * read is also time-boxed so a missed invalidation (e.g. a second instance) self-heals.
 */
export function cached<A extends unknown[], R>(
  name: string,
  tags: Tag[],
  fn: (...args: A) => Promise<R>,
  revalidateSeconds = 300,
): (...args: A) => Promise<R> {
  return unstable_cache(fn, [name], { tags, revalidate: revalidateSeconds });
}

/** Expire cached reads immediately. Safe to call outside a Next request (scripts/tests): no-ops. */
export function invalidate(...tags: Tag[]): void {
  for (const tag of new Set(tags)) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch (error) {
      logger.debug("cache invalidation skipped (outside Next runtime)", { tag, error: String(error) });
    }
  }
}
