import type { Role } from "../db/models/admin-user";

export const PERMISSIONS = [
  "content:write",
  "media:write",
  "enquiries:read",
  "enquiries:write",
  "enquiries:delete",
  "subscribers:read",
  "subscribers:manage",
  "settings:write",
  "users:manage",
  "analytics:read",
  "audit:read",
  "system:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  editor: ["content:write", "media:write", "analytics:read"],
  sales: ["enquiries:read", "enquiries:write", "subscribers:read", "analytics:read"],
};

export function permissionsFor(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(role: Role, permission: Permission): boolean {
  return permissionsFor(role).includes(permission);
}
