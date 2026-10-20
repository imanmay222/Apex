import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { MongoMemoryServer } from "mongodb-memory-server";

/**
 * A real mongod, started from an npm-managed binary (no system install, no Docker).
 * The binary is downloaded once into node_modules/.cache and reused.
 */
export interface DevMongo {
  uri: string;
  stop(): Promise<void>;
}

export async function startMongo(opts: { port?: number; dataDir?: string; dbName?: string } = {}): Promise<DevMongo> {
  const dbName = opts.dbName ?? "apex";
  const dbPath = opts.dataDir ? resolve(opts.dataDir) : undefined;
  if (dbPath) mkdirSync(dbPath, { recursive: true });

  const server = await MongoMemoryServer.create({
    binary: { version: process.env.MONGOMS_VERSION ?? "8.0.4" },
    instance: { ip: "127.0.0.1", port: opts.port, dbName, ...(dbPath ? { dbPath, storageEngine: "wiredTiger" as const } : {}) },
  });

  return {
    uri: `${server.getUri().replace(/\/$/, "")}/${dbName}`,
    // doCleanup:false keeps a persistent data directory intact.
    stop: async () => {
      await server.stop({ doCleanup: !dbPath });
    },
  };
}
