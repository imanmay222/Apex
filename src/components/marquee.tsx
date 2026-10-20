import Image from "next/image";
import type { Logo } from "@/lib/types";

/**
 * Infinite CSS marquee. The list is rendered twice and translated -50%, so the
 * loop is seamless without JS. Replaces the old prev/next arrow slider.
 */
export function LogoMarquee({
  logos,
  duration = 45,
  invertOnDark = false,
}: {
  logos: Logo[];
  duration?: number;
  invertOnDark?: boolean;
}) {
  const track = [...logos, ...logos];

  return (
    <div
      className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]"
      style={{ ["--marquee-duration" as string]: `${duration}s` }}
    >
      <ul className="marquee-track flex w-max items-center gap-10 sm:gap-14">
        {track.map((logo, i) => (
          <li key={`${logo.src}-${i}`} className="shrink-0">
            <Image
              src={logo.src}
              alt={logo.name}
              width={160}
              height={70}
              aria-hidden={i >= logos.length}
              className={`h-12 w-auto object-contain opacity-70 transition-opacity duration-300 hover:opacity-100 sm:h-14 ${
                invertOnDark ? "dark:brightness-0 dark:invert" : ""
              }`}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
