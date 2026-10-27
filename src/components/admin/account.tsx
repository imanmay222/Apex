"use client";

import { useState, type FormEvent } from "react";
import type { AdminViewer } from "@/server/auth/current";
import { AdminApiError, adminApi, adminRequest, errorMessage, useAdminQuery } from "./api";
import { ROLE_LABELS, formatDate, timeAgo } from "./format";
import { LogOut } from "./icons";
import { Badge, Button, Card, ConfirmButton, ErrorNotice, Field, Loading, PageHeader, inputClass, useToast } from "./ui";
import { PASSWORD_HINT } from "./users";

type Session = { id: string; current: boolean; createdAt: string; lastUsedAt: string; expiresAt: string; userAgent: string | null };

/** "Chrome on macOS" from a user-agent string; good enough to recognise your own devices. */
function describeDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function Account({ viewer }: { viewer: AdminViewer }) {
  const toast = useToast();
  const sessions = useAdminQuery<Session[]>("/api/admin/auth/sessions");

  async function signOut() {
    await adminRequest("/api/admin/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.replace("/admin/login");
  }

  return (
    <>
      <PageHeader
        title="My account"
        actions={
          <Button onClick={signOut}>
            <LogOut className="size-4" /> Sign out
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="text-foreground">{viewer.name}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="text-foreground">{viewer.email}</dd>
            <dt className="text-muted">Role</dt>
            <dd>
              <Badge tone="blue">{ROLE_LABELS[viewer.role] ?? viewer.role}</Badge>
            </dd>
            <dt className="text-muted">Access</dt>
            <dd className="flex flex-wrap gap-1">
              {viewer.permissions.map((p) => (
                <Badge key={p}>{p}</Badge>
              ))}
            </dd>
          </dl>
          <p className="mt-4 text-xs text-muted">Name, email and role are managed by an administrator.</p>
        </Card>

        <ChangePassword />

        <Card
          title="Signed-in devices"
          className="lg:col-span-2"
          padded={false}
          actions={
            (sessions.data?.length ?? 0) > 1 ? (
              <ConfirmButton
                variant="secondary"
                confirmLabel="Sign out others"
                prompt="Sign out all other devices?"
                onConfirm={async () => {
                  try {
                    const { revoked } = await adminApi.del<{ revoked: number }>("/api/admin/auth/sessions");
                    toast(`Signed out ${revoked} other device${revoked === 1 ? "" : "s"}.`);
                    sessions.reload();
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  }
                }}
              >
                Sign out other devices
              </ConfirmButton>
            ) : null
          }
        >
          {sessions.error ? (
            <div className="p-4">
              <ErrorNotice error={sessions.error} onRetry={sessions.reload} />
            </div>
          ) : !sessions.data ? (
            <Loading />
          ) : (
            <ul className="divide-y divide-border">
              {sessions.data.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {describeDevice(s.userAgent)} {s.current ? <Badge tone="green">This device</Badge> : null}
                    </p>
                    <p className="text-xs text-muted">
                      Signed in {formatDate(s.createdAt)} · last active {timeAgo(s.lastUsedAt)} · expires {formatDate(s.expiresAt, false)}
                    </p>
                  </div>
                  {!s.current ? (
                    <ConfirmButton
                      confirmLabel="Sign out"
                      prompt="Sign out this device?"
                      onConfirm={async () => {
                        try {
                          await adminApi.del(`/api/admin/auth/sessions/${s.id}`);
                          sessions.reload();
                        } catch (err) {
                          toast(errorMessage(err), "error");
                        }
                      }}
                    >
                      Sign out
                    </ConfirmButton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function ChangePassword() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const currentPassword = String(form.get("current") ?? "");
    const newPassword = String(form.get("new") ?? "");
    if (newPassword !== String(form.get("confirm") ?? "")) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminApi.post("/api/admin/auth/change-password", { currentPassword, newPassword });
      formEl.reset();
      toast("Password changed. Other devices have been signed out.");
    } catch (err) {
      setError(err instanceof AdminApiError && err.issues.length ? err.issues.map((i) => i.message).join(" ") : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="space-y-3" noValidate aria-label="Change password">
        <Field label="Current password" htmlFor="pw-current">
          <input id="pw-current" name="current" type="password" autoComplete="current-password" required className={inputClass} />
        </Field>
        <Field label="New password" htmlFor="pw-new" hint={PASSWORD_HINT}>
          <input id="pw-new" name="new" type="password" autoComplete="new-password" required minLength={12} className={inputClass} />
        </Field>
        <Field label="Repeat new password" htmlFor="pw-confirm">
          <input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required className={inputClass} />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <Button type="submit" variant="brand" busy={busy}>
          Change password
        </Button>
      </form>
    </Card>
  );
}
