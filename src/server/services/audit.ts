import { Types } from "mongoose";
import { connectDb } from "../db/connect";
import { AuditModel } from "../db/models";
import { errorFields, logger } from "../lib/logger";

export interface Actor {
  id: string;
  email: string;
}

interface AuditEntry {
  actor: Actor | null;
  action: string;
  resource: string;
  resourceId?: string;
  summary?: string;
  fields?: string[];
  ipHash?: string;
}

/**
 * Records an admin action. Never throws: a failed audit write must not roll back or fail the
 * change it describes, but it is logged loudly.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await connectDb();
    await AuditModel.create({
      actorId: entry.actor ? new Types.ObjectId(entry.actor.id) : undefined,
      actorEmail: entry.actor?.email,
      action: entry.action,
      resource: entry.resource,
      resourceId: entry.resourceId,
      summary: entry.summary?.slice(0, 300),
      fields: entry.fields ?? [],
      ipHash: entry.ipHash,
    });
  } catch (error) {
    logger.error("audit write failed", { action: entry.action, resource: entry.resource, ...errorFields(error) });
  }
}
