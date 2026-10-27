"use client";

import { useRef, useState } from "react";
import { Download } from "../icons";
import { AdminApiError, adminApi, adminRequest, errorMessage } from "./api";
import { Refresh, Upload } from "./icons";
import { Button, Card, ErrorNotice, Toggle, btn, useToast } from "./ui";

type ImportSummary = { mode: "merge" | "replace"; collections: Record<string, { created: number; updated: number; deleted: number }>; settingsUpdated: boolean };

export function SystemTools() {
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [purging, setPurging] = useState(false);

  async function runImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);
    setProblems(null);
    try {
      let snapshot: unknown;
      try {
        snapshot = JSON.parse(await file.text());
      } catch {
        throw new Error("That file isn't valid JSON. Choose a backup downloaded from this page.");
      }
      const query = replace ? "?mode=replace&confirm=true" : "?mode=merge";
      const { data } = await adminRequest<ImportSummary>(`/api/admin/import${query}`, { method: "POST", json: snapshot });
      setResult(data);
      toast("Backup restored — the website is updated.");
      setFile(null);
      setConfirmed(false);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      setProblems(err instanceof AdminApiError && err.issues.length ? err.issues.slice(0, 25).map((i) => `${i.path || "file"}: ${i.message}`) : [errorMessage(err)]);
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Backup &amp; system</h1>
        <p className="mt-1 text-sm text-muted">Download or restore all website content, and refresh what visitors see.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Download a backup">
          <p className="mb-4 text-sm text-muted">
            A JSON file with every product, group, survey, training programme, gallery image, testimonial, logo, leader and the site settings. Users, enquiries and uploaded files are not included — back those up with the database.
          </p>
          <a href="/api/admin/export" download className={btn("brand")}>
            <Download className="size-4" /> Download content backup
          </a>
        </Card>

        <Card title="Refresh the website">
          <p className="mb-4 text-sm text-muted">Edits made here appear instantly. If someone changed the database directly, clear the cache so visitors see it straight away.</p>
          <Button
            busy={purging}
            onClick={async () => {
              setPurging(true);
              try {
                await adminApi.post("/api/admin/cache");
                toast("Cache cleared — every page will load fresh content.");
              } catch (err) {
                toast(errorMessage(err), "error");
              } finally {
                setPurging(false);
              }
            }}
          >
            <Refresh className="size-4" /> Clear website cache
          </Button>
        </Card>

        <Card title="Restore from a backup" className="lg:col-span-2">
          <div className="space-y-4 text-sm">
            <p className="text-muted">
              The whole file is checked before anything is written; if any row is invalid nothing changes. <strong className="text-foreground">Merge</strong> adds new items and updates existing ones (matched by slug, key or name).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input ref={fileInput} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => (setFile(e.target.files?.[0] ?? null), setResult(null), setProblems(null))} aria-label="Backup file" />
              <Button onClick={() => fileInput.current?.click()}>
                <Upload className="size-4" /> Choose backup file
              </Button>
              <span className="text-muted">{file ? file.name : "No file chosen"}</span>
            </div>
            <Toggle checked={replace} onChange={(v) => (setReplace(v), setConfirmed(false))} label="Replace instead of merge (deletes items that aren't in the file)" />
            {replace ? (
              <label className="flex items-start gap-2 rounded-lg border border-red-600/30 bg-red-600/5 p-3 text-red-700 dark:text-red-300">
                <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-red-600" />I understand this deletes every item of each content type in the file before restoring it.
              </label>
            ) : null}
            <Button variant={replace ? "danger" : "primary"} busy={importing} disabled={!file || (replace && !confirmed)} onClick={runImport}>
              {replace ? "Replace content" : "Merge into current content"}
            </Button>

            {problems ? (
              <div>
                <ErrorNotice error="The backup was rejected; nothing was changed." />
                <ul className="mt-2 max-h-60 list-inside list-disc overflow-y-auto text-xs text-muted">
                  {problems.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result ? (
              <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3">
                <p className="font-medium text-foreground">Restored ({result.mode}).</p>
                <ul className="mt-1 grid gap-x-6 text-xs text-muted sm:grid-cols-2">
                  {Object.entries(result.collections).map(([key, c]) => (
                    <li key={key}>
                      {key}: {c.created} added, {c.updated} updated{c.deleted ? `, ${c.deleted} removed` : ""}
                    </li>
                  ))}
                  {result.settingsUpdated ? <li>Site settings updated</li> : null}
                </ul>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
