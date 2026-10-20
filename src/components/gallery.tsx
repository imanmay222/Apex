"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Close, ZoomIn } from "./icons";

type GalleryImage = { src: string; alt: string };

/** Lightbox gallery built on the native <dialog> element — replaces lightGallery. */
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const open = (i: number) => setIndex(i);
  const close = useCallback(() => setIndex(null), []);

  const step = useCallback(
    (delta: number) =>
      setIndex((current) =>
        current === null ? null : (current + delta + images.length) % images.length,
      ),
    [images.length],
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (index !== null && !dialog.open) dialog.showModal();
    if (index === null && dialog.open) dialog.close();
  }, [index]);

  useEffect(() => {
    if (index === null) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, step]);

  const active = index === null ? null : images[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, i) => (
          <li key={image.src}>
            <button
              type="button"
              onClick={() => open(i)}
              className="group relative block aspect-4/3 w-full overflow-hidden rounded-2xl border border-border"
              aria-label={`View image ${i + 1} of ${images.length}`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(min-width: 1024px) 23vw, (min-width: 640px) 31vw, 46vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-brand-950/0 transition-colors duration-300 group-hover:bg-brand-950/50">
                <ZoomIn className="size-8 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={close}
        onClick={(event) => {
          if (event.target === dialogRef.current) close();
        }}
        className="m-auto max-h-dvh w-full max-w-5xl bg-transparent p-4 backdrop:bg-brand-950/90 backdrop:backdrop-blur-sm"
      >
        {active ? (
          <div className="relative">
            <Image
              src={active.src}
              alt={active.alt}
              width={1400}
              height={1000}
              sizes="100vw"
              className="max-h-[80dvh] w-full rounded-2xl object-contain"
            />

            <div className="mt-4 flex items-center justify-between gap-4">
              <p className="text-sm text-white/70">
                {(index ?? 0) + 1} / {images.length}
              </p>
              <div className="flex gap-2">
                <GalleryButton onClick={() => step(-1)} label="Previous image">
                  <ArrowLeft className="size-5" />
                </GalleryButton>
                <GalleryButton onClick={() => step(1)} label="Next image">
                  <ArrowRight className="size-5" />
                </GalleryButton>
              </div>
            </div>

            <button
              type="button"
              onClick={close}
              aria-label="Close gallery"
              className="absolute -top-2 right-0 inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Close className="size-5" />
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}

function GalleryButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
    >
      {children}
    </button>
  );
}
