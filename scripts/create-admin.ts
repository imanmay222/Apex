import { ROLES, type Role } from "../src/server/db/models";
import { disconnectDb } from "../src/server/db/connect";
import { createUser } from "../src/server/services/users";

/** Usage: ADMIN_PASSWORD=... npm run create-admin -- --email you@example.com --name "Your Name" [--role admin|editor|sales] */
function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? process.env.ADMIN_EMAIL)?.toLowerCase();
  const name = arg("name") ?? process.env.ADMIN_NAME ?? "Administrator";
  const role = (arg("role") ?? "admin") as Role;
  const password = process.env.ADMIN_PASSWORD ?? arg("password");

  if (!email || !password) throw new Error("Provide --email and ADMIN_PASSWORD (or --password).");
  if (!ROLES.includes(role)) throw new Error(`--role must be one of: ${ROLES.join(", ")}`);

  const user = await createUser({ email, name, role, password }, null);
  console.log(`Created ${user.role} ${user.email}`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
