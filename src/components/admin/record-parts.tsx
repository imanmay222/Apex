"use client";

import { useState, type FormEvent } from "react";
import { cx } from "../ui";
import { adminApi, errorMessage } from "./api";
import { formatDate, timeAgo } from "./format";
import { Send, Trash } from "./icons";
import { Badge, Button, Card, ConfirmButton, DeliveryBadge, inputClass, useToast } from "./ui";

/*
 * Cards shared by the enquiry and order detail pages. Both records have internal notes, a status
 * history, per-channel notification state and a spam score, served under `apiBase`
 * (e.g. /api/admin/orders/<id>), whose endpoints all return the updated record.
 */

type Note = { id: string; authorId: string | null; authorName: string; body: string; createdAt: string };
type Delivery = { status: string; attempts: number; lastAttemptAt: string | null; sentAt: string | null; lastError: string | null };
type Viewer = { id: string; role: string };

export function NotesCard<T extends { notes: Note[] }>({
  record,
  apiBase,
  viewer,
  canWrite,
  onChange,
  placeholder,
  audience = "customers tracking their enquiry",
}: {
  record: T;
  apiBase: string;
  viewer: Viewer;
  canWrite: boolean;
  onChange: (record: T) => void;
  placeholder: string;
  audience?: string;
}) {
  const toast = useToast();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      onChange(await adminApi.post<T>(`${apiBase}/notes`, { body: body.trim() }));
      setBody("");
      toast("Note added.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`Internal notes${record.notes.length ? ` · ${record.notes.length}` : ""}`}>
      <p className="-mt-1 mb-4 text-xs text-muted">Only the team sees notes; {audience} never do.</p>
      {record.notes.length ? (
        <ul className="mb-4 space-y-3">
          {record.notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>
                  <span className="font-medium text-foreground">{note.authorName}</span> · {formatDate(note.createdAt)}
                </span>
                {canWrite && (viewer.role === "admin" || note.authorId === viewer.id) ? (
                  <ConfirmButton
                    size="xs"
                    variant="ghost"
                    confirmLabel="Delete"
                    prompt="Delete note?"
                    onConfirm={async () => {
                      try {
                        onChange(await adminApi.del<T>(`${apiBase}/notes/${note.id}`));
                      } catch (err) {
                        toast(errorMessage(err), "error");
                      }
                    }}
                  >
                    <Trash className="size-3.5" />
                    <span className="sr-only">Delete note</span>
                  </ConfirmButton>
                ) : null}
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap text-foreground">{note.body}</p>
            </li>
          ))}
        </ul>
      ) : null}
      {canWrite ? (
        <form onSubmit={add} className="space-y-2">
          <label htmlFor="note" className="sr-only">
            New note
          </label>
          <textarea id="note" rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder={placeholder} className={cx(inputClass, "resize-y")} />
          <div className="flex justify-end">
            <Button type="submit" variant="brand" size="sm" busy={busy} disabled={!body.trim()}>
              Add note
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

export function ActivityCard({
  history,
  labels,
  createdAt,
  firstResponseAt,
}: {
  history: { status: string; at: string; by: string }[];
  labels: Record<string, string>;
  createdAt: string;
  firstResponseAt: string | null;
}) {
  return (
    <Card title="Activity">
      <ol className="relative space-y-4 border-l border-border pl-5">
        {[...history].reverse().map((entry, i) => (
          <li key={`${entry.at}-${i}`} className="relative text-sm">
            <span className={cx("absolute top-1 -left-[1.6rem] size-2.5 rounded-full ring-4 ring-surface-raised", i === 0 ? "bg-safety-500" : "bg-border")} />
            <p className="text-foreground">
              {entry.status === "new" && entry.by === "system" ? "Received from the website" : <>Marked <strong>{labels[entry.status] ?? entry.status}</strong></>}
              {entry.by !== "system" ? <span className="text-muted"> by {entry.by}</span> : null}
            </p>
            <p className="text-xs text-muted">{formatDate(entry.at)}</p>
          </li>
        ))}
      </ol>
      {firstResponseAt ? (
        <p className="mt-4 text-xs text-muted">
          First response after {Math.max(1, Math.round((new Date(firstResponseAt).getTime() - new Date(createdAt).getTime()) / 60_000))} min.
        </p>
      ) : null}
    </Card>
  );
}

const CHANNELS = ["sales", "customer", "webhook"] as const;

export function NotificationsCard<T>({
  notifications,
  apiBase,
  canWrite,
  onResent,
  labels,
}: {
  notifications: Record<(typeof CHANNELS)[number], Delivery>;
  apiBase: string;
  canWrite: boolean;
  onResent: (record: T) => void;
  labels: Record<(typeof CHANNELS)[number], string>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Card title="Notifications">
      <ul className="space-y-3 text-sm">
        {CHANNELS.map((channel) => {
          const n = notifications[channel];
          return (
            <li key={channel} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-foreground">{labels[channel]}</p>
                <p className="text-xs text-muted">
                  {n.sentAt ? `Sent ${timeAgo(n.sentAt)}` : n.status === "skipped" ? (channel === "customer" ? "No email given" : "Not configured") : n.attempts ? `${n.attempts} attempt${n.attempts === 1 ? "" : "s"}` : "Not sent yet"}
                </p>
                {n.lastError && n.status === "failed" ? <p className="mt-0.5 text-xs break-words text-red-600 dark:text-red-400">{n.lastError}</p> : null}
              </div>
              <DeliveryBadge status={n.status} />
            </li>
          );
        })}
      </ul>
      {canWrite ? (
        <Button
          size="sm"
          className="mt-4"
          busy={busy}
          onClick={async () => {
            setBusy(true);
            try {
              onResent(await adminApi.post<T>(`${apiBase}/resend`, {}));
              toast("Notifications re-sent.");
            } catch (err) {
              toast(errorMessage(err), "error");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send className="size-3.5" /> Resend notifications
        </Button>
      ) : null}
    </Card>
  );
}

export function SpamCard({ spam }: { spam: { score: number; reasons: string[] } }) {
  if (spam.score <= 0) return null;
  return (
    <Card title="Spam check">
      <p className="text-sm text-foreground">Score {spam.score}</p>
      <ul className="mt-2 flex flex-wrap gap-1">
        {spam.reasons.map((reason) => (
          <Badge key={reason} tone="amber">
            {reason}
          </Badge>
        ))}
      </ul>
    </Card>
  );
}
