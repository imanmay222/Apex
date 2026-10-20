import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/*
 * scrypt via node:crypto — no native add-ons, so it installs cleanly on Alpine.
 * Stored as: scrypt$N$r$p$salt(b64)$hash(b64) so parameters can be raised later and old
 * hashes still verify.
 */

const N = 1 << 15; // 32 MiB at r=8
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 128 * N * R * 2;

function derive(password: string, salt: Buffer, keyLength: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P, maxmem: MAX_MEM });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !r || !p || !salt || !hash) return false;

  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: MAX_MEM,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same CPU as a real verification. Called when the email doesn't exist so response
 * time doesn't reveal which accounts are registered.
 */
export async function verifyAgainstDummy(password: string): Promise<void> {
  dummyHash ??= hashPassword("timing-equaliser-not-a-real-password");
  await verifyPassword(password, await dummyHash);
}

const COMMON = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "administrator",
  "welcome12345",
  "changeme1234",
  "letmein12345",
]);

/** Returns a human-readable problem, or null if the password is acceptable. */
export function passwordProblem(password: string, context: { email?: string } = {}): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  if (COMMON.has(password.toLowerCase())) return "That password is too common.";
  if (context.email && password.toLowerCase().includes(context.email.split("@")[0].toLowerCase())) {
    return "Password must not contain your email name.";
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must contain both letters and numbers.";
  }
  return null;
}
