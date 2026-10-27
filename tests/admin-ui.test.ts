import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { BASE, Client, PNG_1X1, adminClient, purgeTestEnquiries, purgeTestUsers, readyToken, uid, userClient } from "./helpers";

/**
 * The admin panel in a real browser: sign-in and route protection, the enquiry inbox, content
 * editing that goes live on the public site, testimonial moderation, settings, the media library
 * and role-based access. Drives your installed Google Chrome against the running app.
 */

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MARK = `zz-admin-${uid()}`;

let browser: Browser;
let admin: Client;
let session: { context: BrowserContext; page: Page; problems: string[] };

const email = () => process.env.ADMIN_EMAIL!;
const password = () => process.env.ADMIN_PASSWORD!;

async function open(opts: { mobile?: boolean } = {}) {
  const context = await browser.newContext({
    userAgent: CHROME_UA,
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1366, height: 900 },
    isMobile: opts.mobile,
    hasTouch: opts.mobile,
    reducedMotion: "reduce",
    extraHTTPHeaders: { "X-Forwarded-For": `10.77.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` },
  });
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  // 401s are expected while signed out (badge probes on the sign-in redirect); anything else is a bug.
  page.on("response", (r) => r.status() >= 400 && r.status() !== 401 && problems.push(`http ${r.status()}: ${r.url()}`));
  return { context, page, problems };
}

async function signIn(page: Page, user = email(), pass = password()) {
  await page.goto(`${BASE}/admin/login`);
  await page.getByLabel("Email").fill(user);
  await page.getByLabel("Password").fill(pass);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/admin(?:\?|$)/);
}

before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true }).catch((error: Error) => {
    throw new Error(`Could not start Google Chrome for the browser tests: ${error.message}`);
  });
  admin = await adminClient();
  session = await open();
  await signIn(session.page);
});

after(async () => {
  await session?.context.close();
  await browser?.close();
  for (const resource of ["products", "testimonials"]) {
    const list = await admin.get(`/api/admin/content/${resource}?q=${MARK}&limit=50`);
    for (const item of list.body?.data ?? []) await admin.del(`/api/admin/content/${resource}/${item.id}`);
  }
  const media = await admin.get(`/api/admin/media?q=${MARK}&limit=50`);
  for (const item of media.body?.data ?? []) await admin.del(`/api/admin/media/${item.id}?force=true`);
  await purgeTestEnquiries(admin, MARK);
  await purgeTestUsers(admin);
});

/* -------------------------------------------------------------------------------------------- */

describe("admin sign-in and route protection", () => {
  it("sends signed-out visitors to the sign-in page and back after signing in", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/admin/enquiries?status=new`);
    await page.waitForURL(/\/admin\/login\?next=/);
    assert.equal(new URL(page.url()).searchParams.get("next"), "/admin/enquiries?status=new");

    await page.getByLabel("Email").fill(email());
    await page.getByLabel("Password").fill("definitely-not-the-password-1");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("alert").filter({ hasText: /incorrect|invalid/i }).waitFor();

    await page.getByLabel("Password").fill(password());
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/admin\/enquiries\?status=new/);
    await page.getByRole("heading", { name: "Enquiries" }).waitFor();
    await context.close();
  });

  it("rejects a forged session cookie on the server, not just in the browser", async () => {
    const response = await fetch(`${BASE}/admin`, { headers: { Cookie: `apex_session=${"x".repeat(40)}` }, redirect: "manual" });
    assert.equal(response.status, 307);
    assert.match(response.headers.get("location") ?? "", /\/admin\/login/);
  });

  it("never redirects off-site after sign-in", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/admin/login?next=https://evil.example/x`);
    await page.getByLabel("Email").fill(email());
    await page.getByLabel("Password").fill(password());
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${BASE}/admin`);
    await context.close();
  });

  it("is kept out of search engines", async () => {
    const robots = await (await fetch(`${BASE}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    const login = await fetch(`${BASE}/admin/login`);
    assert.match(login.headers.get("x-robots-tag") ?? "", /noindex/);
  });

  it("signs out on the server", async () => {
    const { context, page } = await open();
    await signIn(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL(/\/admin\/login/);
    await page.goto(`${BASE}/admin`);
    await page.waitForURL(/\/admin\/login/);
    await context.close();
  });
});

describe("every admin page loads cleanly", () => {
  const pages = ["/admin", "/admin/enquiries", "/admin/content", "/admin/content/products", "/admin/content/products/new", "/admin/content/testimonials?view=pending", "/admin/media", "/admin/settings", "/admin/analytics", "/admin/subscribers", "/admin/users", "/admin/audit", "/admin/system", "/admin/account"];
  for (const path of pages) {
    it(`${path}: renders without errors`, async () => {
      const { page, problems } = session;
      problems.length = 0;
      await page.goto(`${BASE}${path}`);
      await page.locator("main h1").first().waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal(await page.getByRole("alert").filter({ hasText: /failed|wrong/i }).count(), 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `horizontal overflow of ${overflow}px`);
      assert.deepEqual(problems, []);
    });
  }
});

describe("enquiries: what customers send reaches the team", () => {
  let id = "";
  let reference = "";

  it("a website enquiry shows up in the inbox with the customer's message", async () => {
    const visitor = new Client();
    const token = await readyToken(visitor);
    const sent = await visitor.post("/api/enquiries", {
      name: `${MARK} Plant Manager`,
      mobile: "9876501234",
      email: `buyer-${uid()}@example.com`,
      type: "products",
      subject: "scba",
      message: `Need 20 SCBA sets with training for our refinery crew. apex-test ${MARK}`,
      token,
    });
    assert.equal(sent.status, 201, sent.text);
    reference = sent.body.data.reference;

    const { page } = session;
    await page.goto(`${BASE}/admin/enquiries`);
    await page.getByRole("searchbox").fill(MARK);
    const row = page.locator("tr", { hasText: reference });
    await row.waitFor();
    assert.match(await row.textContent() ?? "", /New/);
    assert.match(await row.textContent() ?? "", /Need 20 SCBA sets/);

    await row.getByRole("link", { name: `${MARK} Plant Manager` }).click();
    await page.waitForURL(/\/admin\/enquiries\/[0-9a-f]{24}$/);
    id = page.url().split("/").pop()!;
    await page.getByText("Need 20 SCBA sets with training").waitFor();
    await page.getByText("+919876501234").first().waitFor();
    await page.getByRole("link", { name: /Self Contained Breathing Apparatus/ }).waitFor();
  });

  it("is triaged from the detail page: status, assignee, note, tags", async () => {
    const { page } = session;
    await page.getByLabel("Status", { exact: true }).selectOption("contacted");
    await page.getByText("Status set to “Contacted”.").waitFor();
    await page.getByRole("button", { name: "Me", exact: true }).click();
    await page.getByText("Assigned to you.").waitFor();
    await page.getByLabel("New note").fill(`Called back, quoting Friday ${MARK}`);
    await page.getByRole("button", { name: "Add note" }).click();
    await page.getByText(`Called back, quoting Friday ${MARK}`).waitFor();
    await page.getByLabel("Tags").fill("refinery, bulk");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Tags saved.").waitFor();

    const stored = (await admin.get(`/api/admin/enquiries/${id}`)).body.data;
    assert.equal(stored.status, "contacted");
    assert.ok(stored.assignedTo);
    assert.ok(stored.firstResponseAt);
    assert.deepEqual(stored.tags, ["refinery", "bulk"]);
    assert.equal(stored.notes.length, 1);

    // The customer's tracker reflects the change.
    const tracked = await new Client().post("/api/enquiries/track", { reference, mobile: "9876501234" });
    assert.equal(tracked.body.data.status, "In progress");
  });

  it("filters, bulk-updates and exports", async () => {
    const { page } = session;
    await page.goto(`${BASE}/admin/enquiries?status=contacted&q=${MARK}`);
    await page.locator("tr", { hasText: reference }).waitFor();
    await page.getByLabel(`Select ${reference}`).check();
    await page.getByLabel("Set status").selectOption("quoted");
    await page.getByText(/Updated 1 enquiry/).waitFor();
    assert.equal((await admin.get(`/api/admin/enquiries/${id}`)).body.data.status, "quoted");

    const href = await page.getByRole("link", { name: "Export CSV" }).getAttribute("href");
    assert.match(href ?? "", /\/api\/admin\/enquiries\/export\?/);
    const csv = await page.request.get(`${BASE}${href}`);
    assert.equal(csv.status(), 200);
    assert.match(csv.headers()["content-type"], /text\/csv/);
  });

  it("appears on the dashboard", async () => {
    const { page } = session;
    await page.goto(`${BASE}/admin`);
    await page.getByText("Latest enquiries").waitFor();
    await page.getByText(`${MARK} Plant Manager`).waitFor();
  });
});

describe("content editing goes live on the website", () => {
  const title = `${MARK} Arc Flash Kit`;
  let slug = "";

  it("creates a product that appears on the public site", async () => {
    const { page } = session;
    await page.goto(`${BASE}/admin/content/products/new`);
    await page.locator("#field-title").fill(title);
    await page.getByLabel("Product group").selectOption({ index: 1 });
    await page.getByLabel("Summary").fill("Category 4 arc flash suits, hoods and gloves.");
    await page.locator("#field-image").fill("/media/products/head-production.png");
    await page.getByLabel("Image description (alt text)").fill("Arc flash kit");
    await page.getByRole("button", { name: "Create product" }).click();
    await page.waitForURL(/\/admin\/content\/products\/[0-9a-f]{24}$/);
    await page.getByText("Created product.").waitFor();

    slug = (await admin.get(`/api/admin/content/products?q=${MARK}`)).body.data[0].slug;
    const live = await fetch(`${BASE}/products/${slug}`);
    assert.equal(live.status, 200);
    assert.match(await live.text(), new RegExp(title));
  });

  it("an edit is visible immediately, and hiding takes it off the site", async () => {
    const { page } = session;
    await page.getByLabel("Summary").fill("Updated: CAT 4 arc flash protection, tested to IEC 61482.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.getByText("Saved — the website is updated.").waitFor();
    assert.match(await (await fetch(`${BASE}/products/${slug}`)).text(), /tested to IEC 61482/);

    await page.goto(`${BASE}/admin/content/products`);
    await page.getByRole("searchbox").fill(MARK);
    const row = page.locator("li", { hasText: title });
    await row.getByRole("button", { name: "Hide" }).click();
    await page.getByText("Hidden from the website.").waitFor();
    assert.equal((await fetch(`${BASE}/products/${slug}`)).status, 404);
  });

  it("deletes from the editor", async () => {
    const { page } = session;
    await page.locator("li", { hasText: title }).getByRole("link", { name: "Edit" }).click();
    await page.getByRole("button", { name: /Delete product/ }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.waitForURL(/\/admin\/content\/products$/);
    assert.equal((await admin.get(`/api/admin/content/products?q=${MARK}`)).body.data.length, 0);
  });
});

describe("testimonial moderation", () => {
  it("approving a website submission publishes it on the About page", async () => {
    const visitor = new Client();
    const token = await readyToken(visitor);
    const name = `${MARK} Safety Officer`;
    const sent = await visitor.post("/api/testimonials", {
      name,
      company: "Coastal Chemicals",
      quote: "Their survey caught gaps our last audit missed, and the training was excellent.",
      rating: 5,
      token,
    });
    assert.equal(sent.status, 201, sent.text);
    assert.doesNotMatch(await (await fetch(`${BASE}/about`)).text(), new RegExp(name));

    const { page } = session;
    await page.goto(`${BASE}/admin/content/testimonials?view=pending`);
    const row = page.locator("li", { hasText: name });
    await row.waitFor();
    await row.getByRole("button", { name: "Approve" }).click();
    await page.getByText("Published — it's live on the website.").waitFor();
    assert.match(await (await fetch(`${BASE}/about`)).text(), new RegExp(name));
  });
});

describe("site settings", () => {
  it("saving a section updates the home page", async () => {
    const original = (await admin.get("/api/admin/settings")).body.data.home.heroBadge;
    const { page } = session;
    try {
      await page.goto(`${BASE}/admin/settings`);
      await page.getByLabel("Badge").fill(`Badge ${MARK}`);
      const card = page.locator("section", { has: page.getByText("Home page banner") });
      await card.getByRole("button", { name: "Save" }).click();
      await page.getByText("Home page banner saved").waitFor();
      assert.match(await (await fetch(`${BASE}/`)).text(), new RegExp(`Badge ${MARK}`));
    } finally {
      await admin.patch("/api/admin/settings", { home: { heroBadge: original } });
    }
  });

  it("the catalogue download serves the configured PDF", async () => {
    const response = await fetch(`${BASE}/api/catalogue?from=/products`, { redirect: "manual" });
    assert.equal(response.status, 302);
    const file = await fetch(new URL(response.headers.get("location")!, BASE));
    assert.equal(file.status, 200);
    assert.match(file.headers.get("content-type") ?? "", /application\/pdf/);
  });
});

describe("media library", () => {
  it("uploads, describes and deletes a file", async () => {
    const { page } = session;
    await page.goto(`${BASE}/admin/media`);
    await page.locator('input[type="file"]').setInputFiles({ name: `${MARK}.png`, mimeType: "image/png", buffer: PNG_1X1 });
    await page.getByText(/Uploaded “|already in the library/).waitFor();
    await page.getByRole("searchbox").fill(MARK);
    await page.getByRole("button", { name: new RegExp(`${MARK}\\.png`) }).click();
    await page.getByLabel("Description (alt text)").fill("Test pixel");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Description saved.").waitFor();

    await page.getByRole("button", { name: new RegExp(`${MARK}\\.png`) }).click();
    await page.getByRole("button", { name: /Delete file/ }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.getByText(new RegExp(`Deleted “${MARK}`)).waitFor();
  });
});

describe("roles", () => {
  it("a sales user sees enquiries but not content or users", async () => {
    const { client, email: salesEmail, password: salesPassword } = await userClient(admin, "sales");
    const assignees = await client.get("/api/admin/assignees");
    assert.equal(assignees.status, 200);
    assert.ok(assignees.body.data.every((a: Record<string, unknown>) => a.id && a.name && !("email" in a)), "names only, no emails");
    const { context, page } = await open();
    await signIn(page, salesEmail, salesPassword);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await nav.getByRole("link", { name: "Enquiries" }).waitFor();
    assert.equal(await nav.getByRole("link", { name: "Content" }).count(), 0);
    assert.equal(await nav.getByRole("link", { name: "Users" }).count(), 0);

    await page.goto(`${BASE}/admin/users`);
    await page.getByText("You don't have access to this page").waitFor();
    await page.goto(`${BASE}/admin/content/products`);
    await page.getByText("You don't have access to this page").waitFor();
    await context.close();
  });

  it("an editor sees content but not enquiries", async () => {
    const { client, email: editorEmail, password: editorPassword } = await userClient(admin, "editor");
    assert.equal((await client.get("/api/admin/assignees")).status, 403);
    const { context, page } = await open();
    await signIn(page, editorEmail, editorPassword);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await nav.getByRole("link", { name: "Content" }).waitFor();
    assert.equal(await nav.getByRole("link", { name: "Enquiries" }).count(), 0);
    await page.goto(`${BASE}/admin/enquiries`);
    await page.getByText("You don't have access to this page").waitFor();
    await context.close();
  });
});

describe("mobile", () => {
  it("opens the navigation drawer and fits the screen", async () => {
    const { context, page } = await open({ mobile: true });
    await signIn(page);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("navigation", { name: "Admin" }).last().getByRole("link", { name: "Enquiries" }).click();
    await page.waitForURL(/\/admin\/enquiries/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `horizontal overflow of ${overflow}px`);
    await context.close();
  });
});
