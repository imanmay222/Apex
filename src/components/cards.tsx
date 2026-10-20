import Image from "next/image";
import Link from "next/link";
import type { Product, SurveyService, TrainingProgram } from "@/lib/types";
import { ArrowRight, Icon } from "./icons";

export function ProductCard({
  category,
  priority = false,
}: {
  category: Product;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/products/${category.slug}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-raised transition-all duration-300 hover:-translate-y-1 hover:border-safety-500/40 hover:shadow-xl hover:shadow-brand-950/10"
    >
      <div className="relative aspect-4/3 overflow-hidden bg-white">
        <Image
          src={category.image.src}
          alt={category.image.alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-6 transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t border-border p-5">
        <h3 className="font-display text-base font-semibold text-foreground transition-colors group-hover:text-safety-500">
          {category.title}
        </h3>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted">{category.summary}</p>
        <span className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-semibold text-safety-500">
          View details
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function SurveyCard({ survey }: { survey: SurveyService }) {
  return (
    <Link
      href={`/survey/${survey.slug}`}
      className="group relative flex min-h-80 flex-col justify-end overflow-hidden rounded-2xl border border-border transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand-950/20"
    >
      <Image
        src={survey.image.src}
        alt={survey.image.alt}
        fill
        sizes="(min-width: 1024px) 32vw, (min-width: 640px) 48vw, 92vw"
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/70 to-brand-950/10" />

      <div className="relative p-6">
        <h3 className="font-display text-xl font-semibold text-white text-balance">
          {survey.shortTitle ?? survey.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-white/70">
          {survey.description}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-safety-400">
          Read more
          <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}

export function TrainingCard({ program }: { program: TrainingProgram }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-safety-500/50 hover:bg-white/[0.07]">
      <div className="inline-flex size-12 items-center justify-center rounded-xl bg-safety-500/15 text-safety-400 transition-colors duration-300 group-hover:bg-safety-500 group-hover:text-white">
        <Icon name={program.icon} className="size-6" />
      </div>
      <h3 className="font-display mt-4 text-base font-semibold text-white text-balance">
        {program.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-white/60">{program.summary}</p>
    </div>
  );
}
