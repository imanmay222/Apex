import { writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Builds Apex-Project-Report.pdf: the academic submission report (problem, design, features,
 * comparison with the original site, testing, limits). Renders HTML in the installed Chrome.
 * Run: npx tsx scripts/build-project-report.ts
 */

const STUDENT = "Manmay Chakraborty";
const REG_NO = "24BAI1316";
const TODAY = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const table = (head: string[], rows: (string | number)[][], opts: { num?: number[]; caption?: string } = {}) => `
<table>
  ${opts.caption ? `<caption>${opts.caption}</caption>` : ""}
  <thead><tr>${head.map((h, i) => `<th${opts.num?.includes(i) ? ' class="n"' : ""}>${h}</th>`).join("")}</tr></thead>
  <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td${opts.num?.includes(i) ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody>
</table>`;
const list = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const olist = (items: string[]) => `<ol>${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;

const architecture = `
<svg viewBox="0 0 640 250" width="100%" role="img" aria-label="System architecture">
  <style>
    .b{fill:#f4f7fc;stroke:#0a2150;stroke-width:1.2}
    .h{fill:#0a2150}
    .t{font:600 11px Helvetica,Arial,sans-serif;fill:#0a2150}
    .w{font:600 11px Helvetica,Arial,sans-serif;fill:#fff}
    .s{font:9.5px Helvetica,Arial,sans-serif;fill:#47546b}
    .a{stroke:#ee4a24;stroke-width:1.6;fill:none;marker-end:url(#ar)}
  </style>
  <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ee4a24"/></marker></defs>
  <rect class="b" x="10" y="20" width="130" height="90" rx="6"/><rect class="h" x="10" y="20" width="130" height="22" rx="6"/>
  <text class="w" x="20" y="35">Visitor (browser)</text>
  <text class="s" x="20" y="60">Pages, search, forms,</text><text class="s" x="20" y="73">enquiry tracker,</text><text class="s" x="20" y="86">newsletter, testimonials</text>
  <rect class="b" x="10" y="140" width="130" height="90" rx="6"/><rect class="h" x="10" y="140" width="130" height="22" rx="6"/>
  <text class="w" x="20" y="155">Staff (API client)</text>
  <text class="s" x="20" y="180">Admin, editor, sales</text><text class="s" x="20" y="193">roles; session cookie</text><text class="s" x="20" y="206">or Bearer token</text>
  <rect class="b" x="215" y="20" width="215" height="210" rx="6"/><rect class="h" x="215" y="20" width="215" height="22" rx="6"/>
  <text class="w" x="225" y="35">Next.js 16 application</text>
  <rect class="b" x="227" y="52" width="191" height="38" rx="4"/><text class="t" x="235" y="67">Pages (server components)</text><text class="s" x="235" y="80">SSR, SEO metadata, JSON-LD, sitemap</text>
  <rect class="b" x="227" y="98" width="191" height="38" rx="4"/><text class="t" x="235" y="113">REST API (72 operations)</text><text class="s" x="235" y="126">validation, auth, rate limits, CSRF</text>
  <rect class="b" x="227" y="144" width="191" height="38" rx="4"/><text class="t" x="235" y="159">Services</text><text class="s" x="235" y="172">enquiries, media, search, analytics…</text>
  <rect class="b" x="227" y="190" width="191" height="30" rx="4"/><text class="t" x="235" y="209">Tag-invalidated read cache</text>
  <rect class="b" x="505" y="20" width="125" height="120" rx="6"/><rect class="h" x="505" y="20" width="125" height="22" rx="6"/>
  <text class="w" x="515" y="35">MongoDB</text>
  <text class="s" x="515" y="60">17 collections</text><text class="s" x="515" y="73">GridFS (uploads)</text><text class="s" x="515" y="86">TTL auto-expiry</text><text class="s" x="515" y="99">unique indexes</text><text class="s" x="515" y="112">rate-limit store</text>
  <rect class="b" x="505" y="160" width="125" height="70" rx="6"/><rect class="h" x="505" y="160" width="125" height="22" rx="6"/>
  <text class="w" x="515" y="175">Outbound</text>
  <text class="s" x="515" y="198">SMTP email</text><text class="s" x="515" y="211">Signed webhook</text>
  <path class="a" d="M140,65 H213"/><path class="a" d="M140,185 H213"/>
  <path class="a" d="M430,80 H503"/><path class="a" d="M430,195 H503"/>
</svg>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Apex Care Technologies: Project Report</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font: 10.4pt/1.55 Georgia, "Times New Roman", serif; color: #14192b; margin: 0; }
  h1, h2, h3, table, .sans { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
  h2 { font-size: 16pt; margin: 0 0 9pt; color: #0a2150; padding-bottom: 5pt; border-bottom: 2pt solid #ee4a24; line-height: 1.2; }
  h3 { font-size: 11.2pt; margin: 13pt 0 4pt; color: #0b4ba2; line-height: 1.25; }
  p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
  ul, ol { margin: 0 0 8pt; padding-left: 16pt; } li { margin-bottom: 2.5pt; text-align: justify; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .cover { height: 252mm; display: flex; flex-direction: column; justify-content: space-between; }
  .band { background: #0a2150; color: #fff; padding: 26mm 13mm 18mm; border-radius: 4pt; }
  .band .eyebrow { font: 700 9pt -apple-system, Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #ff8a63; }
  .band h1 { font-size: 27pt; margin: 9pt 0 10pt; line-height: 1.15; }
  .band p { color: #c8d3ea; font: 12pt/1.45 -apple-system, Arial, sans-serif; max-width: 140mm; text-align: left; }
  .id { border: 1pt solid #dbe3f0; border-radius: 8pt; padding: 12pt 16pt; font-family: -apple-system, Arial, sans-serif; }
  .id div { display: flex; padding: 3pt 0; font-size: 11.5pt; }
  .id span { width: 38mm; color: #5b6880; } .id b { color: #0a2150; }
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 9mm 0 0; }
  .stat { border: 1pt solid #dbe3f0; border-radius: 8pt; padding: 10pt; font-family: -apple-system, Arial, sans-serif; }
  .stat b { display: block; font-size: 21pt; color: #0b4ba2; line-height: 1.1; }
  .stat span { font-size: 8.4pt; color: #5b6880; }
  table { width: 100%; border-collapse: collapse; margin: 4pt 0 10pt; font-size: 8.9pt; line-height: 1.4; }
  caption { caption-side: bottom; text-align: left; font-size: 8.4pt; color: #5b6880; padding-top: 3pt; font-style: italic; }
  tr { page-break-inside: avoid; }
  th { text-align: left; background: #0a2150; color: #fff; padding: 5pt 7pt; font-weight: 600; }
  td { padding: 4.5pt 7pt; border-bottom: .6pt solid #e3e8f0; vertical-align: top; text-align: left; }
  tbody tr:nth-child(even) td { background: #f7f9fc; }
  .tight td { padding: 3.2pt 7pt; }
  h2, h3 { break-after: avoid; }
  .n { text-align: right; white-space: nowrap; }
  code { font: 8.4pt "SF Mono", Menlo, monospace; background: #eef2f9; padding: 1pt 3pt; border-radius: 3pt; }
  .ok { color: #0a7d3b; font-weight: 700; } .bad { color: #b42318; font-weight: 700; } .mid { color: #b45309; font-weight: 700; }
  .callout { background: #fff4ed; border-left: 3pt solid #ee4a24; padding: 8pt 11pt; border-radius: 0 6pt 6pt 0; margin: 9pt 0; font-size: 9.8pt; }
  .small { font-size: 8.6pt; color: #5b6880; }
  .toc { font-family: -apple-system, Arial, sans-serif; font-size: 10.5pt; }
  .toc div { display: flex; justify-content: space-between; border-bottom: .6pt dotted #b9c4d8; padding: 4.5pt 0; }
  .toc span:last-child { color: #5b6880; }
  figure { margin: 6pt 0 10pt; } figcaption { font: italic 8.4pt -apple-system, Arial, sans-serif; color: #5b6880; margin-top: 3pt; }
</style></head><body>

<!-- ============================== COVER ============================== -->
<section class="page cover">
  <div class="band">
    <div class="eyebrow">Project report</div>
    <h1>Apex Care Technologies: from a static brochure site to a database-driven web application</h1>
    <p>Design, implementation and evaluation of a full-stack rebuild of apexcaretechnologies.com using Next.js 16 and MongoDB.</p>
  </div>
  <div>
    <div class="id">
      <div><span>Submitted by</span><b>${STUDENT}</b></div>
      <div><span>Registration no.</span><b>${REG_NO}</b></div>
      <div><span>Date</span><b>${TODAY}</b></div>
    </div>
    <div class="stats">
      <div class="stat"><b>72</b><span>API operations<br>27 public · 45 admin</span></div>
      <div class="stat"><b>17</b><span>MongoDB collections<br>plus GridFS storage</span></div>
      <div class="stat"><b>300</b><span>automated tests<br>28 in a real browser</span></div>
      <div class="stat"><b>0</b><span>known production<br>dependency advisories</span></div>
    </div>
  </div>
</section>

<!-- ============================== CONTENTS + ABSTRACT ============================== -->
<section class="page">
  <h2>Contents</h2>
  <div class="toc">
    ${[
      ["1", "Abstract"], ["2", "Introduction and motivation"], ["3", "Objectives"], ["4", "Analysis of the existing website"],
      ["5", "Proposed system and architecture"], ["6", "Technology choices and justification"], ["7", "Database design"],
      ["8", "Features implemented"], ["9", "Security and privacy"], ["10", "Comparison: existing vs. proposed"],
      ["11", "Testing and validation"], ["12", "Limitations and future work"], ["13", "Conclusion"], ["A", "Appendix: API summary and how to run"],
    ].map(([n, t]) => `<div><span>${n}. ${t}</span></div>`).join("")}
  </div>

  <h2 style="margin-top:14mm">1. Abstract</h2>
  <p>Apex Care Technologies is a supplier of fire-safety, personal-protective, welding and gas-detection equipment based in Cuddalore, Tamil Nadu. Its existing website is a set of hand-written static HTML pages: all content is typed directly into the page files, an enquiry is sent to a single server script, and there is no way for the business to edit content, track customer enquiries or measure visitors without a developer.</p>
  <p>This project rebuilds the website as a full-stack application. A single <b>Next.js 16</b> application serves both the public pages and a documented <b>REST API</b>, and <b>MongoDB</b> is the only data store: product catalogue, enquiries, users, sessions, analytics and uploaded files. The result provides 72 API operations over 17 collections, a layered anti-spam and security design, role-based administration, enquiry tracking for customers, a double opt-in newsletter, moderated testimonials, first-party privacy-preserving analytics, full-text search, search-engine optimisation, and a content backup and restore facility.</p>
  <p>The system is verified by <b>300 automated tests</b>, of which 28 drive a real Chrome browser through the user interface. This report explains why the rebuild was needed, how it was designed, what was built, and how it improves on the original site. It also states honestly what is not yet done, chiefly that administration is currently available through the API only and does not yet have a graphical interface.</p>
</section>

<!-- ============================== INTRODUCTION ============================== -->
<section class="page">
  <h2>2. Introduction and motivation</h2>
  <p>For a small industrial supplier, the website is the main route by which new customers find the company and ask for a quotation. Buyers of safety equipment typically look for a specific item (for example a self-contained breathing apparatus or a gas detector), compare options and then ask for a price. The site therefore has three jobs: present the catalogue accurately, make it easy to ask for a quote, and let the business respond quickly and keep a record of every lead.</p>
  <h3>2.1 Why a rebuild was needed</h3>
  <p>A brochure site built from static files can show information, but it cannot manage it. The practical consequences for the business are:</p>
  ${list([
    "<b>Every content change needs a developer.</b> Adding a product, correcting a phone number or publishing a new training programme means editing HTML files and re-uploading them.",
    "<b>Leads are fragile.</b> An enquiry depends on a single script and, as far as a visitor can see, is not given a reference number, cannot be followed up by the customer and has no status.",
    "<b>No visibility.</b> The business cannot see how many people visit, which products they view, what they search for, or what fraction of visitors send an enquiry.",
    "<b>Weak discoverability.</b> Individual products have no pages of their own, so they cannot be found, linked or shared, and search engines are given little structured information.",
    "<b>Open to abuse.</b> Public forms attract automated spam; without defences, the sales inbox fills with junk and genuine leads are lost.",
  ])}
  <h3>2.2 Scope of this project</h3>
  <p>The visual design and page set of the original site were kept recognisable so that the business is not asked to relearn its own website. The engineering effort went into what lies underneath: a real data layer, a secure API, the business workflows around enquiries, and the quality assurance needed to trust them.</p>

  <h2 style="margin-top:12mm">3. Objectives</h2>
  ${olist([
    "Store <b>all</b> site content in a database and render every page from it, so that an edit is visible on the live site immediately.",
    "Give each product, survey and training programme its own addressable page with proper search-engine metadata.",
    "Capture every enquiry reliably, number it, notify the sales team by email, acknowledge the customer, and let the customer check progress.",
    "Protect the public forms against spam and abuse without inconveniencing real visitors.",
    "Provide secure, role-based administration for content, enquiries, users and settings.",
    "Measure site usage without tracking individuals, and respect visitor privacy signals.",
    "Make the whole system easy to run, easy to back up and demonstrably correct through automated testing.",
  ])}
</section>

<!-- ============================== EXISTING SYSTEM ============================== -->
<section class="page">
  <h2>4. Analysis of the existing website</h2>
  <p>The live site at apexcaretechnologies.com was inspected on ${TODAY}, using its public pages, response headers and the scripts it serves. Only what is observable from outside is reported here; the server-side behaviour of its enquiry script, in particular, cannot be inspected and is not assumed.</p>
  ${table(
    ["Aspect", "Observation on the existing site"],
    [
      ["Construction", "Static HTML files (<code>index.html</code>, <code>products.html</code>, <code>survey.html</code> …) with Bootstrap and jQuery; content is written into the page files."],
      ["Product pages", "All product categories link to one general <code>products.html</code>; there is no individual page, address or search-engine entry per product."],
      ["Enquiry submission", "A browser script validates the form and posts it to <code>enquiry.php</code>. Phone validation accepts only exactly ten digits (<code>/^\\d{10}$/</code>), so <code>+91</code> or international numbers are rejected. The form has no email field, so the customer can never be answered or acknowledged by email."],
      ["Enquiry follow-up", "The confirmation says only “We’ll be in touch”. No reference number is shown; there is no status or tracking page."],
      ["Spam control", "No honeypot, token or rate limit is visible in the client code."],
      ["Search", "None."],
      ["Search-engine files", "<code>/sitemap.xml</code> and <code>/robots.txt</code> both return 404; no structured data was found on the home page."],
      ["Contact details", "Email addresses are hidden by Cloudflare’s obfuscation script; they are not part of any editable settings."],
      ["Content administration", "No administration area or content-management system was found."],
      ["Analytics, newsletter, testimonials", "None visible."],
      ["Copy quality", "Inconsistent capitalisation in menus (“survey”, “contact Us”) and typos in the form labels."],
    ],
    { caption: "Table 1. Observed characteristics of the existing website." },
  )}
  <div class="callout"><b>Conclusion of the analysis.</b> The existing site is adequate as an online brochure but has no content management, no lead management, no visibility into usage and limited discoverability. These are limits of its architecture, not of its design, and they are what the rebuild addresses.</div>
</section>

<!-- ============================== ARCHITECTURE ============================== -->
<section class="page">
  <h2>5. Proposed system and architecture</h2>
  <p>The proposed system is a single deployable application. Next.js renders the public pages on the server and exposes the REST API from the same codebase; both talk to one MongoDB database. There is no separate backend service, no third-party content-management system and no second data store to keep in step.</p>
  <figure>${architecture}<figcaption>Figure 1. High-level architecture. Visitors and staff use the same application; MongoDB is the single source of truth.</figcaption></figure>
  <h3>5.1 Layering</h3>
  ${table(
    ["Layer", "Responsibility"],
    [
      ["Pages (<code>src/app</code>)", "Server-rendered pages: Home, About, Products, Product detail, Survey, Survey detail, Training, Contact, 404 and error pages; <code>sitemap.xml</code> and <code>robots.txt</code> generated from the database."],
      ["API routes (<code>src/app/api</code>)", "56 route files exposing 72 operations with a uniform response format and request ids."],
      ["Validation (<code>src/server/validation</code>)", "Every request body and query string is checked against a strict schema; unknown fields are rejected."],
      ["Services (<code>src/server/services</code>)", "Business logic: enquiries, notifications, media, search, analytics, audit, import and backup, users, settings, dashboard."],
      ["Data (<code>src/server/db</code>, <code>data</code>)", "Mongoose models with indexes, and cached read functions that are invalidated by tag when content changes."],
      ["Cross-cutting (<code>src/server/lib</code>, <code>auth</code>, <code>mail</code>)", "Request wrapper, errors, rate limiting, signed tokens, password hashing, sessions, permissions, mail templates."],
    ],
    { caption: "Table 2. Application layers and their responsibilities." },
  )}
  <h3>5.2 How a request is handled</h3>
  <p>Take a customer enquiry as an example. The page fetches a short-lived signed token; the visitor fills in the form; the browser posts it with the token. The server checks the token and honeypot, validates and normalises the fields, scores the content for spam, applies per-address limits, allocates a reference number atomically, stores the enquiry and returns the reference. Email to the sales team, the acknowledgement to the customer and the optional webhook are then sent, and each channel records its own status, attempt count and last error so that a failure is visible and can be retried.</p>
</section>

<!-- ============================== TECH CHOICES ============================== -->
<section class="page">
  <h2>6. Technology choices and justification</h2>
  ${table(
    ["Technology", "Role", "Why it was chosen"],
    [
      ["Next.js 16 (App Router)", "Website and API in one application", "Server rendering gives fast first loads and good search-engine indexing; route handlers remove the need for a separate API server; one deployment."],
      ["React 19", "User interface", "Component model suits the repeated cards, forms and dialogs; server components keep database access off the client."],
      ["MongoDB 8 + Mongoose 9", "Single data store", "Catalogue items have varied attributes (specifications, tags, galleries) that fit documents naturally; TTL indexes expire data automatically; GridFS stores uploads in the same database, so there is one thing to back up."],
      ["Zod 4", "Validation", "One schema defines both the check and the TypeScript type, so the API contract cannot drift from the code."],
      ["TypeScript 5", "Language", "Type checking across API, services and UI catches mismatches at build time."],
      ["Tailwind CSS 4", "Styling", "Consistent design tokens, responsive layout and dark-mode support."],
      ["Nodemailer", "Email", "Standard SMTP client; a local mail catcher is used in development so emails can be inspected without sending any."],
      ["Node crypto (scrypt, HMAC, SHA-256)", "Security primitives", "Built-in, audited primitives instead of extra dependencies."],
      ["Node test runner + Playwright core", "Testing", "Unit and API tests run against a real throw-away database; browser tests drive the installed Chrome."],
    ],
    { caption: "Table 3. Technology stack." },
  )}
  <h3>6.1 Why one database for everything</h3>
  <p>An earlier plan used a hosted content-management service alongside a database. It was dropped: two stores mean two sets of credentials, two backup procedures and the risk of content and enquiries disagreeing. Keeping content, enquiries, users, analytics and files in MongoDB gives one consistent system, one backup and one place to look when something goes wrong.</p>
  <h3>6.2 Why not a CMS or website builder</h3>
  <p>A ready-made CMS would give an editing screen quickly but would constrain the enquiry workflow, tracking, spam handling and privacy-preserving analytics that the business actually needs, and would bring its own maintenance and security burden. Building on a framework keeps those behaviours exactly as specified and testable.</p>
</section>

<!-- ============================== DATABASE ============================== -->
<section class="page">
  <h2>7. Database design</h2>
  <p>The database has 17 collections and a GridFS bucket for files. Slugs and reference numbers are unique-indexed; operational collections carry TTL indexes so that old data removes itself.</p>
  ${table(
    ["Collection", "Holds", "Notable design points"],
    [
      ["products", "Catalogue items", "Unique slug; belongs to a product group; featured flag, ordering, publish state, description, features, specification table, tags, gallery, SEO overrides"],
      ["productgroups", "Categories (5)", "Cannot be deleted or re-keyed while products reference them"],
      ["surveys", "Survey/instrument pages (9)", "Own pages, ordering, publish state"],
      ["trainings", "Training programmes (10)", "Own page content and ordering"],
      ["galleries · logos · leaders", "Gallery, client and brand logos, leadership", "Ordered, publishable"],
      ["testimonials", "Customer feedback", "Public submissions stored unpublished; submitter email kept private"],
      ["sitesettings", "Singleton settings", "Company details, phones, emails, address, map, social links, tax numbers, About text, home-page copy, catalogue file"],
      ["enquiries", "Leads", "Reference number, status history, priority, assignee, tags, internal notes, per-channel notification state; spam rows auto-deleted after 30 days"],
      ["subscribers", "Newsletter", "Pending/confirmed/unsubscribed; unconfirmed rows expire after 14 days"],
      ["adminusers · sessions", "Staff and logins", "Only a hash of each session token is stored; sessions expire automatically"],
      ["analytics", "Usage events", "No raw IP addresses; daily-rotating visitor hash; expires after 400 days"],
      ["audit", "Change history", "Who changed which fields (not the values); expires after 730 days"],
      ["counters · ratelimits", "Infrastructure", "Atomic yearly enquiry counter; request windows stored in the database so limits hold across servers and restarts"],
      ["media.files / media.chunks (GridFS)", "Uploaded images and PDFs", "De-duplicated by SHA-256; usage-tracked"],
    ],
    { caption: "Table 4. Collections." },
  )}
  <h3>7.1 Initial data</h3>
  <p>An idempotent seeding script loads the original site’s content into the database (39 products, 5 groups, 9 surveys, 10 training programmes, 8 gallery items, 19 logos, 3 leaders and the site settings) and creates the first administrator. Running it again restores anything deleted but never overwrites edits.</p>
</section>

<!-- ============================== FEATURES 1 ============================== -->
<section class="page">
  <h2>8. Features implemented</h2>
  <h3>8.1 Database-driven public website</h3>
  ${list([
    "Every page reads live data; no content is hard-coded. Home-page statistics (counts, years in business) are computed from the database.",
    "Reads are cached and invalidated by tag, so an administrator’s edit appears on the site, in the sitemap, in search and in the enquiry drop-downs without redeploying.",
    "Each product, survey and training item has its own page and address, with its own title, description, canonical link and OpenGraph data.",
    "Structured data (<code>Organization</code>, <code>Product</code>, <code>Service</code> JSON-LD), a database-generated <code>sitemap.xml</code> and a <code>robots.txt</code>.",
    "Friendly 404 and error pages; responsive layout, dark mode, an image lightbox and a mobile action bar for call, WhatsApp and products.",
  ])}
  <h3>8.2 Enquiry management (the core business feature)</h3>
  ${list([
    "<b>Form on every relevant page</b> (Home, Contact, Product, Survey, Training). The subject is checked against real published items.",
    "<b>Validation:</b> Indian mobile numbers accepted with or without <code>+91</code>/<code>0</code> and normalised to <code>+91…</code>; international numbers accepted; email optional but verified when given.",
    "<b>Reference numbers</b> such as <code>ENQ-2026-000123</code>, allocated atomically per year so two simultaneous enquiries can never share one.",
    "<b>Notifications by channel:</b> email to sales (with the customer as Reply-To), an acknowledgement to the customer containing the reference, and an optional HMAC-signed webhook. Each records status, attempts and last error; failed deliveries are retried (maximum five attempts) by an administrator action or a scheduled job.",
    "<b>Customer tracking:</b> reference plus mobile number shows a friendly status (Received, In progress, Quote sent, Closed) and timeline. Internal notes and assignee are never exposed, and a wrong reference and a wrong mobile give identical answers so that references cannot be probed.",
    "<b>Staff triage (API):</b> filtering by status, type, priority, assignee, date and free text; sorting and pagination; status workflow with full history and first-response time; priority, assignment, tags and internal notes; bulk update; admin-only deletion; CSV export protected against spreadsheet formula injection.",
  ])}
  <h3>8.3 Anti-spam without annoying real customers</h3>
  <p>Defences are layered and silent. A signed form token proves the page was loaded and enforces a minimum fill time; a hidden honeypot field catches simple bots; content scoring looks at links, spam vocabulary, disposable email domains and URLs in names; identical submissions within ten minutes collapse into one; and per-address burst and daily limits apply. A bot is told the submission succeeded, but spam is stored out of sight, never emailed, and deleted after 30 days. No CAPTCHA is shown to genuine visitors.</p>
  <h3>8.4 Customer testimonials with moderation</h3>
  <p>A “Share your experience” form on the About page stores submissions as <i>unpublished</i> and emails the team. Nothing becomes public until an administrator approves it; rejection deletes it. The submitter’s email is retained for staff only.</p>
  <h3>8.5 Newsletter with double opt-in</h3>
  <p>A footer sign-up sends a confirmation email, and the address is subscribed only when its owner presses the button on the confirmation page. Links open a page rather than performing the action on a GET request, so email security scanners that “click” links cannot confirm or unsubscribe anyone. Every email carries a one-click unsubscribe. The response is identical for new, pending and already-subscribed addresses so that the list cannot be probed. Staff can list subscribers, export confirmed addresses and erase a person permanently.</p>
  <h3>8.6 Search</h3>
  <p>A live search dialog in the header searches products, surveys and training together. All terms must match, results are ranked by relevance, queries are escaped so they cannot inject patterns or cause regular-expression slowdowns, and out-of-date requests are cancelled as the visitor types.</p>
  <h3>8.7 Media library</h3>
  <p>Images (up to 8 MB) and PDFs (up to 25 MB) are stored in GridFS. The file type is determined from the file’s actual bytes rather than the name or declared type, so a renamed executable or an SVG/HTML file is refused. Identical uploads are de-duplicated, files are served with long-lived caching and ETag support, and a file still referenced by content cannot be deleted without an explicit force. The brochure PDF is downloaded through a tracked link that counts each download.</p>
  <h3>8.8 Privacy-preserving analytics</h3>
  <p>A cookie-less beacon records page views, product and survey views, and clicks on call, WhatsApp and email links; the server records catalogue downloads, searches and enquiries. No raw IP address is stored, visitors are identified only by a hash that changes daily, bots are dropped, and Do Not Track and Global Privacy Control are honoured. The administrator report gives totals, unique visitors, the enquiry conversion rate, a daily series, top pages, products, surveys and searches, call-to-action clicks, devices and referrers for any date range.</p>
  <h3>8.9 Administration</h3>
  ${list([
    "<b>Generic content management for 8 content types:</b> list with search, filter, sort and pagination; create with automatic unique slugs; partial update; delete; reorder; bulk publish, unpublish and delete; referential integrity.",
    "<b>Dashboard:</b> counts, enquiries by status and type, 14-day trend, open and unassigned enquiries, failed notifications, average first-response time, recent enquiries.",
    "<b>Settings editing</b> (company details, contacts, About and home copy) with nested merge; map embeds restricted to Google Maps.",
    "<b>Audit log</b> of who changed what, and a manual cache purge.",
    "<b>Backup and restore:</b> a full JSON export of site content, and an import that validates the whole file first; any problem rejects the entire file, writes nothing and points to the exact offending row.",
  ])}
  <h3>8.10 Authentication and roles</h3>
  <p>Email and password sign-in, with passwords hashed using scrypt and a policy of at least 12 characters, mixing letters and digits, and not common or derived from the email address. Sessions are opaque server-side records with a seven-day sliding expiry; a staff member can list their devices and sign out one or all others. Three roles control twelve permissions: <i>admin</i> (everything), <i>editor</i> (content, media, analytics) and <i>sales</i> (enquiries, subscriber list, analytics). The last administrator and the acting user cannot be removed or demoted.</p>
</section>

<!-- ============================== SECURITY ============================== -->
<section class="page">
  <h2>9. Security and privacy</h2>
  ${table(
    ["Threat", "Measure in the system"],
    [
      ["Password theft", "scrypt hashing with per-user salt; hashes never returned by the API; password change revokes other sessions."],
      ["Session theft", "Random token of which only a SHA-256 is stored; HttpOnly, SameSite=Lax cookie (Secure over HTTPS); server-side revocation."],
      ["Brute force", "Per-address limit, per-address-and-email limit and account lockout (10 failures, 15 minutes). Unknown emails receive the same error and take comparable time, so accounts cannot be enumerated."],
      ["Cross-site request forgery", "Origin and Sec-Fetch-Site checks on cookie-authenticated writes."],
      ["Privilege escalation", "Role-based permissions checked on every admin operation; role changes and deactivation end sessions."],
      ["Injection", "Strict schemas; typed queries so user input cannot introduce database operators; escaped regular expressions; HTML-escaped email templates; header-injection guards; escaped JSON-LD; CSV formula neutralisation."],
      ["Malicious uploads", "Content sniffing, size limits, executable/SVG/HTML refusal, <code>nosniff</code> and sandboxing CSP on served files."],
      ["Spam and flooding", "Token, honeypot, scoring, duplicate collapsing and database-backed rate limits with <code>X-RateLimit-*</code> headers."],
      ["Excess data collection", "No raw IPs; daily-rotating visitor hash; consent-based newsletter; erasure endpoint; TTL expiry of sessions, analytics, audit logs, spam and unconfirmed subscribers."],
      ["Outages", "Database down returns a clean 503; failed emails and webhooks are recorded and retried; a health endpoint reports database and mail status."],
      ["Vulnerable dependencies", "Next.js upgraded 16.3.6 to 16.4.2 to fix two advisories; <code>npm audit --omit=dev</code> reports none."],
    ],
    { caption: "Table 5. Threats and countermeasures." },
  )}
</section>

<!-- ============================== COMPARISON ============================== -->
<section class="page tight">
  <h2>10. Comparison: existing vs. proposed</h2>
  <p>The existing column describes what is observable on the live site (section 4). The proposed column describes what is implemented and tested in this project.</p>
  ${table(
    ["Capability", "Existing site", "Proposed system"],
    [
      ["Content storage", "In HTML files", "<span class='ok'>MongoDB; edits appear live</span>"],
      ["Changing a product or phone number", "Needs a developer to edit and upload files", "<span class='ok'>One authenticated API call; no redeploy</span>"],
      ["Individual product pages", "<span class='bad'>No</span> (one shared page)", "<span class='ok'>Yes, 39 products with own address and metadata</span>"],
      ["Site search", "<span class='bad'>None</span>", "<span class='ok'>Live, ranked, cross-collection</span>"],
      ["Phone number validation", "Exactly 10 digits only", "<span class='ok'>Indian formats normalised to +91; international accepted</span>"],
      ["Customer email on enquiry", "<span class='bad'>No field</span>", "<span class='ok'>Optional, verified; acknowledgement emailed</span>"],
      ["Reference number for an enquiry", "<span class='bad'>No</span>", "<span class='ok'>Yes, e.g. ENQ-2026-000123</span>"],
      ["Customer can check status", "<span class='bad'>No</span>", "<span class='ok'>Yes, via reference + mobile</span>"],
      ["Staff lead management", "Not visible", "<span class='ok'>Status, priority, assignee, notes, history, bulk, CSV</span>"],
      ["Spam protection on forms", "None visible", "<span class='ok'>Token, honeypot, scoring, rate limits (silent)</span>"],
      ["Failed notification handling", "Unknown", "<span class='ok'>Per-channel status and retries</span>"],
      ["Newsletter", "<span class='bad'>None</span>", "<span class='ok'>Double opt-in, unsubscribe, export, erasure</span>"],
      ["Testimonials", "<span class='bad'>None</span>", "<span class='ok'>Public submission with moderation</span>"],
      ["Analytics", "<span class='bad'>None visible</span>", "<span class='ok'>First-party, no cookies, no raw IPs, DNT honoured</span>"],
      ["Search-engine optimisation", "<span class='bad'>No sitemap or robots.txt</span>; no structured data found", "<span class='ok'>Sitemap, robots, JSON-LD, canonical and OpenGraph per page</span>"],
      ["User accounts and roles", "<span class='bad'>No admin area found</span>", "<span class='ok'>3 roles, 12 permissions, audit log</span>"],
      ["Uploads and file handling", "Static files", "<span class='ok'>GridFS, byte-level type check, de-duplication, usage tracking</span>"],
      ["Backup and restore", "Copy files", "<span class='ok'>Validated JSON export and all-or-nothing import</span>"],
      ["Automated testing", "None known", "<span class='ok'>300 tests incl. real-browser tests</span>"],
      ["Graphical admin interface", "<span class='bad'>No</span>", "<span class='mid'>Not yet; API only (see section 12)</span>"],
    ],
    { caption: "Table 6. Capability comparison." },
  )}
  <div class="callout"><b>Summary.</b> The public look and page structure remain familiar. The improvement is in everything behind them: the business can now manage its own content, capture and follow up leads reliably, understand its audience, and be found by search engines, while visitors gain search, individual product pages and a way to check their enquiry.</div>
</section>

<!-- ============================== TESTING ============================== -->
<section class="page">
  <h2>11. Testing and validation</h2>
  <p>Testing is automated and hermetic: <code>npm test</code> starts its own temporary MongoDB and mail catcher on free ports, seeds data, builds and serves the application, runs every suite and removes everything afterwards, so the developer’s own data is never touched.</p>
  ${table(
    ["Suite", "Tests", "What it demonstrates"],
    [
      ["Unit", 49, "Slugs, phone parsing, CSV-injection guard, spam scoring, file sniffing, password hashing, tokens, permissions"],
      ["Public API", 38, "Every public endpoint, filters, pagination, search, caching and security headers"],
      ["Enquiries", 38, "End-to-end pipeline including real emails, spam handling, rate limits, triage, notes, bulk actions, CSV"],
      ["Authentication", 33, "Login, enumeration resistance, lockout, sessions, CSRF, role matrix, user management"],
      ["Content", 35, "CRUD for all content types, instant public visibility, integrity rules, settings merge"],
      ["Engagement", 27, "Testimonials, tracking, newsletter double opt-in, import and restore"],
      ["Media", 16, "Upload, serving, ETag, hostile uploads, usage-aware delete, PDF catalogue"],
      ["Operations", 20, "Analytics, audit log, export, scheduled retries, access control"],
      ["Infrastructure", 10, "TTL and unique indexes, seed idempotency, hashing at rest"],
      ["Webhook", 6, "Signature, failure then retry then success, attempt cap"],
      ["Browser (real Chrome)", 28, "All pages free of console errors and broken images; search; forms; tracker; newsletter; testimonial; lightbox; mobile; dark mode; SEO tags; analytics; privacy signal"],
    ],
    { num: [1], caption: "Table 7. Automated test suites (300 tests in total)." },
  )}
  <h3>11.1 Static checks</h3>
  <p>The TypeScript type-check and the linter are run against the whole project, and the production build succeeds without needing a database.</p>
  <h3>11.2 What testing has not covered</h3>
  <p>Browser tests ran in headless Google Chrome only; other browsers, assistive technologies and real-world load have not been tested. Email was verified through a local mail catcher rather than a live mail provider.</p>
</section>

<!-- ============================== LIMITS + CONCLUSION ============================== -->
<section class="page">
  <h2>12. Limitations and future work</h2>
  ${table(
    ["Limitation", "Effect", "Planned next step"],
    [
      ["<b>No graphical admin interface</b>", "Staff must use the API (for example with curl or Postman) to edit content and handle enquiries.", "Build an admin web application on the existing API; the API was designed for this."],
      ["Newsletter campaigns not sent", "Sign-ups, consent and export exist; sending does not.", "Export confirmed addresses to a mailing tool, or add a sending job."],
      ["Real SMTP not exercised", "Emails verified through a local catcher.", "Configure a production SMTP provider and send a test."],
      ["Single-browser verification", "Chrome only.", "Cross-browser and accessibility testing (screen readers)."],
      ["Product copy is generic", "Descriptions are the original category text; no certifications or standards are claimed.", "Add real descriptions, features and specifications."],
      ["Development-only advisories", "Five advisories remain in lint tooling; nothing ships to production.", "Revisit when the tooling publishes a fix that does not downgrade Next.js."],
    ],
    { caption: "Table 8. Known limitations." },
  )}
  <h2 style="margin-top:12mm">13. Conclusion</h2>
  <p>The project turns a static brochure site into a maintainable, secure web application whose content, leads and usage data live in one database. It meets each objective set out in section 3: content is database-driven and live; every product has its own page; enquiries are validated, numbered, notified, trackable and protected from spam; administration is role-based and audited; analytics respect privacy; and the whole system can be run with one command and checked with 300 automated tests.</p>
  <p>Compared with the original, the clearest gains are in lead handling (reference numbers, acknowledgements, tracking and a triage workflow), discoverability (individual pages, sitemap, structured data and search) and operability (editing without a developer, backup and restore, audit and monitoring). The principal remaining work is a graphical administration interface so that non-technical staff can use these capabilities without the API.</p>
</section>

<!-- ============================== APPENDIX ============================== -->
<section class="page">
  <h2>Appendix A. API summary and how to run</h2>
  <h3>A.1 API operations (72)</h3>
  ${table(
    ["Group", "Operations"],
    [
      ["Public content (12)", "<code>GET /api/settings · stats · products · products/{slug} · product-groups · surveys · surveys/{slug} · training · gallery · testimonials · leaders · logos</code>"],
      ["Public utility (4)", "<code>GET /api/search · catalogue · media/{id} · health</code>"],
      ["Public enquiries and engagement (11)", "<code>GET /api/enquiries/token</code>; <code>POST /api/enquiries · enquiries/track · testimonials · newsletter/subscribe · analytics/events</code>; <code>GET+POST /api/newsletter/confirm · unsubscribe</code>"],
      ["Scheduled (1)", "<code>POST /api/cron/notifications</code> (secret-protected)"],
      ["Admin (45)", "Authentication and sessions; users; enquiries (list, get, update, delete, notes, resend, bulk, CSV); content for 8 types (list, create, get, update, delete, reorder, bulk); settings; media; subscribers; dashboard; analytics; audit; export, import and cache purge"],
    ],
    { caption: "Table 9. API overview. Full table in features.readme.md." },
  )}
  <h3>A.2 Running the project</h3>
  <p>Requirements: Node 20.9 or later (developed on Node 24). No Docker or system database is needed.</p>
  <p><code>npm install</code> then <code>npm run dev:all</code>. This starts a local MongoDB, a local mail catcher, seeds the database and runs the site:</p>
  ${list([
    "Website: <code>http://localhost:3000</code>",
    "Mail catcher (every email the site sends): <code>http://127.0.0.1:8025</code>",
    "Database: <code>mongodb://127.0.0.1:27017/apex</code>",
    "Tests: <code>npm test</code> · type-check: <code>npm run typecheck</code> · lint: <code>npm run lint</code>",
  ])}
  <h3>A.3 Project documents</h3>
  <p><code>README.md</code> (how to run), <code>features.readme.md</code> (complete feature inventory), <code>.env.example</code> (every setting) and the source in <code>src/</code>, <code>scripts/</code> and <code>tests/</code>.</p>
  <p class="small" style="margin-top:12mm">Report prepared by ${STUDENT} (${REG_NO}), ${TODAY}. Observations of the existing website were made from its public pages and scripts on that date and may change as the site is updated.</p>
</section>

</body></html>`;

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  if (process.env.REPORT_HTML) writeFileSync(process.env.REPORT_HTML, html);
  await page.pdf({
    path: "Apex-Project-Report.pdf",
    format: "A4",
    printBackground: true,
    margin: { top: "15mm", right: "16mm", bottom: "18mm", left: "16mm" },
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="font:8px -apple-system,Arial,sans-serif;color:#5b6880;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Apex Care Technologies · Project report · ${STUDENT} (${REG_NO})</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log("wrote Apex-Project-Report.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
