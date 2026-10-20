const TRANSLITERATE: Record<string, string> = {
  ä: "ae", ö: "oe", ü: "ue", Ä: "ae", Ö: "oe", Ü: "ue", ß: "ss", æ: "ae", œ: "oe", ø: "o", đ: "d", ł: "l",
};

/** URL-safe kebab-case slug. "Dräger X-plore 8000" -> "draeger-x-plore-8000". */
export function slugify(input: string): string {
  return input
    .replace(/[äöüÄÖÜßæœøđł]/g, (char) => TRANSLITERATE[char] ?? char)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Removes CR/LF so a value can never inject extra mail headers or log lines. */
export function singleLine(input: string): string {
  return input.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
}

/** Escapes a CSV cell and neutralises spreadsheet formula injection (=, +, -, @, tab, CR). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  // Plain phone/number-looking values ("+919876543210") can't carry a formula payload; leave them intact.
  const looksNumeric = /^[+-]?\d[\d\s().-]*$/.test(text);
  if (!looksNumeric && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Splits a free-text query into lowercase search tokens. */
export function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 6);
}

export function maskMobile(mobile: string): string {
  return mobile.length <= 4 ? "****" : `${"*".repeat(mobile.length - 4)}${mobile.slice(-4)}`;
}
