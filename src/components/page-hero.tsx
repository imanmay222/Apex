import Image from "next/image";
import Link from "next/link";
import { ChevronDown } from "./icons";

type Crumb = { label: string; href?: string };

export function PageHero({
  eyebrow,
  title,
  lead,
  image,
  crumbs = [],
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  image?: { src: string; alt: string };
  crumbs?: Crumb[];
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-950">
      {image ? (
        <Image
          src={image.src}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-30"
        />
      ) : null}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-br from-brand-950 via-brand-950/90 to-brand-900/70"
      />
      <div
        aria-hidden
        className="absolute -top-24 right-0 -z-10 size-80 rounded-full bg-safety-500/15 blur-3xl"
      />

      <div className="shell shell-wide py-16 sm:py-20 lg:py-24">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/50">
            <li>
              <Link href="/" className="transition-colors hover:text-safety-400">
                Home
              </Link>
            </li>
            {crumbs.map((crumb, i) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                <ChevronDown className="size-3.5 -rotate-90 text-white/30" />
                {crumb.href && i < crumbs.length - 1 ? (
                  <Link href={crumb.href} className="transition-colors hover:text-safety-400">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-white/80">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        {eyebrow ? <p className="eyebrow mt-6">{eyebrow}</p> : null}

        <h1 className="font-display mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl lg:text-[3.25rem] lg:leading-[1.08]">
          {title}
        </h1>

        {lead ? (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-white/70">
            {lead}
          </p>
        ) : null}
      </div>
    </section>
  );
}
