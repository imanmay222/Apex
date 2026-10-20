import mongoose from "mongoose";
import { env } from "../config/env";
import { logger, errorFields } from "../lib/logger";

type Mongoose = typeof mongoose;

declare global {
  var __apexMongo: { conn: Mongoose | null; promise: Promise<Mongoose> | null } | undefined;
}

// Cached on globalThis so dev HMR and separate route bundles share one connection pool.
const state = (globalThis.__apexMongo ??= { conn: null, promise: null });

export async function connectDb(): Promise<Mongoose> {
  if (state.conn && mongoose.connection.readyState === 1) return state.conn;

  if (!state.promise) {
    const config = env();

    mongoose.set("strictQuery", true);

    state.promise = mongoose
      .connect(config.mongodbUri, {
        // Fail fast instead of queueing operations while the DB is unreachable.
        bufferCommands: false,
        serverSelectionTimeoutMS: 5_000,
        connectTimeoutMS: 5_000,
        socketTimeoutMS: 30_000,
        maxPoolSize: 10,
        autoIndex: config.mongoAutoIndex,
      })
      .then((connected) => {
        logger.info("mongodb connected", { db: connected.connection.name });
        return connected;
      })
      .catch((error) => {
        state.promise = null;
        logger.error("mongodb connection failed", errorFields(error));
        throw error;
      });
  }

  state.conn = await state.promise;
  return state.conn;
}

export async function disconnectDb(): Promise<void> {
  if (state.conn || mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  state.conn = null;
  state.promise = null;
}

/** Round-trips a ping so health checks reflect real connectivity. */
export async function pingDb(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const started = Date.now();
  try {
    const connected = await connectDb();
    await connected.connection.db!.admin().ping();
    return { ok: true, latencyMs: Date.now() - started };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function getMediaBucket() {
  const connected = await connectDb();
  return new connected.mongo.GridFSBucket(connected.connection.db!, { bucketName: "media" });
}
