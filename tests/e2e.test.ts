import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright-core";
import { BASE, adminClient, mailpit, purgeTestEnquiries, sleep, uid, type Client } from "./helpers";

/**
 * Real-browser tests: drives your installed Google Chrome against the running site, so the UI,
 * the API and MongoDB are exercised together exactly as a visitor would.
 */

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MARK = `zz-test-${uid()}`;

let browser: Browser;
let admin: Client;
let reference = "";
const mobile = "9876543210";

before(async () => {
  browser = await chromium.launch({ channel: "chrome", headless: true }).catch((error: Error) => {
    throw new Error(`Could not start Google Chrome for the browser tests: ${error.message}`);
  });
  admin = await adminClient();
});

after(async () => {
  await browser?.close();
  const t = await admin.get(`/api/admin/content/testimonials?q=${MARK}&limit=50`);
  for (const item of t.body?.data ?? []) await admin.del(`/api/admin/content/testimonials/${item.id}`);
  const s = await admin.get(`/api/admin/subscribers?q=${MARK}&limit=50`);
  for (const item of s.body?.data ?? []) await admin.del(`/api/admin/subscribers/${item.id}`);
  await purgeTestEnquiries(admin);
});

interface Session {
  context: BrowserContext;
  page: Page;
  problems: string[];
}

/** A fresh browser context that records console errors, page errors and failed requests. */
async function open(opts: { mobile?: boolean; dark?: boolean } = {}): Promise<Session> {
  const context = await browser.newContext({
    userAgent: CHROME_UA,
    viewport: opts.mobile ? { width: 375, height: 812 } : { width: 1280, height: 900 },
    isMobile: opts.mobile,
    hasTouch: opts.mobile,
    colorScheme: opts.dark ? "dark" : "light",
    // Smooth scrolling makes scripted clicks land on moving targets; the site honours reduced motion.
    reducedMotion: "reduce",
    // Distinct visitor per context so rate limits never interfere between tests.
    extraHTTPHeaders: { "X-Forwarded-For": `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` },
  });
  const page = await context.newPage();
  const problems: string[] = [];
  // Third-party frames (the embedded Google Map) log their own CORS noise; only our code's errors count.
  const thirdParty = /google\.com|googleapis\.com|gstatic\.com/;
  page.on("console", (m) => m.type() === "error" && !thirdParty.test(m.text() + m.location().url) && problems.push(`console: ${m.text()}`));
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("response", (r) => r.status() >= 400 && !thirdParty.test(r.url()) && problems.push(`http ${r.status()}: ${r.url()}`));
  return { context, page, problems };
}

/**
 * Scrolls the page so lazy images load, then returns the ones that FAILED. A failed image is
 * `complete` with no pixels; images still waiting (hidden drawer logo, off-screen marquee clones)
 * are not failures.
 */
async function brokenImages(page: Page): Promise<string[]> {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  return page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
}

describe("pages render cleanly in a real browser", () => {
  for (const path of ["/", "/about", "/products", "/products/head-protection", "/survey", "/survey/fit-testing", "/training", "/contact"]) {
    it(`${path}: no errors, no broken images, no horizontal overflow`, async () => {
      const { context, page, problems } = await open();
      const response = await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      assert.equal(response?.status(), 200);

      assert.deepEqual(await brokenImages(page), [], "broken images");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `page is ${overflow}px wider than the viewport`);
      assert.deepEqual(problems, []);
      await context.close();
    });
  }
});

describe("content comes from the database", () => {
  it("shows hero copy and live stats on the home page", async () => {
    const { context, page } = await open();
    await page.goto(BASE);
    await page.getByRole("heading", { level: 1 }).waitFor();
    assert.match((await page.getByRole("heading", { level: 1 }).textContent()) ?? "", /Industrial safety equipment that actually gets worn/);
    assert.ok((await page.locator('a[href^="/products/"]').count()) >= 8);
    await context.close();
  });

  it("an admin edit shows up on the live site without a deploy", async () => {
    const original = (await admin.get("/api/admin/settings")).body.data.home.heroTitle;
    try {
      await admin.patch("/api/admin/settings", { home: { heroTitle: `${MARK} edited headline` } });
      const { context, page } = await open();
      await page.goto(BASE);
      assert.match((await page.getByRole("heading", { level: 1 }).textContent()) ?? "", new RegExp(`${MARK} edited headline`));
      await context.close();
    } finally {
      await admin.patch("/api/admin/settings", { home: { heroTitle: original } });
    }
  });

  it("returns a friendly 404 page", async () => {
    const { context, page } = await open();
    const response = await page.goto(`${BASE}/products/definitely-missing`);
    assert.equal(response?.status(), 404);
    await page.getByText("We couldn't find that page").waitFor();
    await context.close();
  });
});

describe("navigation and search", () => {
  it("navigates from the header to a product and back", async () => {
    const { context, page } = await open();
    await page.goto(BASE);
    await page.getByRole("navigation").getByRole("link", { name: "Products", exact: true }).first().click();
    await page.waitForURL("**/products");
    await page.locator('a[href="/products/head-protection"]').first().click();
    await page.waitForURL("**/products/head-protection");
    await page.getByRole("heading", { level: 1, name: "Head Protection" }).waitFor();
    await context.close();
  });

  it("live search finds products, surveys and training, and opens a result", async () => {
    const { context, page } = await open();
    await page.goto(BASE);
    await page.getByRole("button", { name: "Search the site" }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor();

    await dialog.getByRole("textbox", { name: "Search" }).fill("breathing");
    await dialog.locator('a[href^="/products/"]').first().waitFor();
    assert.ok((await dialog.locator("a").count()) >= 2);

    await dialog.getByRole("textbox", { name: "Search" }).fill("zzqqxx");
    await dialog.getByText("No results").waitFor();

    await dialog.getByRole("textbox", { name: "Search" }).fill("scba");
    await dialog.locator('a[href="/products/scba"]').waitFor();
    await dialog.locator('a[href="/products/scba"]').click();
    await page.waitForURL("**/products/scba");
    await context.close();
  });
});

describe("enquiry form", () => {
  it("validates before sending anything", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/contact`);
    const requests: string[] = [];
    page.on("request", (r) => r.method() === "POST" && requests.push(r.url()));

    const form = page.getByRole("form", { name: "Enquiry form" });
    await form.getByRole("button", { name: /Send enquiry/ }).click();
    await form.getByText("Please enter your name.").waitFor();
    await form.getByText("Enter a valid mobile number.").waitFor();
    await form.getByText(/Tell us a little more/).waitFor();
    assert.deepEqual(requests, []);
    await context.close();
  });

  it("hides the honeypot from people", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/contact`);
    const box = await page.locator("#website").boundingBox();
    assert.ok(!box || box.x < -1000 || box.width === 0, "honeypot must be off-screen");
    assert.equal(await page.locator("#website").evaluate((el) => el.closest("[aria-hidden='true']") !== null), true);
    await context.close();
  });

  it("changes the choices when the enquiry type changes", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/contact`);
    const form = page.getByRole("form", { name: "Enquiry form" });
    await form.getByRole("button", { name: "Survey", exact: true }).click();
    await form.getByLabel("Which survey?").selectOption("fit-testing");
    await form.getByRole("button", { name: "Training", exact: true }).click();
    assert.ok((await form.getByLabel("Which programme?").locator("option").count()) >= 10);
    await context.close();
  });

  it("pre-selects the product on a product page", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/products/scba`);
    const form = page.getByRole("form", { name: "Enquiry form" });
    assert.equal(await form.getByLabel("Which product?").inputValue(), "scba");
    await context.close();
  });

  it("submits, shows a reference number, stores it and emails the team", async () => {
    await mailpit.clear();
    const { context, page, problems } = await open();
    await page.goto(`${BASE}/products/scba`);
    const form = page.getByRole("form", { name: "Enquiry form" });

    await form.getByLabel("Name", { exact: true }).fill(`${MARK} Browser Buyer`);
    await form.getByLabel("Mobile number").fill("98765 43210");
    await form.getByLabel("Email (optional)").fill(`browser-${uid()}@example.com`);
    await form.getByLabel("Message").fill(`We need 12 SCBA sets for our new plant. apex-test ${MARK}`);
    await sleep(2300); // the server enforces a minimum fill time
    await form.getByRole("button", { name: /Send enquiry/ }).click();

    await page.getByText("Enquiry received").waitFor();
    reference = ((await page.getByText(/ENQ-\d{4}-\d{6}/).first().textContent()) ?? "").match(/ENQ-\d{4}-\d{6}/)![0];
    assert.match(reference, /^ENQ-\d{4}-\d{6}$/);

    const stored = (await admin.get(`/api/admin/enquiries?q=${reference}`)).body.data[0];
    assert.equal(stored.mobile, "+919876543210");
    assert.equal(stored.subject.slug, "scba");

    const mail = await mailpit.waitFor((m) => m.Subject.includes(reference) && m.To.some((t) => t.Address === "sales@apexcare.local"));
    assert.match(mail.Subject, /Self Contained Breathing Apparatus/);
    assert.deepEqual(problems, []);
    await context.close();
  });
});

describe("enquiry tracker", () => {
  it("shows progress for a real enquiry and rejects a wrong mobile number", async () => {
    assert.ok(reference, "needs the enquiry created above");
    const { context, page } = await open();
    await page.goto(`${BASE}/contact`);
    const tracker = page.getByRole("form", { name: "Track your enquiry" });

    await tracker.getByLabel("Reference number").fill(reference);
    await tracker.getByLabel("Mobile number").fill("9123456780");
    await tracker.getByRole("button", { name: "Track" }).click();
    await page.getByRole("alert").filter({ hasText: "couldn't find" }).waitFor();

    const trackCalls: string[] = [];
    page.on("response", (r) => r.url().includes("/enquiries/track") && trackCalls.push(String(r.status())));
    await tracker.getByLabel("Mobile number").fill(mobile);
    await tracker.getByRole("button", { name: "Track" }).click();
    const headline = page.getByRole("status").locator("p.font-display");
    await headline.filter({ hasText: /^Received$/ }).waitFor({ timeout: 8_000 }).catch(async () => {
      assert.fail(`tracker never showed "Received": track responses=[${trackCalls}] status=${JSON.stringify(await page.getByRole("status").allTextContents())} alerts=${JSON.stringify(await page.getByRole("alert").allTextContents())} ref=${reference}`);
    });

    const id = (await admin.get(`/api/admin/enquiries?q=${reference}`)).body.data[0].id;
    await admin.patch(`/api/admin/enquiries/${id}`, { status: "contacted" });
    await tracker.getByRole("button", { name: "Track" }).click();
    await headline.filter({ hasText: /^In progress$/ }).waitFor();
    await context.close();
  });
});

describe("newsletter sign-up", () => {
  it("double opt-in works end to end in the browser", async () => {
    await mailpit.clear();
    const email = `${MARK}-${uid()}@example.com`;
    const { context, page, problems } = await open();
    await page.goto(BASE);

    const form = page.getByRole("form", { name: "Newsletter sign-up" });
    await form.getByLabel("Stay in the loop").fill(email);
    await sleep(2300);
    await form.getByRole("button", { name: "Subscribe" }).click();
    await page.getByText(/Check your inbox/).waitFor();

    const mail = await mailpit.waitFor((m) => m.To.some((t) => t.Address === email));
    const link = (await mailpit.body(mail.ID)).Text.match(/https?:\/\/\S+\/api\/newsletter\/confirm\?token=\S+/)![0];
    assert.equal((await admin.get(`/api/admin/subscribers?q=${email}`)).body.data[0].status, "pending");

    await page.goto(link);
    await page.getByRole("button", { name: "Confirm subscription" }).click();
    await page.getByText("You're subscribed").waitFor();
    assert.equal((await admin.get(`/api/admin/subscribers?q=${email}`)).body.data[0].status, "subscribed");
    assert.deepEqual(problems, []);
    await context.close();
  });

  it("rejects an invalid address in the browser", async () => {
    const { context, page } = await open();
    await page.goto(BASE);
    const form = page.getByRole("form", { name: "Newsletter sign-up" });
    await form.getByLabel("Stay in the loop").fill("not-an-email");
    await form.getByRole("button", { name: "Subscribe" }).click();
    await form.getByText("Enter a valid email address.").waitFor();
    await context.close();
  });
});

describe("customer testimonial", () => {
  it("is submitted from the About page and waits for approval", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/about`);
    const form = page.getByRole("form", { name: "Share your experience" });

    await form.getByRole("button", { name: "Submit review" }).click();
    await form.getByText("Please enter your name.").waitFor();

    const name = `${MARK} Reviewer`;
    await form.getByLabel("Name").fill(name);
    await form.getByLabel("Company (optional)").fill("Acme Industries");
    await form.getByRole("radio", { name: "4 out of 5" }).click();
    await form.getByLabel("Your review").fill("Prompt delivery and the on-site training was genuinely useful for our crew.");
    await sleep(2300);
    await form.getByRole("button", { name: "Submit review" }).click();
    await page.getByText("Thank you!").waitFor();

    const queued = (await admin.get(`/api/admin/content/testimonials?source=public&published=false&q=${MARK}`)).body.data.find((t: { name: string }) => t.name === name);
    assert.ok(queued);
    assert.equal(queued.rating, 4);
    assert.ok(!(await (await fetch(`${BASE}/about`)).text()).includes(name), "not on the site until approved");

    await admin.patch(`/api/admin/content/testimonials/${queued.id}`, { published: true });
    await page.reload();
    await page.getByText(name).first().waitFor();
    await context.close();
  });
});

describe("gallery lightbox", () => {
  it("opens, navigates with the keyboard and closes", async () => {
    const { context, page } = await open();
    await page.goto(`${BASE}/training`);
    await page.getByRole("button", { name: /View image 1 of 8/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("1 / 8").waitFor();
    await page.keyboard.press("ArrowRight");
    await dialog.getByText("2 / 8").waitFor();
    await page.keyboard.press("ArrowLeft");
    await dialog.getByText("1 / 8").waitFor();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await context.close();
  });
});

describe("responsive layout and theming", () => {
  it("mobile: drawer menu, action bar and no overflow", async () => {
    const { context, page } = await open({ mobile: true });
    await page.goto(BASE);
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.getByRole("link", { name: "About", exact: true }).last().click();
    await page.waitForURL("**/about");
    assert.ok(await page.getByRole("navigation", { name: "Quick actions" }).isVisible());
    for (const path of ["/", "/products", "/contact"]) {
      await page.goto(`${BASE}${path}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${path} overflows by ${overflow}px at 375px`);
    }
    await context.close();
  });

  it("follows the system dark theme", async () => {
    const { context, page } = await open({ dark: true });
    await page.goto(BASE);
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const [r, g, b] = bg.match(/\d+/g)!.map(Number);
    assert.ok(r + g + b < 150, `expected a dark background, got ${bg}`);
    await context.close();
  });
});

describe("SEO and accessibility basics", () => {
  it("has valid JSON-LD, titles, descriptions and alt text", async () => {
    const { context, page } = await open();
    for (const path of ["/", "/products/scba", "/survey/fit-testing"]) {
      await page.goto(`${BASE}${path}`);
      assert.ok((await page.title()).length > 5, `${path} title`);
      assert.ok(((await page.locator('meta[name="description"]').getAttribute("content")) ?? "").length > 20, `${path} description`);
      for (const json of await page.locator('script[type="application/ld+json"]').allTextContents()) JSON.parse(json);
      assert.equal(await page.locator("img:not([alt])").count(), 0, `${path} images without alt`);
      assert.equal(await page.locator("h1").count(), 1, `${path} should have exactly one h1`);
    }
    await page.goto(`${BASE}/products/scba`);
    assert.match((await page.locator('link[rel="canonical"]').getAttribute("href")) ?? "", /\/products\/scba$/);
    await context.close();
  });
});

describe("first-party analytics from the browser", () => {
  it("records page views, product views and call/WhatsApp clicks", async () => {
    const { context, page } = await open({ mobile: true });
    await page.goto(`${BASE}/about`);
    await page.goto(`${BASE}/products/scba`);

    // Intercept the navigation so headless Chrome doesn't try to open a phone dialler.
    await page.evaluate(() => document.addEventListener("click", (e) => e.preventDefault(), { capture: false }));
    await page.getByRole("navigation", { name: "Quick actions" }).getByRole("link", { name: "Call" }).dispatchEvent("click"); // dispatched on the element: immune to the dev-only error overlay
    await sleep(500);

    const deadline = Date.now() + 10_000;
    let summary = (await admin.get("/api/admin/analytics?days=1")).body.data;
    const seen = () =>
      summary.topPages.some((p: { name: string }) => p.name === "/about") &&
      summary.topProducts.some((p: { name: string }) => p.name === "scba") &&
      summary.ctaClicks.some((c: { name: string }) => c.name === "call");
    while (!seen() && Date.now() < deadline) {
      await sleep(400);
      summary = (await admin.get("/api/admin/analytics?days=1")).body.data;
    }
    assert.ok(seen(), JSON.stringify({ pages: summary.topPages, products: summary.topProducts, cta: summary.ctaClicks }));
    await context.close();
  });

  it("sends nothing when the visitor has Global Privacy Control on", async () => {
    const before = (await admin.get("/api/admin/analytics?days=1")).body.data.totals.pageViews;
    const context = await browser.newContext({ userAgent: CHROME_UA, extraHTTPHeaders: { "Sec-GPC": "1" } });
    await context.addInitScript(() => Object.defineProperty(navigator, "globalPrivacyControl", { value: true }));
    const page = await context.newPage();
    const beacons: string[] = [];
    page.on("request", (r) => r.url().includes("/api/analytics/events") && beacons.push(r.url()));
    await page.goto(`${BASE}/training`);
    await sleep(1000);
    assert.deepEqual(beacons, []);
    assert.equal((await admin.get("/api/admin/analytics?days=1")).body.data.totals.pageViews, before);
    await context.close();
  });
});
