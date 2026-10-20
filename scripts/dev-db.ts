import { startMongo } from "./lib/dev-mongo";

const port = Number(process.env.DEV_DB_PORT ?? 27017);

async function main() {
  console.log("Starting local MongoDB (first run downloads the mongod binary, ~100-200 MB)…");
  const db = await startMongo({ port, dataDir: ".data/mongo" });
  console.log(`\nMongoDB is running.\n  MONGODB_URI=${db.uri}\n  data: .data/mongo   (Ctrl+C to stop; data is kept)\n`);

  const shutdown = async () => {
    console.log("\nStopping MongoDB…");
    await db.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  setInterval(() => undefined, 1 << 30); // keep the process alive
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
