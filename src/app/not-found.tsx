import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <section className="shell flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <p className="eyebrow">404</p>
      <h1 className="font-display mt-3 text-4xl font-semibold text-foreground sm:text-5xl">We couldn&apos;t find that page</h1>
      <p className="mt-4 max-w-lg text-muted">
        The page may have moved or no longer exists. Try our products or surveys, or get in touch and we&apos;ll point
        you to the right place.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/products" className={buttonClass()}>
          Browse products
        </Link>
        <Link href="/contact" className={buttonClass({ variant: "outline" })}>
          Contact us
        </Link>
      </div>
    </section>
  );
}
