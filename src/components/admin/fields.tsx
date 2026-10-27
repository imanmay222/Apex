"use client";

import Image from "next/image";
import { useRef, useState, type ReactNode } from "react";
import { Icon, iconMap, Search } from "../icons";
import { cx } from "../ui";
import { adminApi, errorMessage, useAdminQuery, withQuery } from "./api";
import { formatBytes } from "./format";
import { ChevronUp, FileText, ImageIcon, Plus, Trash, Upload } from "./icons";
import { Button, Empty, ErrorNotice, Loading, Modal, Pagination, inputClass, useToast } from "./ui";

export type Media = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
  size: number;
  alt: string;
  uploadedAt: string;
  uploadedBy: string | null;
};

/* ------------------------------------------------------------------ */
/* Thumbnails                                                          */
/* ------------------------------------------------------------------ */

export function Thumb({ src, alt = "", className, contain }: { src?: string | null; alt?: string; className?: string; contain?: boolean }) {
  if (!src) {
    return (
      <span className={cx("flex items-center justify-center bg-surface text-muted", className)}>
        <ImageIcon className="size-5" />
      </span>
    );
  }
  return (
    <span className={cx("relative block overflow-hidden bg-white", className)}>
      <Image src={src} alt={alt} fill unoptimized sizes="160px" className={contain ? "object-contain p-1" : "object-cover"} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Uploading                                                           */
/* ------------------------------------------------------------------ */

export async function uploadFile(file: File, alt = ""): Promise<{ media: Media; duplicate: boolean }> {
  const form = new FormData();
  form.set("file", file);
  if (alt) form.set("alt", alt);
  const result = await adminApi.upload<Media>("/api/admin/media", form);
  return { media: result.data, duplicate: Boolean(result.meta?.duplicate) };
}

export function UploadButton({
  accept = "image/*",
  label = "Upload",
  multiple,
  onUploaded,
  variant = "secondary",
}: {
  accept?: string;
  label?: string;
  multiple?: boolean;
  onUploaded: (media: Media[]) => void;
  variant?: "secondary" | "brand" | "primary";
}) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const done: Media[] = [];
    for (const file of Array.from(files)) {
      try {
        const { media, duplicate } = await uploadFile(file);
        done.push(media);
        toast(duplicate ? `“${file.name}” was already in the library — reusing it.` : `Uploaded “${file.name}”.`);
      } catch (err) {
        toast(`${file.name}: ${errorMessage(err)}`, "error");
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (done.length) onUploaded(done);
  }

  return (
    <>
      <input ref={input} type="file" accept={accept} multiple={multiple} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
      <Button variant={variant} busy={busy} onClick={() => input.current?.click()}>
        <Upload className="size-4" /> {busy ? "Uploading…" : label}
      </Button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Media picker                                                        */
/* ------------------------------------------------------------------ */

export function MediaPicker({ kind = "image", onSelect, onClose }: { kind?: "image" | "pdf"; onSelect: (media: Media) => void; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const { data, meta, error, loading, reload } = useAdminQuery<Media[]>(withQuery("/api/admin/media", { kind, q, page, limit: 24 }));

  return (
    <Modal title={kind === "pdf" ? "Choose a PDF" : "Choose an image"} onClose={onClose} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-48 flex-1">
          <span className="sr-only">Search files</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search by file name or description" className={cx(inputClass, "pl-9")} type="search" />
        </label>
        <UploadButton
          accept={kind === "pdf" ? "application/pdf" : "image/jpeg,image/png,image/webp,image/gif,image/avif"}
          label={kind === "pdf" ? "Upload PDF" : "Upload new"}
          variant="brand"
          onUploaded={(media) => onSelect(media[0])}
        />
      </div>
      {error ? (
        <ErrorNotice error={error} onRetry={reload} />
      ) : loading && !data ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No files yet">Upload one to get started.</Empty>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.map((media) => (
              <li key={media.id}>
                <button
                  type="button"
                  onClick={() => onSelect(media)}
                  className="group block w-full overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-safety-500 focus-visible:border-safety-500"
                >
                  {media.contentType === "application/pdf" ? (
                    <span className="flex aspect-square items-center justify-center bg-surface text-muted">
                      <FileText className="size-8" />
                    </span>
                  ) : (
                    <Thumb src={media.url} alt={media.alt} className="aspect-square" contain />
                  )}
                  <span className="block truncate px-2 py-1.5 text-xs text-muted group-hover:text-foreground">{media.filename}</span>
                </button>
              </li>
            ))}
          </ul>
          {meta && Number(meta.totalPages) > 1 ? (
            <div className="-mx-5 mt-4 -mb-5">
              <Pagination page={page} totalPages={Number(meta.totalPages)} total={Number(meta.total)} noun="files" onPage={setPage} />
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Asset (a URL string) and image ({src, alt}) fields                  */
/* ------------------------------------------------------------------ */

export function AssetInput({ id, value, onChange, kind = "image", onPicked }: { id?: string; value: string; onChange: (value: string) => void; kind?: "image" | "pdf"; onPicked?: (media: Media) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <div className="flex gap-3">
      {kind === "image" ? <Thumb src={value} className="size-16 shrink-0 rounded-lg border border-border" contain /> : null}
      <div className="min-w-0 flex-1 space-y-2">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={kind === "pdf" ? "/media/pdf/catalogue.pdf" : "/api/media/… or /media/…"} className={inputClass} />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setPicking(true)}>
            {kind === "pdf" ? <FileText className="size-3.5" /> : <ImageIcon className="size-3.5" />} Choose from library
          </Button>
          {value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center px-2 text-xs text-muted hover:text-foreground hover:underline">
              Open current file
            </a>
          ) : null}
        </div>
      </div>
      {picking ? (
        <MediaPicker
          kind={kind}
          onClose={() => setPicking(false)}
          onSelect={(media) => {
            onChange(media.url);
            onPicked?.(media);
            setPicking(false);
          }}
        />
      ) : null}
    </div>
  );
}

export type Img = { src: string; alt: string };

export function ImageInput({ id, value, onChange }: { id?: string; value: Img; onChange: (value: Img) => void }) {
  return (
    <div className="space-y-2">
      <AssetInput id={id} value={value.src} onChange={(src) => onChange({ ...value, src })} onPicked={(media) => !value.alt && media.alt && onChange({ src: media.url, alt: media.alt })} />
      <input aria-label="Image description (alt text)" value={value.alt} onChange={(e) => onChange({ ...value, alt: e.target.value })} placeholder="Describe the image for screen readers and Google" className={inputClass} maxLength={200} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Repeating lists                                                     */
/* ------------------------------------------------------------------ */

/** Generic ordered list editor: add, remove, move up. */
export function ListEditor<T>({
  items,
  onChange,
  blank,
  render,
  addLabel = "Add",
  max = 50,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  blank: () => T;
  render: (item: T, update: (item: T) => void, index: number) => ReactNode;
  addLabel?: string;
  max?: number;
}) {
  const set = (index: number, item: T) => onChange(items.map((current, i) => (i === index ? item : current)));
  const move = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{render(item, (value) => set(index, value), index)}</div>
          <div className="flex shrink-0 gap-1 pt-1">
            <Button size="xs" variant="ghost" onClick={() => move(index)} disabled={index === 0} aria-label="Move up">
              <ChevronUp className="size-3.5" />
            </Button>
            <Button size="xs" variant="ghost" onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label="Remove">
              <Trash className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
      {items.length < max ? (
        <Button size="sm" variant="ghost" onClick={() => onChange([...items, blank()])}>
          <Plus className="size-3.5" /> {addLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function StringList({ items, onChange, placeholder, addLabel, max }: { items: string[]; onChange: (items: string[]) => void; placeholder?: string; addLabel?: string; max?: number }) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={() => ""}
      addLabel={addLabel}
      max={max}
      render={(item, update, index) => <input aria-label={`${placeholder ?? "Item"} ${index + 1}`} value={item} onChange={(e) => update(e.target.value)} placeholder={placeholder} className={inputClass} />}
    />
  );
}

export function PairList({
  items,
  onChange,
  labels = ["Label", "Value"],
  addLabel,
  max,
}: {
  items: { label: string; value: string }[];
  onChange: (items: { label: string; value: string }[]) => void;
  labels?: [string, string];
  addLabel?: string;
  max?: number;
}) {
  return (
    <ListEditor
      items={items}
      onChange={onChange}
      blank={() => ({ label: "", value: "" })}
      addLabel={addLabel}
      max={max}
      render={(item, update, index) => (
        <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
          <input aria-label={`${labels[0]} ${index + 1}`} value={item.label} onChange={(e) => update({ ...item, label: e.target.value })} placeholder={labels[0]} className={inputClass} />
          <input aria-label={`${labels[1]} ${index + 1}`} value={item.value} onChange={(e) => update({ ...item, value: e.target.value })} placeholder={labels[1]} className={inputClass} />
        </div>
      )}
    />
  );
}

export function GalleryList({ items, onChange }: { items: Img[]; onChange: (items: Img[]) => void }) {
  return <ListEditor items={items} onChange={onChange} blank={() => ({ src: "", alt: "" })} addLabel="Add image" max={12} render={(item, update) => <ImageInput value={item} onChange={update} />} />;
}

/* ------------------------------------------------------------------ */
/* Icon picker                                                         */
/* ------------------------------------------------------------------ */

export const ICON_NAMES = Object.keys(iconMap);

export function IconSelect({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-800/10 text-brand-800 dark:text-brand-300">
        <Icon name={value} className="size-5" />
      </span>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {!ICON_NAMES.includes(value) && value ? <option value={value}>{value}</option> : null}
        {ICON_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FileMeta({ media }: { media: Media }) {
  return (
    <span className="text-xs text-muted">
      {media.contentType.replace("image/", "").replace("application/", "").toUpperCase()} · {formatBytes(media.size)}
    </span>
  );
}
