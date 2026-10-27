"use client";

import { useState, type FormEvent } from "react";
import { cx } from "../ui";
import { AdminApiError, adminApi, errorMessage, useAdminQuery } from "./api";
import { ROLE_LABELS, formatDate, timeAgo } from "./format";
import { Plus } from "./icons";
import { Badge, Button, Card, ConfirmButton, ErrorNotice, Field, Loading, Modal, PageHeader, inputClass, useToast } from "./ui";
import { inlineInputClass } from "./styles";

type User = { id: string; email: string; name: string; role: "admin" | "editor" | "sales"; active: boolean; locked: boolean; lastLoginAt: string | null; createdAt: string };

const ROLE_HELP: Record<User["role"], string> = {
  admin: "Everything, including users, settings, backups and deleting enquiries.",
  editor: "Website content, media library and analytics.",
  sales: "Enquiries (read & handle), subscribers and analytics.",
};

export const PASSWORD_HINT = "At least 12 characters with letters and numbers; not a common password or based on the email.";

export function UsersAdmin({ viewerId }: { viewerId: string }) {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAdminQuery<User[]>("/api/admin/users");
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  async function patch(user: User, body: Partial<Pick<User, "role" | "active" | "name">>, message: string) {
    try {
      const updated = await adminApi.patch<User>(`/api/admin/users/${user.id}`, body);
      setData((list) => (list ?? []).map((u) => (u.id === user.id ? updated : u)));
      toast(message);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(user: User) {
    try {
      await adminApi.del(`/api/admin/users/${user.id}`);
      setData((list) => (list ?? []).filter((u) => u.id !== user.id));
      toast(`Deleted ${user.email}.`);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        description="Team members who can sign in to this admin panel."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> Add user
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_HELP) as User["role"][]).map((role) => (
          <div key={role} className="rounded-xl border border-border bg-surface-raised p-4 text-sm">
            <p className="font-medium text-foreground">{ROLE_LABELS[role]}</p>
            <p className="mt-0.5 text-muted">{ROLE_HELP[role]}</p>
          </div>
        ))}
      </div>

      <Card padded={false}>
        {error ? (
          <div className="p-4">
            <ErrorNotice error={error} onRetry={reload} />
          </div>
        ) : loading || !data ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-surface text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.map((user) => {
                  const self = user.id === viewerId;
                  return (
                    <tr key={user.id} className={cx("hover:bg-surface", !user.active && "opacity-70")}>
                      <td className="px-4 py-3">
                        <span className="font-medium text-foreground">{user.name}</span>
                        {self ? <span className="ml-1.5 text-xs text-muted">(you)</span> : null}
                        <span className="block text-xs text-muted">{user.email}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Role for ${user.email}`}
                          value={user.role}
                          disabled={self}
                          onChange={(e) => patch(user, { role: e.target.value as User["role"] }, `${user.name} is now ${ROLE_LABELS[e.target.value]}.`)}
                          className={cx(inlineInputClass, "h-8 w-auto py-0")}
                        >
                          {Object.entries(ROLE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex flex-wrap gap-1">
                          {user.active ? <Badge tone="green">Active</Badge> : <Badge>Deactivated</Badge>}
                          {user.locked ? <Badge tone="red">Locked (too many attempts)</Badge> : null}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted" title={user.lastLoginAt ? formatDate(user.lastLoginAt) : undefined}>
                        {user.lastLoginAt ? timeAgo(user.lastLoginAt) : "Never"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => setResetting(user)}>
                            Reset password
                          </Button>
                          {!self ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => patch(user, { active: !user.active }, user.active ? `Deactivated ${user.name} and signed them out.` : `Reactivated ${user.name}.`)}>
                                {user.active ? "Deactivate" : "Activate"}
                              </Button>
                              <ConfirmButton onConfirm={() => remove(user)} prompt={`Delete ${user.name}?`}>
                                Delete
                              </ConfirmButton>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating ? (
        <CreateUser
          onClose={() => setCreating(false)}
          onCreated={(user) => {
            setData((list) => [...(list ?? []), user]);
            setCreating(false);
            toast(`Created ${user.email}. Share the password with them securely.`);
          }}
        />
      ) : null}
      {resetting ? <ResetPassword user={resetting} self={resetting.id === viewerId} onClose={() => setResetting(null)} /> : null}
    </>
  );
}

function CreateUser({ onClose, onCreated }: { onClose: () => void; onCreated: (user: User) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(null);
    try {
      onCreated(
        await adminApi.post<User>("/api/admin/users", {
          name: String(form.get("name") ?? "").trim(),
          email: String(form.get("email") ?? "").trim(),
          role: String(form.get("role")),
          password: String(form.get("password") ?? ""),
        }),
      );
    } catch (err) {
      setError(err instanceof AdminApiError && err.issues.length ? err.issues.map((i) => i.message).join(" ") : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" htmlFor="u-name" required>
          <input id="u-name" name="name" required minLength={2} maxLength={100} className={inputClass} autoComplete="off" />
        </Field>
        <Field label="Email" htmlFor="u-email" required>
          <input id="u-email" name="email" type="email" required className={inputClass} autoComplete="off" />
        </Field>
        <Field label="Role" htmlFor="u-role" required>
          <select id="u-role" name="role" defaultValue="sales" className={inputClass}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Temporary password" htmlFor="u-password" hint={PASSWORD_HINT} required>
          <input id="u-password" name="password" type="text" required minLength={12} className={cx(inputClass, "font-mono")} autoComplete="new-password" />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, self, onClose }: { user: User; self: boolean; onClose: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") ?? "");
    setBusy(true);
    setError(null);
    try {
      await adminApi.post(`/api/admin/users/${user.id}/reset-password`, { password });
      toast(`New password set for ${user.name}. They've been signed out everywhere.`);
      if (self) window.location.replace("/admin/login");
      else onClose();
    } catch (err) {
      setError(err instanceof AdminApiError && err.issues.length ? err.issues.map((i) => i.message).join(" ") : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={`Reset password — ${user.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <p className="text-sm text-muted">
          Sets a new password and signs {self ? "you" : "them"} out of every device.{self ? " You'll need to sign in again." : " Share it with them securely."}
        </p>
        <Field label="New password" htmlFor="r-password" hint={PASSWORD_HINT}>
          <input id="r-password" name="password" type="text" required minLength={12} className={cx(inputClass, "font-mono")} autoComplete="new-password" />
        </Field>
        {error ? <ErrorNotice error={error} /> : null}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={busy}>
            Set password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
