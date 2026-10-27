"use client";

import { useState, type DragEvent } from "react";
import { Search } from "../icons";
import { cx } from "../ui";
import { AdminApiError, adminApi, errorMessage, useAdminQuery, withQuery } from "./api";
import { FileMeta, Thumb, UploadButton, uploadFile, type Media } from "./fields";
import { formatDate } from "./format";
import { Copy, ExternalLink, FileText, Trash, Upload } from "./icons";
import { Button, Card, ConfirmButton, Empty, ErrorNotice, Loading, Modal, PageHeader, Pagination, Tabs, inputClass, useToast } from "./ui";

type Usage = { resource: string; label: string }[];

export function MediaLibrary() {
  const toast = useToast();
  const [kind, setKind] = useState<"" | "image" | "pdf">("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState<Media | null>(null);
  const { data, meta, error, loading, reload } = useAdminQuery<Media[]>(withQuery("/api/admin/media", { kind, q, page, limit: 30 }));

  async function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;
    setUploading(true);
    for (const file of files) {
      try {
        const { duplicate } = await uploadFile(file);
        toast(duplicate ? `“${file.name}” is already in the library.` : `Uploaded “${file.name}”.`);
      } catch (err) {
        toast(`${file.name}: ${errorMessage(err)}`, "error");
      }
    }
    setUploading(false);
    setPage(1);
    reload();
  }

  return (
    <>
      <PageHeader
        title="Media library"
        description="Images and PDFs stored in the database. Use them in products, surveys, logos, the gallery — or as the downloadable catalogue."
        actions={<UploadButton multiple variant="primary" label="Upload files" accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf" onUploaded={() => (setPage(1), reload())} />}
      />

      <div
        onDragOver={(e) => (e.preventDefault(), setDragging(true))}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          "mb-6 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition-colors",
          dragging ? "border-safety-500 bg-safety-500/5 text-foreground" : "border-border text-muted",
        )}
      >
        <Upload className="size-5" />
        {uploading ? "Uploading…" : "Drop images or PDFs here"}
        <span className="text-xs">JPEG, PNG, WebP, GIF or AVIF up to 8 MB · PDF up to 25 MB · identical files are stored once</span>
      </div>

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <Tabs
            value={kind}
            onChange={(v) => (setKind(v), setPage(1))}
            options={[
              { value: "", label: "All files" },
              { value: "image", label: "Images" },
              { value: "pdf", label: "PDFs" },
            ]}
          />
          <label className="relative min-w-48 flex-1">
            <span className="sr-only">Search files</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder="Search by file name or description" className={cx(inputClass, "pl-9")} type="search" />
          </label>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <Loading />
        ) : !data?.length ? (
          <Empty title={q || kind ? "No matching files" : "The library is empty"}>{q || kind ? "Try another search." : "Upload your first image or PDF."}</Empty>
        ) : (
          <ul className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {data.map((media) => (
              <li key={media.id}>
                <button type="button" onClick={() => setOpen(media)} className="group block w-full overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-safety-500">
                  {media.contentType === "application/pdf" ? (
                    <span className="flex aspect-[4/3] items-center justify-center bg-surface text-muted">
                      <FileText className="size-10" />
                    </span>
                  ) : (
                    <Thumb src={media.url} alt={media.alt} className="aspect-[4/3]" contain />
                  )}
                  <span className="block border-t border-border px-2.5 py-2">
                    <span className="block truncate text-xs font-medium text-foreground">{media.filename}</span>
                    <FileMeta media={media} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {meta && data?.length ? <Pagination page={page} totalPages={Number(meta.totalPages ?? 1)} total={Number(meta.total ?? 0)} noun="files" onPage={setPage} /> : null}
      </Card>

      {open ? (
        <MediaDetails
          media={open}
          onClose={() => setOpen(null)}
          onChanged={() => {
            setOpen(null);
            reload();
          }}
        />
      ) : null}
    </>
  );
}

function MediaDetails({ media, onClose, onChanged }: { media: Media; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [alt, setAlt] = useState(media.alt);
  const [saving, setSaving] = useState(false);
  const [blockedBy, setBlockedBy] = useState<Usage | null>(null);
  const usage = useAdminQuery<{ usage: Usage }>(`/api/admin/media/${media.id}`);
  const absolute = typeof window === "undefined" ? media.url : `${window.location.origin}${media.url}`;

  async function saveAlt() {
    setSaving(true);
    try {
      await adminApi.patch(`/api/admin/media/${media.id}`, { alt });
      toast("Description saved.");
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(force = false) {
    try {
      await adminApi.del(`/api/admin/media/${media.id}${force ? "?force=true" : ""}`);
      toast(`Deleted “${media.filename}”.`);
      onChanged();
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 409) {
        setBlockedBy(usage.data?.usage ?? []);
      } else {
        toast(errorMessage(err), "error");
      }
    }
  }

  const uses = usage.data?.usage ?? [];

  return (
    <Modal title={media.filename} onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-[1.2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-border">
          {media.contentType === "application/pdf" ? (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-surface text-muted">
              <FileText className="size-12" />
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-800 hover:underline dark:text-brand-300">
                Open PDF
              </a>
            </div>
          ) : (
            <Thumb src={media.url} alt={media.alt} className="aspect-[4/3]" contain />
          )}
        </div>
        <div className="space-y-4 text-sm">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5">
            <dt className="text-muted">Type</dt>
            <dd>
              <FileMeta media={media} />
            </dd>
            <dt className="text-muted">Uploaded</dt>
            <dd className="text-foreground">{formatDate(media.uploadedAt)}</dd>
            {media.uploadedBy ? (
              <>
                <dt className="text-muted">By</dt>
                <dd className="truncate text-foreground">{media.uploadedBy}</dd>
              </>
            ) : null}
          </dl>
          <div>
            <p className="mb-1.5 font-medium text-foreground">Link</p>
            <div className="flex gap-2">
              <input readOnly value={media.url} className={cx(inputClass, "font-mono text-xs")} onFocus={(e) => e.target.select()} aria-label="File URL" />
              <Button
                aria-label="Copy link"
                onClick={() => navigator.clipboard?.writeText(absolute).then(() => toast("Link copied."), () => toast("Couldn't copy — select the link and copy it.", "error"))}
              >
                <Copy className="size-4" />
              </Button>
              <a href={media.url} target="_blank" rel="noopener noreferrer" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border" aria-label="Open file">
                <ExternalLink className="size-4" />
              </a>
            </div>
          </div>
          <div>
            <label htmlFor="media-alt" className="mb-1.5 block font-medium text-foreground">
              Description (alt text)
            </label>
            <div className="flex gap-2">
              <input id="media-alt" value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} className={inputClass} />
              <Button onClick={saveAlt} busy={saving} disabled={alt === media.alt}>
                Save
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-foreground">Used in</p>
            {usage.loading ? (
              <p className="text-muted">Checking…</p>
            ) : uses.length ? (
              <ul className="list-inside list-disc text-muted">
                {uses.map((u, i) => (
                  <li key={i}>
                    <span className="capitalize">{u.resource.replace("-", " ")}</span>: {u.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Not used anywhere on the website.</p>
            )}
          </div>
          <div className="border-t border-border pt-4">
            {blockedBy ? (
              <div className="space-y-2">
                <p className="text-red-700 dark:text-red-300">This file is still used by the website. Deleting it will leave broken images there.</p>
                <ConfirmButton onConfirm={() => remove(true)} confirmLabel="Delete anyway" prompt="Really?">
                  Delete anyway
                </ConfirmButton>
              </div>
            ) : (
              <ConfirmButton onConfirm={() => remove(false)}>
                <Trash className="size-3.5" /> Delete file
              </ConfirmButton>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
