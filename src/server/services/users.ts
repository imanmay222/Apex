import { Types } from "mongoose";
import { hashPassword, passwordProblem, verifyAgainstDummy, verifyPassword } from "../auth/password";
import { createSession, destroyUserSessions } from "../auth/sessions";
import { connectDb } from "../db/connect";
import { AdminUserModel, SessionModel, type AdminUserDoc, type Role } from "../db/models";
import { conflict, isDuplicateKeyError, notFound, unauthorized, validationFailed } from "../lib/errors";
import { audit, type Actor } from "./audit";
import type { Lean } from "./mappers";

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
  locked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

function toUser(doc: Lean<AdminUserDoc>): UserDTO {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    role: doc.role as Role,
    active: doc.active ?? true,
    locked: Boolean(doc.lockedUntil && doc.lockedUntil > new Date()),
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
    createdAt: (doc.createdAt ?? new Date(0)).toISOString(),
  };
}

function userId(id: string): Types.ObjectId {
  if (!/^[0-9a-fA-F]{24}$/.test(id)) throw notFound("User");
  return new Types.ObjectId(id);
}

/* ------------------------------------------------------------------ */
/* Sign-in                                                             */
/* ------------------------------------------------------------------ */

const INVALID_CREDENTIALS = "Invalid email or password.";

/**
 * Verifies credentials and opens a session. Every failure path returns the same error and burns
 * comparable CPU, so the response can't be used to discover which emails have accounts.
 */
export async function signIn(
  email: string,
  password: string,
  meta: { ipHash: string; userAgent: string },
) {
  await connectDb();
  const user = await AdminUserModel.findOne({ email }).select("+passwordHash");

  const locked = Boolean(user?.lockedUntil && user.lockedUntil > new Date());
  if (!user || !user.active || locked) {
    await verifyAgainstDummy(password);
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    const failed = (user.failedLogins ?? 0) + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await AdminUserModel.updateOne(
      { _id: user._id },
      {
        $set: { failedLogins: lock ? 0 : failed, ...(lock ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : {}) },
      },
    );
    await audit({ actor: null, action: lock ? "login-locked" : "login-failed", resource: "auth", summary: email, ipHash: meta.ipHash });
    throw unauthorized(INVALID_CREDENTIALS);
  }

  await AdminUserModel.updateOne(
    { _id: user._id },
    { $set: { failedLogins: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: "" } },
  );

  const session = await createSession(String(user._id), meta);
  const actor = { id: String(user._id), email: user.email };
  await audit({ actor, action: "login", resource: "auth", ipHash: meta.ipHash });

  return {
    ...session,
    user: { id: actor.id, email: user.email, name: user.name, role: user.role as Role },
  };
}

/* ------------------------------------------------------------------ */
/* Own account                                                         */
/* ------------------------------------------------------------------ */

export async function changeOwnPassword(
  actor: Actor,
  keepTokenHash: string,
  current: string,
  next: string,
  ipHash?: string,
) {
  await connectDb();
  const user = await AdminUserModel.findById(actor.id).select("+passwordHash");
  if (!user) throw notFound("User");

  if (!(await verifyPassword(current, user.passwordHash))) {
    throw validationFailed([{ path: "currentPassword", message: "Current password is incorrect" }]);
  }
  const problem = passwordProblem(next, { email: user.email });
  if (problem) throw validationFailed([{ path: "newPassword", message: problem }]);
  if (current === next) throw validationFailed([{ path: "newPassword", message: "Choose a different password" }]);

  await AdminUserModel.updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(next), passwordChangedAt: new Date() } },
  );
  // Sign out everywhere else: a changed password usually means the old one may be exposed.
  const revoked = await destroyUserSessions(actor.id, keepTokenHash);
  await audit({ actor, action: "change-password", resource: "auth", summary: `${revoked} other session(s) revoked`, ipHash });
}

export async function listOwnSessions(actorId: string, currentTokenHash: string) {
  await connectDb();
  const sessions = await SessionModel.find({ userId: new Types.ObjectId(actorId), expiresAt: { $gt: new Date() } })
    .sort({ lastUsedAt: -1 })
    .lean();
  return sessions.map((s) => ({
    id: String(s._id),
    current: s.tokenHash === currentTokenHash,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    userAgent: s.userAgent ?? null,
  }));
}

export async function revokeOwnSession(actorId: string, sessionId: string) {
  await connectDb();
  if (!/^[0-9a-fA-F]{24}$/.test(sessionId)) throw notFound("Session");
  const result = await SessionModel.deleteOne({ _id: sessionId, userId: new Types.ObjectId(actorId) });
  if (result.deletedCount === 0) throw notFound("Session");
}

/* ------------------------------------------------------------------ */
/* User management (admin)                                             */
/* ------------------------------------------------------------------ */

export async function listUsers() {
  await connectDb();
  return (await AdminUserModel.find().sort({ createdAt: 1 }).lean()).map(toUser);
}

/** Active users enquiries can be assigned to: names only, so triage staff need no user-management rights. */
export async function listAssignees() {
  await connectDb();
  const docs = await AdminUserModel.find({ active: true }).sort({ name: 1 }).select("name role").lean();
  return docs.map((doc) => ({ id: String(doc._id), name: doc.name, role: doc.role as Role }));
}

export async function getUser(id: string) {
  await connectDb();
  const doc = await AdminUserModel.findById(userId(id)).lean();
  if (!doc) throw notFound("User");
  return toUser(doc);
}

export async function createUser(
  input: { email: string; name: string; role: Role; password: string },
  actor: Actor | null,
  ipHash?: string,
) {
  await connectDb();
  const problem = passwordProblem(input.password, { email: input.email });
  if (problem) throw validationFailed([{ path: "password", message: problem }]);

  try {
    const doc = await AdminUserModel.create({
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    });
    await audit({ actor, action: "create", resource: "users", resourceId: String(doc._id), summary: input.email, ipHash });
    return toUser(doc.toObject() as Lean<AdminUserDoc>);
  } catch (error) {
    if (isDuplicateKeyError(error)) throw conflict("A user with this email already exists.", { field: "email" });
    throw error;
  }
}

/** Throws if removing/demoting/deactivating `target` would leave no active admin. */
async function assertNotLastAdmin(target: Types.ObjectId) {
  const others = await AdminUserModel.countDocuments({ _id: { $ne: target }, role: "admin", active: true });
  if (others === 0) throw conflict("This is the last active administrator and cannot be changed this way.");
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: Role; active?: boolean },
  actor: Actor,
  ipHash?: string,
) {
  await connectDb();
  const _id = userId(id);
  if (Object.keys(input).length === 0) {
    throw validationFailed([{ path: "", message: "Provide at least one field to update" }]);
  }

  const existing = await AdminUserModel.findById(_id).lean();
  if (!existing) throw notFound("User");

  const losingAdmin = existing.role === "admin" && existing.active && (input.role === "editor" || input.role === "sales" || input.active === false);
  if (losingAdmin) await assertNotLastAdmin(_id);
  if (input.active === false && id === actor.id) throw conflict("You cannot deactivate your own account.");

  const doc = await AdminUserModel.findByIdAndUpdate(_id, { $set: input }, { returnDocument: "after", lean: true });
  if (!doc) throw notFound("User");

  // A demoted or deactivated user shouldn't keep their old sessions.
  if (input.active === false || (input.role && input.role !== existing.role)) await destroyUserSessions(id);

  await audit({ actor, action: "update", resource: "users", resourceId: id, summary: existing.email, fields: Object.keys(input), ipHash });
  return toUser(doc);
}

export async function resetUserPassword(id: string, password: string, actor: Actor, ipHash?: string) {
  await connectDb();
  const _id = userId(id);
  const existing = await AdminUserModel.findById(_id).lean();
  if (!existing) throw notFound("User");

  const problem = passwordProblem(password, { email: existing.email });
  if (problem) throw validationFailed([{ path: "password", message: problem }]);

  await AdminUserModel.updateOne(
    { _id },
    {
      $set: { passwordHash: await hashPassword(password), passwordChangedAt: new Date(), failedLogins: 0 },
      $unset: { lockedUntil: "" },
    },
  );
  await destroyUserSessions(id);
  await audit({ actor, action: "reset-password", resource: "users", resourceId: id, summary: existing.email, ipHash });
}

export async function deleteUser(id: string, actor: Actor, ipHash?: string) {
  await connectDb();
  const _id = userId(id);
  if (id === actor.id) throw conflict("You cannot delete your own account.");

  const existing = await AdminUserModel.findById(_id).lean();
  if (!existing) throw notFound("User");
  if (existing.role === "admin" && existing.active) await assertNotLastAdmin(_id);

  await AdminUserModel.deleteOne({ _id });
  await destroyUserSessions(id);
  await audit({ actor, action: "delete", resource: "users", resourceId: id, summary: existing.email, ipHash });
}
