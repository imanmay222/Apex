import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Builds Apex-Backend-Report.pdf by rendering HTML in your installed Chrome and printing it.
 * Run: npx tsx scripts/build-report.ts
 */

const TODAY = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const table = (head: string[], rows: (string | number)[][], opts: { num?: number[] } = {}) => `
<table>
  <thead><tr>${head.map((h, i) => `<th${opts.num?.includes(i) ? ' class="n"' : ""}>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${opts.num?.includes(i) ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
</table>`;

const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Apex Care Technologies: Backend Report</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font: 10.2pt/1.5 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0d1526; margin: 0; }
  h1, h2, h3 { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; line-height: 1.2; }
  h2 { font-size: 17pt; margin: 0 0 8pt; color: #0a2150; padding-bottom: 6pt; border-bottom: 2.5pt solid #ee4a24; }
  h3 { font-size: 11.5pt; margin: 14pt 0 4pt; color: #0b4ba2; }
  p { margin: 0 0 7pt; }
  ul { margin: 0 0 8pt; padding-left: 15pt; } li { margin-bottom: 2.5pt; }
  .page { page-break-after: always; padding: 0; }
  .page:last-child { page-break-after: auto; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: space-between; }
  .band { background: #0a2150; color: #fff; margin: 0; padding: 24mm 12mm 18mm; border-radius: 4pt; }
  .band .eyebrow { letter-spacing: .16em; text-transform: uppercase; font-size: 9pt; color: #ff8a63; font-weight: 700; }
  .band h1 { font-size: 30pt; margin: 8pt 0 10pt; }
  .band p { color: #c8d3ea; font-size: 12pt; max-width: 135mm; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin-top: 10mm; }
  .stat { border: 1pt solid #dbe3f0; border-radius: 8pt; padding: 10pt; }
  .stat b { display: block; font-size: 22pt; color: #0b4ba2; line-height: 1.1; }
  .stat span { font-size: 8.5pt; color: #5b6880; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 9pt; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: #0a2150; color: #fff; padding: 5pt 7pt; font-weight: 600; }
  td { padding: 4.5pt 7pt; border-bottom: .6pt solid #e3e8f0; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }
  .n { text-align: right; white-space: nowrap; }
  code { font: 8.6pt "SF Mono", Menlo, monospace; background: #eef2f9; padding: 1pt 3pt; border-radius: 3pt; }
  .ok { color: #0a7d3b; font-weight: 700; } .warn { color: #b45309; font-weight: 700; }
  .callout { background: #fff4ed; border-left: 3pt solid #ee4a24; padding: 8pt 10pt; border-radius: 0 6pt 6pt 0; margin: 8pt 0; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 14pt; }
  .small { font-size: 8.8pt; color: #5b6880; }
</style></head><body>

<!-- ============================ COVER ============================ -->
<section class="page cover">
  <div class="band">
    <div class="eyebrow">Backend implementation report</div>
    <h1>Apex Care Technologies</h1>
    <p>Next.js as the server. MongoDB as the only data store. What was built, how it was verified, and what is still open.</p>
  </div>
  <div>
    <div class="stats">
      <div class="stat"><b>72</b><span>API operations<br>27 public · 45 admin</span></div>
      <div class="stat"><b>17</b><span>MongoDB collections<br>plus GridFS file storage</span></div>
      <div class="stat"><b>300</b><span>automated tests<br>all passing</span></div>
      <div class="stat"><b>0</b><span>production dependency<br>vulnerabilities</span></div>
    </div>
    <p class="small" style="margin-top:14mm">Prepared ${TODAY} · Next.js 16.4.2 · MongoDB 8 · Mongoose 9 · Node 24<br>Companion documents: <code>features.readme.md</code> (full inventory) and <code>README.md</code> (how to run)</p>
  </div>
</section>

<!-- ============================ SUMMARY ============================ -->
<section class="page">
  <h2>1. Summary</h2>
  <p>The site's UI was already built. This work connects it to a real backend: every page now reads its content from <b>MongoDB</b>, every form writes to it, and an authenticated admin API manages all of it. Next.js is both the website and the API server, so there is nothing else to deploy.</p>
  <h3>What changed in this final phase</h3>
  ${list([
    "<b>Moved to your local Node</b> (no Docker): one command, <code>npm run dev:all</code>, starts MongoDB, a mail catcher, seeds the database and runs the site.",
    "<b>Four new features:</b> customer testimonials with moderation, enquiry tracking, a double opt-in newsletter, and content import/restore.",
    "<b>Real-browser testing:</b> 28 tests drive your installed Chrome through the actual UI (forms, search, tracker, newsletter, lightbox, mobile, dark mode, analytics). They confirm the site works as a visitor would use it; the failures they surfaced along the way were test-harness issues, not site bugs.",
    "<b>Security upgrade:</b> Next.js 16.3.6 → 16.4.2 fixed two advisories (cache poisoning, image-optimiser SSRF). Production audit is now clean.",
    "<b>Bugs found by the tests and fixed</b> (listed in section 7).",
  ])}
  <h3>Result</h3>
  ${table(
    ["Check", "Result"],
    [
      ["Type-check (<code>tsc --noEmit</code>)", "<span class='ok'>clean</span>"],
      ["Lint (<code>eslint</code>)", "<span class='ok'>clean</span>"],
      ["Production build", "<span class='ok'>passes, needs no database</span>"],
      ["Automated tests (<code>npm test</code>)", "<span class='ok'>300 / 300 pass, ~66 s</span>"],
      ["Browser tests in real Chrome", "<span class='ok'>28 / 28 pass, stable across repeated runs</span>"],
      ["<code>npm audit --omit=dev</code>", "<span class='ok'>0 vulnerabilities</span>"],
      ["Full-tree <code>npm audit</code>", "<span class='warn'>5 high, dev-only lint tooling (see section 9)</span>"],
    ],
  )}
  <div class="callout"><b>Read this first:</b> there is <b>no admin web interface</b>. All administration (content, enquiries, users, settings) goes through the authenticated API. That is the main thing left to build, and the API is designed for it.</div>
</section>

<!-- ============================ AUDIT ============================ -->
<section class="page">
  <h2>2. Audit: what existed and what was missing</h2>
  <p>Before adding anything, the existing code was checked against the goal of "every site feature backed by MongoDB, and every backend feature that makes sense".</p>
  ${table(
    ["Area", "Status at start of this phase", "Action taken"],
    [
      ["Content from MongoDB (products, surveys, training, gallery, logos, leaders, settings)", "<span class='ok'>Done</span>", "Verified; kept"],
      ["Enquiry form → MongoDB, email, webhook, spam defences", "<span class='ok'>Done</span>", "Verified; kept"],
      ["Auth, roles, sessions, CSRF, lockout", "<span class='ok'>Done</span>", "Verified; kept"],
      ["Admin CRUD, media (GridFS), analytics, audit, export, cron", "<span class='ok'>Done</span>", "Verified; kept"],
      ["Ran only inside Docker", "<span class='warn'>Blocker for you</span>", "Rebuilt to run on local Node with an npm-managed MongoDB"],
      ["Customers could not submit testimonials", "Missing", "<b>Added</b> (moderated)"],
      ["Customers could not check an enquiry's status", "Missing", "<b>Added</b>"],
      ["No newsletter / consent capture", "Missing", "<b>Added</b> (double opt-in)"],
      ["Export existed but could not be restored", "Gap", "<b>Added</b> import / restore"],
      ["UI only checked at HTML level, never in a browser", "Gap", "<b>Added</b> 28 real-Chrome tests"],
      ["Dependencies with known advisories (Next.js)", "Gap", "<b>Upgraded</b> to patched 16.4.2"],
      ["Admin web UI", "Missing", "<span class='warn'>Not built</span> (API only)"],
    ],
  )}
</section>

<!-- ============================ FEATURES ============================ -->
<section class="page">
  <h2>3. Features implemented</h2>
  <div class="two">
  <div>
    <h3>Site content</h3>
    ${list(["39 products, 5 groups, 9 surveys, 10 training programmes, gallery, logos, leadership, testimonials", "Editable site settings (contact details, emails, hero text, certificates, catalogue)", "Live home-page statistics", "Edits appear on the live site instantly (tag-invalidated cache)", "Dynamic sitemap, SEO metadata, JSON-LD"])}
    <h3>Enquiries</h3>
    ${list(["Validated form with atomic references <code>ENQ-2026-000123</code>", "Email to sales + acknowledgement to customer + signed webhook", "Per-channel delivery status, retry, resend", "Anti-spam: signed token, honeypot, scoring, duplicate collapse, rate limits", "Admin inbox: filters, search, status history, first-response time, assign, tags, notes, bulk actions, CSV export"])}
    <h3>Customer enquiry tracking <span class="ok">NEW</span></h3>
    ${list(["Reference + mobile number → progress and timeline", "Internal notes never exposed; wrong reference and wrong number look identical"])}
    <h3>Search</h3>
    ${list(["Products, surveys and training; ranked; injection-safe", "Live search dialog in the header"])}
  </div>
  <div>
    <h3>Testimonials <span class="ok">NEW</span></h3>
    ${list(["Public form on the About page → stored <i>unpublished</i>, team emailed", "Approve = publish, reject = delete; submitter email stays private"])}
    <h3>Newsletter <span class="ok">NEW</span></h3>
    ${list(["Double opt-in; links open a confirm page so mail scanners cannot subscribe/unsubscribe anyone", "One-click unsubscribe; admin list, CSV export, erasure", "Same reply for new / pending / existing (no list probing)"])}
    <h3>Media (GridFS)</h3>
    ${list(["Content sniffed from file bytes; SVG/HTML/executables rejected", "SHA-256 de-duplication; immutable caching; ETag", "Refuses to delete files still in use", "Tracked, replaceable catalogue download"])}
    <h3>Analytics</h3>
    ${list(["Cookie-less, no raw IPs, daily-rotating hashed visitor id", "Respects Do Not Track / Global Privacy Control", "Conversion rate, trends, top pages/products/searches, CTA clicks"])}
    <h3>Operations</h3>
    ${list(["Audit log, dashboard, content export and <b>import/restore</b> <span class='ok'>NEW</span>, health check, cron retry"])}
  </div>
  </div>
</section>

<!-- ============================ SECURITY ============================ -->
<section class="page">
  <h2>4. Security and reliability</h2>
  ${table(
    ["Concern", "Measure"],
    [
      ["Passwords", "scrypt (per-user salt, versioned format); 12+ char policy; no common or email-based passwords"],
      ["Sessions", "Random token; only its SHA-256 is stored; HttpOnly, SameSite=Lax (Secure on https); 7-day sliding expiry; revocable per device"],
      ["Brute force", "Per-IP limit, per-IP+email limit, account lockout after 10 failures; identical errors and equalised CPU for unknown emails"],
      ["CSRF", "Origin / Sec-Fetch-Site check on cookie-authenticated writes (not needed for Bearer clients)"],
      ["Access control", "3 roles, 12 permissions; last administrator and acting user protected; role changes end sessions"],
      ["Input", "Every body and query validated with Zod; unknown fields rejected; typed queries (no NoSQL operators from users); searches regex-escaped"],
      ["Output", "HTML-escaped emails; CRLF/header-injection guarded; JSON-LD escaped; CSV formula-injection neutralised"],
      ["Uploads", "Byte-level type check, size caps, sandboxed CSP and nosniff on served files"],
      ["Abuse", "MongoDB-backed rate limits (survive restarts, work across servers); honeypot + signed tokens + spam scoring on every public form"],
      ["Privacy", "No raw IPs; analytics visitor ids rotate daily; consent-based newsletter; erasure endpoint; automatic data expiry (see below)"],
      ["Data retention", "TTL indexes: sessions, rate-limit windows, analytics (400 d), audit (730 d), spam enquiries (30 d), unconfirmed subscribers (14 d)"],
      ["Failure handling", "Database outage → clean 503; failed emails/webhooks recorded and retried (max 5)"],
    ],
  )}
</section>

<!-- ============================ API ============================ -->
<section class="page">
  <h2>5. API surface (72 operations)</h2>
  <h3>Public: 27</h3>
  ${table(
    ["Area", "Endpoints"],
    [
      ["Content", "<code>GET /api/settings · stats · products · products/{slug} · product-groups · surveys · surveys/{slug} · training · gallery · testimonials · leaders · logos</code>"],
      ["Search &amp; files", "<code>GET /api/search · catalogue · media/{id} · health</code>"],
      ["Enquiries", "<code>GET /api/enquiries/token</code> · <code>POST /api/enquiries · enquiries/track</code>"],
      ["Engagement", "<code>POST /api/testimonials · newsletter/subscribe · analytics/events</code> · <code>GET+POST newsletter/confirm · newsletter/unsubscribe</code>"],
      ["Ops", "<code>POST /api/cron/notifications</code> (secret)"],
    ],
  )}
  <h3>Admin: 45 (session cookie or Bearer token)</h3>
  ${table(
    ["Area", "Operations", "Permission"],
    [
      ["Auth", "login, logout, me, change password, list / revoke sessions", "any signed-in user"],
      ["Users", "list, create, get, update, reset password, delete", "users:manage"],
      ["Enquiries", "list, get, update, delete, notes (add / delete), resend, bulk, CSV export", "enquiries:read / write / delete"],
      ["Content (8 types)", "list, create, get, update, delete, reorder, bulk", "content:write"],
      ["Settings", "get, update", "settings:write"],
      ["Media", "list, upload, usage, update, delete", "media:write"],
      ["Subscribers", "list, CSV export, delete", "subscribers:read / manage"],
      ["Insight", "dashboard, analytics, audit log", "enquiries:read · analytics:read · audit:read"],
      ["System", "content export, content import, cache purge", "system:manage"],
    ],
  )}
  <p class="small">Content types: products, product-groups, surveys, training, gallery, testimonials, logos, leaders. Full table in <code>features.readme.md</code>.</p>
</section>

<!-- ============================ TESTS ============================ -->
<section class="page">
  <h2>6. Verification</h2>
  <p><code>npm test</code> is hermetic: it starts its own throw-away MongoDB and mail catcher on free ports, builds and serves the app, runs everything, and removes it all. Your development data is never touched.</p>
  ${table(
    ["Suite", "Tests", "What it proves"],
    [
      ["Unit", 49, "Slugs, phone parsing, CSV-injection guard, spam scoring, file sniffing, scrypt, signed tokens, permissions"],
      ["Public API", 38, "Every public endpoint, filters, pagination, search, caching and security headers"],
      ["Enquiries", 38, "Whole pipeline including <b>real emails</b>, spam, rate limits, triage, notes, bulk, CSV"],
      ["Auth &amp; RBAC", 33, "Login, enumeration, lockout, sessions, CSRF, role matrix, password change, user management"],
      ["Content", 35, "CRUD for all types, <b>instant public visibility</b>, integrity rules, settings merge"],
      ["Engagement", 27, "Testimonials, tracking, newsletter double opt-in, import / restore"],
      ["Media", 16, "GridFS upload and serving, hostile uploads, usage-aware delete, PDF catalogue"],
      ["Operations", 20, "Analytics, audit log, export, cron, access control"],
      ["Infrastructure", 10, "TTL and unique indexes, seed idempotency, hashing at rest"],
      ["Webhook", 6, "HMAC signature, failure → retry → success, attempt cap"],
      ["<b>Real Chrome</b>", 28, "All pages free of console errors, broken images and overflow; search; every form; tracker; newsletter; lightbox; mobile; dark mode; SEO; analytics; privacy signal"],
      ["<b>Total</b>", "<b>300</b>", "<span class='ok'>all passing</span>"],
    ],
    { num: [1] },
  )}
  <p class="small">Browser tests run headless in Google Chrome via <code>playwright-core</code> (an npm library; no browser download). They run with reduced motion because the site honours it and smooth scrolling makes scripted clicks unreliable.</p>
</section>

<!-- ============================ BUGS ============================ -->
<section class="page">
  <h2>7. Defects found and fixed during testing</h2>
  <p>Writing tests for the new work uncovered real problems, all now fixed and covered:</p>
  ${table(
    ["Found by", "Problem", "Impact if shipped"],
    [
      ["API test", "Catalogue download returned a 500 (redirect response had immutable headers)", "Every “Download catalogue” link broken"],
      ["API test", "Admin enquiry filters rejected every request (schema helper mismatch)", "Inbox filtering unusable"],
      ["API test", "CSV export prefixed phone numbers with an apostrophe", "Phone cells looked wrong in Excel"],
      ["Import test", "Error paths reported the wrong row when some items were invalid", "Misleading messages during restore"],
      ["Browser test", "Click targets moved during smooth scrolling (test-only), plus third-party Google Map console noise", "None for visitors; tests hardened"],
      ["Type-check", "Mongoose 9 typing caused a type-checker out-of-memory crash", "Build impossible; fixed at its root"],
      ["Audit", "Next.js 16.3.6 had two security advisories", "Cache poisoning and SSRF exposure; upgraded"],
      ["Review", "A planned Docker seed step would have overwritten your macOS <code>node_modules</code>", "Removed before it ever ran"],
    ],
  )}
</section>

<!-- ============================ RUN ============================ -->
<section class="page">
  <h2>8. How to run it</h2>
  <pre style="background:#0a2150;color:#e8edf7;padding:10pt 12pt;border-radius:7pt;font:9pt/1.55 Menlo,monospace;margin:0 0 10pt">npm install
npm run dev:all        # MongoDB + mail catcher + seed + site
                       #   site   http://localhost:3000
                       #   mail   http://127.0.0.1:8025
npm test               # all 300 tests, isolated from your dev data</pre>
  ${table(
    ["Command", "Purpose"],
    [
      ["<code>npm run seed</code>", "Add missing content and the first admin (never overwrites edits)"],
      ["<code>npm run create-admin -- --email … --name … --role editor</code>", "Create another user (set <code>ADMIN_PASSWORD</code> in the environment)"],
      ["<code>npm test -- auth media</code>", "Run only matching suites"],
      ["<code>npm run build &amp;&amp; npm start</code>", "Production server (build needs no database)"],
    ],
  )}
  <h3>Going live</h3>
  ${list([
    "Point <code>MONGODB_URI</code> at MongoDB Atlas or your own server; set <code>SESSION_SECRET</code>, <code>PUBLIC_SITE_URL</code> (https), SMTP settings and <code>SALES_EMAIL</code>.",
    "Run <code>npm run seed</code> once and <b>change the admin password</b>.",
    "Put TLS in front; enable <code>TRUST_PROXY</code> only behind a proxy that overwrites <code>X-Forwarded-For</code>.",
    "Schedule <code>POST /api/cron/notifications</code> every few minutes to retry failed emails/webhooks.",
    "Back up with <code>mongodump</code> and/or <code>GET /api/admin/export</code>.",
  ])}
</section>

<!-- ============================ LIMITS ============================ -->
<section class="page">
  <h2>9. Known limits and next steps</h2>
  ${table(
    ["Item", "Detail", "Suggested next step"],
    [
      ["<b>No admin web UI</b>", "All administration is via the authenticated API", "Build a dashboard on the existing endpoints (they were designed for it)"],
      ["Dev-only advisories", "5 high-severity items in lint tooling (<code>eslint-config-next</code> → glob matchers). The only offered fix downgrades to Next 14. Nothing ships to production.", "Re-check after the next <code>eslint-config-next</code> release"],
      ["Browser coverage", "Tested in headless Google Chrome only; no screen-reader or cross-browser pass", "Add Firefox/Safari runs and an accessibility audit"],
      ["Docker files", "Provided as an optional path but not exercised end-to-end on this machine", "Try on a Docker host before relying on them"],
      ["Newsletter sending", "Sign-ups, consent and export are built; campaigns are not sent from here", "Export the CSV to a mailing tool, or add a sending job"],
      ["Product copy", "Generic category text from the original site; no standards or certifications claimed", "Add real descriptions, features and specs via the API"],
      ["Proxy trust", "Rate limiting reads <code>X-Forwarded-For</code>", "Set <code>TRUST_PROXY=false</code> if exposed without a proxy"],
    ],
  )}
  <div class="callout"><b>Before launch:</b> replace the development secrets in <code>.env</code>, change the seeded admin password, confirm SMTP delivers to <code>SALES_EMAIL</code>, and review the enquiry recipient list (seeded with the site's published “Enquiry Mail” address).</div>
</section>

</body></html>`;

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });

  writeFileSync("/tmp/apex-report.html", html);
  await page.pdf({
    path: "Apex-Backend-Report.pdf",
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", right: "15mm", bottom: "17mm", left: "15mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font:8px -apple-system,Arial,sans-serif;color:#5b6880;width:100%;padding:0 15mm;display:flex;justify-content:space-between"><span>Apex Care Technologies · Backend report</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log("wrote Apex-Backend-Report.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
