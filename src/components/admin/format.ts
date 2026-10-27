/* Display helpers shared by the admin screens. Dates render in India time, where the team works. */

const TZ = "Asia/Kolkata";

export function formatDate(iso: string | null | undefined, withTime = true): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** "5 min ago", "3 h ago", "2 days ago", then the date. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(iso, false);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const formatNumber = (value: number) => value.toLocaleString("en-IN");

export const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** YYYY-MM-DD for <input type="date"> in local time. */
export function dateInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export const ENQUIRY_STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quote sent",
  won: "Won",
  lost: "Lost",
  spam: "Spam",
  archived: "Archived",
};

export const ENQUIRY_TYPE_LABELS: Record<string, string> = {
  products: "Product",
  survey: "Survey",
  training: "Training",
  general: "General",
};

export const ROLE_LABELS: Record<string, string> = { admin: "Administrator", editor: "Editor", sales: "Sales" };

/** Public page for an enquiry subject, when it has one. */
export function subjectUrl(type: string, slug: string): string | null {
  if (type === "products") return `/products/${slug}`;
  if (type === "survey") return `/survey/${slug}`;
  if (type === "training") return "/training";
  return null;
}
