import { mkdirSync } from "node:fs";
import { chromium, type Page } from "playwright-core";

/**
 * Captures the screenshots used in the project report into docs/report-figures/. Needs the site
 * running (`npm run dev:all`) and ADMIN_EMAIL / ADMIN_PASSWORD. It places one sample order and one
 * sample enquiry so the screens show real content, and deletes both afterwards.
 *
 *   node --env-file=.env --import tsx scripts/capture-report-figures.ts
 */

const BASE = process.env.REPORT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/report-figures";
// A fresh client address per run, so repeated runs never hit the per-IP form limits.
const IP = { "X-Forwarded-For": `10.250.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}` };

async function api(path: string, init: RequestInit & { cookie?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json", Origin: BASE, ...IP };
  if (init.cookie) headers.Cookie = init.cookie;
  const response = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status}: ${JSON.stringify(body)}`);
  return body?.data;
}

async function formToken() {
  const { token } = await api("/api/enquiries/token");
  await new Promise((resolve) => setTimeout(resolve, 2_300)); // the server's minimum fill time
  return token as string;
}

/** Close-up of one element (a card), with a little surrounding margin. */
async function shotOf(page: Page, name: string, selector: ReturnType<Page["locator"]>) {
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await selector.scrollIntoViewIfNeeded();
  const box = (await selector.boundingBox())!;
  const pad = 16;
  await page.screenshot({
    path: `${OUT}/${name}.jpg`,
    type: "jpeg",
    quality: 85,
    clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 },
  });
}

async function shot(page: Page, name: string, fullPage = false) {
  // Hide the development-mode indicator so figures show the site as visitors see it.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 82, fullPage });
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // Staff session for the API calls (setup and clean-up).
  const login = await fetch(`${BASE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE, ...IP },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  if (!login.ok) throw new Error(`admin sign-in failed (${login.status})`);
  const cookie = login.headers.getSetCookie()[0].split(";")[0];

  const enquiry = await api("/api/enquiries", {
    method: "POST",
    body: JSON.stringify({
      name: "Priya Raman",
      mobile: "98940 11223",
      email: "priya.raman@example.com",
      type: "survey",
      subject: "gas-detection-system-survey",
      message: "We are commissioning a new solvent store at our Cuddalore unit and need a gas detection survey before the end of the month. Please share your availability. (sample for report)",
      token: await formToken(),
      source: { path: "/survey/gas-detection-system-survey" },
    }),
  });

  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const created: { orderId?: string; enquiryId?: string } = {};
  try {
    /* ---------------- customer ---------------- */
    const customer = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, extraHTTPHeaders: IP, reducedMotion: "reduce" })).newPage();
    await customer.goto(`${BASE}/`);
    await customer.waitForLoadState("networkidle");
    await shot(customer, "home");

    await customer.goto(`${BASE}/products/head-protection`);
    const add = customer.getByRole("group", { name: "Add to quote basket" });
    await add.getByLabel("Quantity", { exact: true }).fill("200");
    await add.getByLabel(/Size, model or colour/).fill("White, ISI marked");
    await add.getByRole("button", { name: "Add to quote basket" }).click();
    await customer.getByText("Added 200").waitFor();
    await add.scrollIntoViewIfNeeded();
    await customer.evaluate(() => window.scrollBy(0, -180));
    await shot(customer, "product");

    for (const [slug, quantity] of [["fire-extinguisher", 12], ["eye-protection", 150]] as const) {
      await customer.goto(`${BASE}/products/${slug}`);
      const group = customer.getByRole("group", { name: "Add to quote basket" });
      await group.getByLabel("Quantity", { exact: true }).fill(String(quantity));
      await group.getByRole("button", { name: "Add to quote basket" }).click();
      await customer.getByText(`Added ${quantity}`).waitFor();
    }

    await customer.goto(`${BASE}/quote`);
    await customer.waitForLoadState("networkidle");
    const form = customer.getByRole("form", { name: "Order details" });
    await form.getByLabel("Your name").fill("Ramesh Kumar");
    await form.getByLabel("Mobile number").fill("98765 12345");
    await form.getByLabel("Email (optional)").fill("ramesh.kumar@example.com");
    await form.getByLabel("Company (optional)").fill("Coastal Chemicals Pvt Ltd");
    await form.getByLabel("GSTIN (optional)").fill("33ABCDE1234F1Z5");
    await form.getByLabel("Delivery address").fill("Plot 12, SIPCOT Industrial Complex");
    await form.getByLabel("City").fill("Cuddalore");
    await form.getByLabel("PIN code").fill("607005");
    await form.getByLabel(/Notes for our team/).fill("Please deliver before 15 November. Site contact: Mr. Senthil.");
    await customer.locator("main section").nth(1).scrollIntoViewIfNeeded();
    await shot(customer, "basket");
    await customer.waitForTimeout(2_300);
    await form.getByRole("button", { name: /Send order/ }).click();
    await customer.getByText("Order received").waitFor({ timeout: 15_000 }).catch(async () => {
      throw new Error(`order was not accepted: ${await customer.getByRole("alert").allTextContents()}`);
    });
    await shotOf(customer, "order-received", customer.locator("div").filter({ has: customer.getByRole("heading", { name: "Order received" }) }).last());
    const reference = ((await customer.getByText(/ORD-\d{4}-\d{6}/).first().textContent()) ?? "").match(/ORD-\d{4}-\d{6}/)![0];

    const [order] = await api(`/api/admin/orders?q=${reference}`, { cookie });
    created.orderId = order.id;
    const [storedEnquiry] = await api(`/api/admin/enquiries?q=${enquiry.reference}`, { cookie });
    created.enquiryId = storedEnquiry.id;

    /* ---------------- staff ---------------- */
    const staffContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
    const staff = await staffContext.newPage();
    await staff.goto(`${BASE}/admin/login`);
    await shot(staff, "admin-login");
    await staff.getByLabel("Email").fill(process.env.ADMIN_EMAIL!);
    await staff.getByLabel("Password").fill(process.env.ADMIN_PASSWORD!);
    await staff.getByRole("button", { name: "Sign in" }).click();
    await staff.waitForURL(/\/admin$/);
    await staff.getByText("Latest orders").waitFor();
    await staff.waitForLoadState("networkidle");
    await shot(staff, "admin-dashboard");

    await staff.goto(`${BASE}/admin/orders`);
    await staff.getByRole("link", { name: "Ramesh Kumar" }).waitFor();
    await shot(staff, "admin-orders");

    await staff.goto(`${BASE}/admin/orders/${order.id}`);
    await staff.getByText("Handle this order").waitFor();
    await staff.waitForLoadState("networkidle");
    await shot(staff, "admin-order");

    await staff.goto(`${BASE}/admin/enquiries/${storedEnquiry.id}`);
    await staff.getByText("Handle this enquiry").waitFor();
    await staff.waitForLoadState("networkidle");
    await shot(staff, "admin-enquiry");

    await staff.goto(`${BASE}/admin/content/products`);
    await staff.getByRole("link", { name: "Head Protection" }).first().waitFor();
    await staff.waitForLoadState("networkidle");
    await shot(staff, "admin-content");

    await staff.goto(`${BASE}/admin/settings`);
    await staff.locator("#s-companyName").waitFor();
    await shot(staff, "admin-settings");

    /* ---------------- customer tracks the order after the team quoted it ---------------- */
    await api(`/api/admin/orders/${order.id}`, { method: "PATCH", cookie, body: JSON.stringify({ status: "quoted" }) });
    await customer.goto(`${BASE}/quote/track?ref=${reference}`);
    const tracker = customer.getByRole("form", { name: "Track your order" });
    await tracker.getByLabel("Mobile number").fill("9876512345");
    await tracker.getByRole("button", { name: "Track" }).click();
    await customer.getByRole("status").getByText("Head Protection").waitFor();
    await shotOf(customer, "tracking", customer.locator("div").filter({ has: customer.getByRole("heading", { name: "Track your order", level: 3 }) }).last());

    /* ---------------- phone ---------------- */
    const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, extraHTTPHeaders: IP, reducedMotion: "reduce" })).newPage();
    await phone.goto(`${BASE}/products/fire-extinguisher`);
    await phone.getByRole("group", { name: "Add to quote basket" }).getByRole("button", { name: "Add to quote basket" }).click();
    await phone.goto(`${BASE}/quote`);
    await phone.waitForLoadState("networkidle");
    await shot(phone, "mobile-basket");
  } finally {
    await browser.close();
    if (created.orderId) await api(`/api/admin/orders/${created.orderId}`, { method: "DELETE", cookie }).catch(() => undefined);
    if (created.enquiryId) await api(`/api/admin/enquiries/${created.enquiryId}`, { method: "DELETE", cookie }).catch(() => undefined);
  }
  console.log(`figures written to ${OUT}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
