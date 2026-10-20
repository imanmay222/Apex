import { disconnectDb } from "../src/server/db/connect";
import { runSeed, syncIndexes } from "../src/server/seed/run";

const args = new Set(process.argv.slice(2));
const log = (message: string) => console.log(`  ${message}`);

async function main() {
  if (args.has("--indexes-only")) {
    console.log("Syncing indexes…");
    await syncIndexes(log);
    return;
  }

  console.log(args.has("--reset") ? "Seeding (RESET: replacing all content)…" : "Seeding (add missing only)…");
  await runSeed({ reset: args.has("--reset"), log });
  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
