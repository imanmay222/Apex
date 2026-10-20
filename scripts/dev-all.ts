import { spawn } from "node:child_process";
import { disconnectDb } from "../src/server/db/connect";
import { runSeed } from "../src/server/seed/run";
import { startMongo } from "./lib/dev-mongo";
import { startMailSink } from "./lib/mail-sink";

/**
 * One command for local development: MongoDB (persistent, in .data/mongo) + mail catcher +
 * idempotent seed + `next dev`. Ctrl+C stops everything; your data is kept.
 */
async function main() {
  try {
    process.loadEnvFile(".env");
  } catch {
    console.warn("No .env found: copy .env.example to .env first.");
    process.exit(1);
  }

  console.log("▸ MongoDB…");
  const mongo = await startMongo({ port: 27017, dataDir: ".data/mongo" });
  process.env.MONGODB_URI = mongo.uri;

  console.log("▸ mail catcher…");
  const mail = await startMailSink({ smtpPort: 1025, httpPort: 8025, quiet: false });
  process.env.SMTP_HOST = "127.0.0.1";
  process.env.SMTP_PORT = String(mail.smtpPort);

  console.log("▸ seeding (only adds what is missing)…");
  await runSeed({ log: (m) => console.log(`    ${m}`) });
  await disconnectDb();

  const email = process.env.ADMIN_EMAIL;
  console.log(`
  Site            http://localhost:3000
  Mail inbox      http://127.0.0.1:${mail.httpPort}     (every email the site sends lands here)
  MongoDB         ${mongo.uri}
  Admin API       sign in with ${email} / ADMIN_PASSWORD from .env   (POST /api/admin/auth/login)
`);

  const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "-p", "3000"], { stdio: "inherit", env: process.env });

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    console.log("\nStopping…");
    next.kill("SIGTERM");
    await mail.stop();
    await mongo.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  next.once("exit", stop);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
