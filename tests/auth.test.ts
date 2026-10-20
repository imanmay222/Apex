import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { BASE, Client, adminClient, freshIp, purgeTestUsers, uid, userClient } from "./helpers";

let admin: Client;

before(async () => {
  admin = await adminClient();
});
after(async () => {
  await purgeTestUsers(admin);
});

describe("sign in", () => {
  it("rejects a wrong password with a generic message", async () => {
    const r = await new Client().login(process.env.ADMIN_EMAIL!, "definitely-wrong-password-1");
    assert.equal(r.status, 401);
    assert.equal(r.body.error.message, "Invalid email or password.");
  });

  it("gives an identical answer for unknown emails (no account enumeration)", async () => {
    const known = await new Client().login(process.env.ADMIN_EMAIL!, "definitely-wrong-password-1");
    const unknown = await new Client().login(`nobody-${uid()}@example.com`, "definitely-wrong-password-1");
    assert.equal(unknown.status, known.status);
    assert.deepEqual(unknown.body.error, known.body.error);
  });

  it("validates the body", async () => {
    const c = new Client();
    assert.equal((await c.post("/api/admin/auth/login", { email: "nope", password: "x" })).status, 422);
    assert.equal((await c.post("/api/admin/auth/login", { email: "a@b.co" })).status, 422);
    assert.equal((await c.post("/api/admin/auth/login", { email: "a@b.co", password: "x", extra: 1 })).status, 422);
  });

  it("sets a hardened session cookie and returns the user", async () => {
    const c = new Client();
    const r = await c.login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
    assert.equal(r.status, 200);
    const cookie = r.headers.getSetCookie().find((h) => h.startsWith("apex_session="))!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    assert.match(cookie, /Max-Age=\d+/);
    assert.equal(r.body.data.user.role, "admin");
    assert.ok(r.body.data.user.permissions.includes("users:manage"));
    assert.equal("passwordHash" in r.body.data.user, false);
  });

  it("throttles repeated attempts per IP+email", async () => {
    const c = new Client();
    const email = `nobody-${uid()}@example.com`;
    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) statuses.push((await c.login(email, "wrong-password-123")).status);
    assert.deepEqual(statuses.slice(0, 5), [401, 401, 401, 401, 401]);
    assert.equal(statuses[5], 429);
  });

  it("locks an account after repeated failures, even for the right password", async () => {
    const { email, password } = await userClient(admin, "editor");
    for (let i = 0; i < 10; i++) await new Client(freshIp()).login(email, "wrong-password-123");
    const locked = await new Client(freshIp()).login(email, password);
    assert.equal(locked.status, 401, "locked accounts must not authenticate");
    const listed = (await admin.get("/api/admin/users")).body.data.find((u: { email: string }) => u.email === email);
    assert.equal(listed.locked, true);
  });
});

describe("sessions", () => {
  it("rejects requests without credentials, with junk tokens, and with junk cookies", async () => {
    assert.equal((await new Client().get("/api/admin/auth/me")).status, 401);
    const junk = new Client();
    junk.token = "x".repeat(43);
    assert.equal((await junk.get("/api/admin/auth/me", { bearer: true })).status, 401);
    junk.cookies.set("apex_session", "x".repeat(43));
    assert.equal((await junk.get("/api/admin/auth/me")).status, 401);
  });

  it("accepts a Bearer token as well as the cookie", async () => {
    const r = await admin.get("/api/admin/auth/me", { bearer: true });
    assert.equal(r.status, 200);
    assert.equal(r.body.data.email, process.env.ADMIN_EMAIL!.toLowerCase());
  });

  it("logout invalidates the session server-side", async () => {
    const c = new Client();
    await c.login(process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);
    const token = c.token!;
    assert.equal((await c.post("/api/admin/auth/logout")).status, 204);
    assert.equal(c.cookies.size, 0, "cookie cleared");

    const replay = new Client();
    replay.token = token;
    assert.equal((await replay.get("/api/admin/auth/me", { bearer: true })).status, 401, "stolen token is dead after logout");
  });

  it("lists active sessions and revokes the others", async () => {
    const { client, email, password } = await userClient(admin, "editor");
    const other = new Client();
    await other.login(email, password);

    const sessions = await client.get("/api/admin/auth/sessions");
    assert.equal(sessions.body.data.length, 2);
    assert.equal(sessions.body.data.filter((s: { current: boolean }) => s.current).length, 1);

    const revoked = await client.del("/api/admin/auth/sessions");
    assert.equal(revoked.body.data.revoked, 1);
    assert.equal((await other.get("/api/admin/auth/me")).status, 401);
    assert.equal((await client.get("/api/admin/auth/me")).status, 200);
  });

  it("revokes one specific session", async () => {
    const { client, email, password } = await userClient(admin, "editor");
    const other = new Client();
    await other.login(email, password);
    const target = (await client.get("/api/admin/auth/sessions")).body.data.find((s: { current: boolean }) => !s.current);
    assert.equal((await client.del(`/api/admin/auth/sessions/${target.id}`)).status, 204);
    assert.equal((await other.get("/api/admin/auth/me")).status, 401);
    assert.equal((await client.del(`/api/admin/auth/sessions/${target.id}`)).status, 404);
  });
});

describe("CSRF protection", () => {
  it("blocks cookie-authenticated writes from other origins", async () => {
    const r = await admin.post("/api/admin/cache", undefined, { headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 403);
  });
  it("blocks cross-site fetch metadata", async () => {
    const r = await admin.post("/api/admin/cache", undefined, { headers: { "Sec-Fetch-Site": "cross-site" } });
    assert.equal(r.status, 403);
  });
  it("allows same-origin writes", async () => {
    const r = await admin.post("/api/admin/cache", undefined, { headers: { Origin: new URL(BASE).origin, "Sec-Fetch-Site": "same-origin" } });
    assert.equal(r.status, 200);
  });
  it("does not apply to Bearer clients (no ambient credentials)", async () => {
    const r = await admin.post("/api/admin/cache", undefined, { bearer: true, headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 200);
  });
  it("also guards the login form", async () => {
    const r = await new Client().post("/api/admin/auth/login", { email: "a@b.co", password: "x" }, { headers: { Origin: "https://evil.example" } });
    assert.equal(r.status, 403);
  });
});

describe("role-based access control", () => {
  const matrix: [string, string, string, number, number, number][] = [
    // label, method, path,                        admin editor sales
    ["content list", "GET", "/api/admin/content/products", 200, 200, 403],
    ["enquiries list", "GET", "/api/admin/enquiries", 200, 403, 200],
    ["dashboard", "GET", "/api/admin/dashboard", 200, 403, 200],
    ["analytics", "GET", "/api/admin/analytics", 200, 200, 200],
    ["media list", "GET", "/api/admin/media", 200, 200, 403],
    ["settings", "GET", "/api/admin/settings", 200, 403, 403],
    ["users", "GET", "/api/admin/users", 200, 403, 403],
    ["audit log", "GET", "/api/admin/audit", 200, 403, 403],
    ["content export", "GET", "/api/admin/export", 200, 403, 403],
    ["cache purge", "POST", "/api/admin/cache", 200, 403, 403],
  ];

  for (const [label, method, path, ...expected] of matrix) {
    it(`${label}: admin/editor/sales -> ${expected.join("/")}`, async () => {
      const editor = (await userClient(admin, "editor")).client;
      const sales = (await userClient(admin, "sales")).client;
      const got = [
        (await admin.request(method, path)).status,
        (await editor.request(method, path)).status,
        (await sales.request(method, path)).status,
      ];
      assert.deepEqual(got, expected);
    });
  }
});

describe("password change", () => {
  it("enforces current password and policy, then revokes other sessions", async () => {
    const { client, email, password } = await userClient(admin, "editor");
    const other = new Client();
    await other.login(email, password);

    assert.equal((await client.post("/api/admin/auth/change-password", { currentPassword: "wrong", newPassword: "Another-Strong-Pass-9" })).status, 422);
    assert.equal((await client.post("/api/admin/auth/change-password", { currentPassword: password, newPassword: "short1" })).status, 422);
    assert.equal((await client.post("/api/admin/auth/change-password", { currentPassword: password, newPassword: password })).status, 422);

    const next = `New-${uid()}-${uid()}-pw2`;
    assert.equal((await client.post("/api/admin/auth/change-password", { currentPassword: password, newPassword: next })).status, 204);

    assert.equal((await other.get("/api/admin/auth/me")).status, 401, "other sessions are signed out");
    assert.equal((await client.get("/api/admin/auth/me")).status, 200, "current session survives");
    assert.equal((await new Client().login(email, password)).status, 401);
    assert.equal((await new Client().login(email, next)).status, 200);
  });
});

describe("user management", () => {
  it("creates users without ever exposing hashes", async () => {
    const email = `test-new-${uid()}@apexcare.local`;
    const r = await admin.post("/api/admin/users", { email, name: "New Person", role: "sales", password: `Good-${uid()}-${uid()}-1` });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.role, "sales");
    assert.ok(!r.text.includes("passwordHash") && !r.text.includes("scrypt$"));
    const list = await admin.get("/api/admin/users");
    assert.ok(!list.text.includes("scrypt$"));
  });

  it("rejects duplicates, weak passwords and bad roles", async () => {
    const email = `test-dupe-${uid()}@apexcare.local`;
    const body = { email, name: "Dupe", role: "editor", password: `Good-${uid()}-${uid()}-1` };
    assert.equal((await admin.post("/api/admin/users", body)).status, 201);
    assert.equal((await admin.post("/api/admin/users", body)).status, 409);
    assert.equal((await admin.post("/api/admin/users", { ...body, email: `test-w-${uid()}@x.co`, password: "weak" })).status, 422);
    assert.equal((await admin.post("/api/admin/users", { ...body, email: `test-r-${uid()}@x.co`, role: "superuser" })).status, 422);
  });

  it("changes roles and deactivation takes effect immediately", async () => {
    const { client, id, email, password } = await userClient(admin, "sales");
    assert.equal((await client.get("/api/admin/enquiries")).status, 200);

    assert.equal((await admin.patch(`/api/admin/users/${id}`, { role: "editor" })).body.data.role, "editor");
    assert.equal((await client.get("/api/admin/auth/me")).status, 401, "role change signs the user out");

    const again = new Client();
    await again.login(email, password);
    assert.equal((await admin.patch(`/api/admin/users/${id}`, { active: false })).body.data.active, false);
    assert.equal((await again.get("/api/admin/auth/me")).status, 401);
    assert.equal((await new Client().login(email, password)).status, 401, "deactivated users cannot sign in");
  });

  it("resets a password and signs the user out everywhere", async () => {
    const { client, id, email, password } = await userClient(admin, "editor");
    const fresh = `Reset-${uid()}-${uid()}-pw3`;
    assert.equal((await admin.post(`/api/admin/users/${id}/reset-password`, { password: "weak" })).status, 422);
    assert.equal((await admin.post(`/api/admin/users/${id}/reset-password`, { password: fresh })).status, 204);
    assert.equal((await client.get("/api/admin/auth/me")).status, 401);
    assert.equal((await new Client().login(email, password)).status, 401);
    assert.equal((await new Client().login(email, fresh)).status, 200);
  });

  it("protects the last administrator and the acting user", async (t) => {
    // Only meaningful (and only safe) when the signed-in admin really is the sole active admin.
    const admins = (await admin.get("/api/admin/users")).body.data.filter((u: { role: string; active: boolean }) => u.role === "admin" && u.active);
    if (admins.length !== 1) return t.skip("more than one active administrator exists");
    const me = (await admin.get("/api/admin/auth/me")).body.data;
    assert.equal((await admin.patch(`/api/admin/users/${me.id}`, { role: "editor" })).status, 409);
    assert.equal((await admin.patch(`/api/admin/users/${me.id}`, { active: false })).status, 409);
    assert.equal((await admin.del(`/api/admin/users/${me.id}`)).status, 409);
  });

  it("handles unknown ids cleanly", async () => {
    assert.equal((await admin.get("/api/admin/users/000000000000000000000000")).status, 404);
    assert.equal((await admin.get("/api/admin/users/garbage")).status, 404);
  });
});
