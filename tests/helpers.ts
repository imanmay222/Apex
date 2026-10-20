import { randomBytes } from "node:crypto";

export const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000";
export const MAILPIT = process.env.MAILPIT_URL ?? "http://localhost:8025";

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A unique, valid-looking IPv4 so each test gets its own rate-limit buckets. */
export const freshIp = () => `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${(randomBytes(1)[0] % 250) + 1}`;

export const uid = () => randomBytes(4).toString("hex");

export interface Reply<T = any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  status: number;
  headers: Headers;
  body: T;
  text: string;
}

interface Options {
  json?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  /** Send `Authorization: Bearer` instead of the cookie. */
  bearer?: boolean;
  /** Don't send credentials at all. */
  anonymous?: boolean;
}

/** Minimal API client with a cookie jar and a stable client IP. */
export class Client {
  cookies = new Map<string, string>();
  token: string | null = null;
  constructor(public ip = freshIp()) {}

  async request<T = any>(method: string, path: string, opts: Options = {}): Promise<Reply<T>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const headers: Record<string, string> = { "X-Forwarded-For": this.ip, ...opts.headers };
    let body: BodyInit | undefined;

    if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    } else if (opts.form) {
      body = opts.form;
    }

    if (!opts.anonymous) {
      if (opts.bearer && this.token) headers.Authorization = `Bearer ${this.token}`;
      else if (this.cookies.size) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
    }

    const response = await fetch(`${BASE}${path}`, { method, headers, body, redirect: "manual" });
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const [name, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (value === "" || /max-age=0/i.test(raw)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }

    // Decode from raw bytes: fetch().text() would silently strip a UTF-8 BOM we want to assert on.
    const text = Buffer.from(await response.arrayBuffer()).toString("utf8");
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body (CSV, HTML, redirects) */
    }
    return { status: response.status, headers: response.headers, body: parsed as T, text };
  }

  get = <T = any>(path: string, opts?: Options) => this.request<T>("GET", path, opts); // eslint-disable-line @typescript-eslint/no-explicit-any
  post = <T = any>(path: string, json?: unknown, opts?: Options) => this.request<T>("POST", path, { json, ...opts }); // eslint-disable-line @typescript-eslint/no-explicit-any
  patch = <T = any>(path: string, json?: unknown, opts?: Options) => this.request<T>("PATCH", path, { json, ...opts }); // eslint-disable-line @typescript-eslint/no-explicit-any
  del = <T = any>(path: string, opts?: Options) => this.request<T>("DELETE", path, opts); // eslint-disable-line @typescript-eslint/no-explicit-any

  async login(email: string, password: string): Promise<Reply> {
    const reply = await this.post("/api/admin/auth/login", { email, password });
    if (reply.status === 200) this.token = reply.body.data.token;
    return reply;
  }
}

/** Signs in as the seeded administrator (credentials come from the container's .env). */
export async function adminClient(): Promise<Client> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD must be set to run the API tests");
  const client = new Client();
  const reply = await client.login(email, password);
  if (reply.status !== 200) throw new Error(`Admin login failed (${reply.status}): ${reply.text}`);
  return client;
}

/** Creates a throwaway user with the given role and returns a signed-in client for it. */
export async function userClient(admin: Client, role: "admin" | "editor" | "sales") {
  const email = `test-${role}-${uid()}@apexcare.local`;
  const password = `Test-${uid()}-${uid()}-pw1`;
  const created = await admin.post("/api/admin/users", { email, name: `Test ${role}`, role, password });
  if (created.status !== 201) throw new Error(`Could not create ${role}: ${created.text}`);
  const client = new Client();
  const login = await client.login(email, password);
  if (login.status !== 200) throw new Error(`Could not sign in as ${role}: ${login.text}`);
  return { client, id: created.body.data.id as string, email, password };
}

/** Fetches a form token and waits out the server's minimum fill time. */
export async function readyToken(client: Client): Promise<string> {
  const reply = await client.get("/api/enquiries/token");
  await sleep(2_200);
  return reply.body.data.token;
}

/* ---------------------------------------------------------------- Mailpit */

export interface MailSummary {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  Snippet: string;
}

export const mailpit = {
  async clear() {
    await fetch(`${MAILPIT}/api/v1/messages`, { method: "DELETE" });
  },
  async list(): Promise<MailSummary[]> {
    const response = await fetch(`${MAILPIT}/api/v1/messages`);
    return ((await response.json()) as { messages: MailSummary[] }).messages ?? [];
  },
  /** Polls until a message matching `predicate` arrives (delivery runs after the HTTP response). */
  async waitFor(predicate: (m: MailSummary) => boolean, timeoutMs = 15_000): Promise<MailSummary> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const found = (await this.list()).find(predicate);
      if (found) return found;
      await sleep(400);
    }
    throw new Error("Timed out waiting for an email");
  },
  async body(id: string): Promise<{ Text: string; HTML: string; ReplyTo?: { Address: string }[] }> {
    return (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json() as Promise<{ Text: string; HTML: string }>;
  },
};

/** Removes every enquiry whose message contains the marker the tests embed. */
export async function purgeTestEnquiries(admin: Client, marker = "apex-test") {
  const all = "new,contacted,quoted,won,lost,spam,archived";
  const list = await admin.get(`/api/admin/enquiries?q=${marker}&status=${all}&limit=100`);
  const ids = (list.body?.data ?? []).map((e: { id: string }) => e.id);
  if (ids.length) await admin.post("/api/admin/enquiries/bulk", { action: "delete", ids });
}

/* A minimal valid 1x1 PNG. */
export const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Deletes users created by the tests (emails start with "test-"). */
export async function purgeTestUsers(admin: Client) {
  const users = await admin.get("/api/admin/users");
  for (const user of users.body?.data ?? []) {
    if (user.email.startsWith("test-")) await admin.del(`/api/admin/users/${user.id}`);
  }
}
