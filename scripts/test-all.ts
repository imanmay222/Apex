import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
import { createServer } from "node:net";
import { startMailSink } from "./lib/mail-sink";
import { startMongo } from "./lib/dev-mongo";

/**
 * Hermetic test run: throw-away MongoDB + mail catcher + a real Next.js server on free ports,
 * so tests never touch your development data. Everything is torn down afterwards.
 *
 *   npm test                  build + serve + run every suite
 *   npm test -- --dev         serve with `next dev` instead of a production build
 *   npm test -- --no-build    reuse the previous test build
 *   npm test -- auth media    only the suites whose file name contains these words
 */

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const filters = args.filter((a) => !a.startsWith("--"));

const NEXT = "node_modules/next/dist/bin/next";

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });

function run(cmd: string, cmdArgs: string[], env: NodeJS.ProcessEnv, label: string): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { env, stdio: "inherit" });
    child.once("exit", (code) => resolve(code ?? 1));
    child.once("error", (error) => {
      console.error(`${label} failed to start:`, error.message);
      resolve(1);
    });
  });
}

async function waitForHealth(url: string, child: ChildProcess, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("the server exited before becoming healthy");
    try {
      if ((await fetch(`${url}/api/health`)).status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("timed out waiting for /api/health");
}

async function main(): Promise<number> {
  console.log("▸ starting throw-away MongoDB (first run downloads the mongod binary)…");
  const mongo = await startMongo({ dbName: "apex_test" });
  const mail = await startMailSink({ quiet: true });
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const adminPassword = `Test-${randomBytes(6).toString("hex")}-${randomBytes(4).toString("hex")}`;
  const env = {
    // Inherit the shell environment except NODE_ENV: each Next command sets its own.
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => key !== "NODE_ENV")),
    MONGODB_URI: mongo.uri,
    SESSION_SECRET: randomBytes(32).toString("hex"),
    CRON_SECRET: randomBytes(24).toString("hex"),
    PUBLIC_SITE_URL: baseUrl,
    TRUST_PROXY: "true",
    LOG_LEVEL: "warn",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(mail.smtpPort),
    SMTP_SECURE: "false",
    MAIL_FROM: "Apex Care Technologies <no-reply@apexcare.local>",
    SALES_EMAIL: "sales@apexcare.local",
    AUTO_REPLY: "true",
    ADMIN_EMAIL: "admin@apexcare.local",
    ADMIN_NAME: "Site Administrator",
    ADMIN_PASSWORD: adminPassword,
    ENQUIRY_WEBHOOK_URL: "",
    ENQUIRY_WEBHOOK_SECRET: "",
    NEXT_DIST_DIR: ".next-test",
    NEXT_TELEMETRY_DISABLED: "1",
    TEST_BASE_URL: baseUrl,
    MAILPIT_URL: `http://127.0.0.1:${mail.httpPort}`,
  } as unknown as NodeJS.ProcessEnv; // typed env requires NODE_ENV; each command sets its own

  let server: ChildProcess | undefined;
  let code = 1;

  try {
    console.log("▸ seeding…");
    if ((await run(process.execPath, ["--import", "tsx", "scripts/seed.ts"], env, "seed")) !== 0) return 1;

    if (flags.has("--dev")) {
      console.log("▸ starting next dev…");
      server = spawn(process.execPath, [NEXT, "dev", "-p", String(port), "-H", "127.0.0.1"], { env: { ...env, NODE_ENV: "development" }, stdio: "ignore" });
    } else {
      if (!flags.has("--no-build")) {
        console.log("▸ building (next build)…");
        if ((await run(process.execPath, [NEXT, "build"], env, "build")) !== 0) return 1;
      }
      console.log("▸ starting next start…");
      server = spawn(process.execPath, [NEXT, "start", "-p", String(port), "-H", "127.0.0.1"], { env, stdio: "ignore" });
    }
    await waitForHealth(baseUrl, server);
    console.log(`▸ server ready at ${baseUrl}\n`);

    const files = readdirSync("tests")
      .filter((f) => f.endsWith(".test.ts"))
      .filter((f) => filters.length === 0 || filters.some((word) => f.includes(word)))
      .map((f) => `tests/${f}`);
    if (files.length === 0) throw new Error(`no test files match: ${filters.join(", ")}`);

    code = await run(process.execPath, ["--import", "tsx", "--test", "--test-concurrency=1", ...files], env, "tests");
  } catch (error) {
    console.error("\nTest run aborted:", error instanceof Error ? error.message : error);
  } finally {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (server.exitCode === null) server.kill("SIGKILL");
    }
    await mail.stop();
    await mongo.stop();
  }
  return code;
}

main().then((code) => process.exit(code));
