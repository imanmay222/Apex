import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright-core";

/**
 * Builds Apex-Project-Report.pdf: the final academic report (problem, requirements, design,
 * features, walkthroughs with screenshots, security, comparison, testing, deployment, limits).
 * Renders HTML in the installed Chrome. Screenshots come from docs/report-figures/
 * (refresh them with scripts/capture-report-figures.ts while the site is running).
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

/** Embeds a screenshot from docs/report-figures, or a visible placeholder if it hasn't been captured. */
function figure(file: string, caption: string, opts: { width?: string } = {}) {
  const path = `docs/report-figures/${file}`;
  const img = existsSync(path)
    ? `<img src="data:image/jpeg;base64,${readFileSync(path).toString("base64")}" alt="${caption.replace(/<[^>]+>/g, "")}" style="width:${opts.width ?? "86%"}">`
    : `<div class="missing">Screenshot ${file} not captured. Run scripts/capture-report-figures.ts.</div>`;
  return `<figure class="shot">${img}<figcaption>${caption}</figcaption></figure>`;
}

const architecture = `
<svg viewBox="0 0 640 290" width="100%" role="img" aria-label="System architecture">
  <style>
    .b{fill:#f4f7fc;stroke:#0a2150;stroke-width:1.2}
    .h{fill:#0a2150}
    .t{font:600 11px Helvetica,Arial,sans-serif;fill:#0a2150}
    .w{font:600 11px Helvetica,Arial,sans-serif;fill:#fff}
    .s{font:9.5px Helvetica,Arial,sans-serif;fill:#47546b}
    .a{stroke:#ee4a24;stroke-width:1.6;fill:none;marker-end:url(#ar)}
  </style>
  <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ee4a24"/></marker></defs>
  <rect class="b" x="10" y="20" width="135" height="110" rx="6"/><rect class="h" x="10" y="20" width="135" height="22" rx="6"/>
  <text class="w" x="20" y="35">Customer (browser)</text>
  <text class="s" x="20" y="60">Catalogue, search,</text><text class="s" x="20" y="73">quote basket and order,</text><text class="s" x="20" y="86">enquiries, tracking,</text><text class="s" x="20" y="99">testimonials, newsletter</text><text class="s" x="20" y="112">Basket kept in the browser</text>
  <rect class="b" x="10" y="160" width="135" height="110" rx="6"/><rect class="h" x="10" y="160" width="135" height="22" rx="6"/>
  <text class="w" x="20" y="175">Staff (admin panel)</text>
  <text class="s" x="20" y="200">Web UI at /admin</text><text class="s" x="20" y="213">Roles: admin, editor,</text><text class="s" x="20" y="226">sales</text><text class="s" x="20" y="239">HttpOnly session cookie</text>
  <rect class="b" x="215" y="20" width="215" height="250" rx="6"/><rect class="h" x="215" y="20" width="215" height="22" rx="6"/>
  <text class="w" x="225" y="35">Next.js 16 application</text>
  <rect class="b" x="227" y="50" width="191" height="30" rx="4"/><text class="t" x="235" y="64">Proxy</text><text class="s" x="235" y="75">/admin gate (no cookie → sign-in)</text>
  <rect class="b" x="227" y="86" width="191" height="38" rx="4"/><text class="t" x="235" y="101">Pages (server components)</text><text class="s" x="235" y="114">public site + admin panel screens</text>
  <rect class="b" x="227" y="130" width="191" height="38" rx="4"/><text class="t" x="235" y="145">REST API (84 operations)</text><text class="s" x="235" y="158">validation, sessions, roles, CSRF</text>
  <rect class="b" x="227" y="174" width="191" height="38" rx="4"/><text class="t" x="235" y="189">Services</text><text class="s" x="235" y="202">orders, enquiries, media, analytics…</text>
  <rect class="b" x="227" y="218" width="191" height="40" rx="4"/><text class="t" x="235" y="233">Notification engine + cache</text><text class="s" x="235" y="247">per-channel status, retries, tags</text>
  <rect class="b" x="505" y="20" width="125" height="130" rx="6"/><rect class="h" x="505" y="20" width="125" height="22" rx="6"/>
  <text class="w" x="515" y="35">MongoDB (Atlas)</text>
  <text class="s" x="515" y="60">18 collections</text><text class="s" x="515" y="73">GridFS (uploads)</text><text class="s" x="515" y="86">TTL auto-expiry</text><text class="s" x="515" y="99">unique indexes</text><text class="s" x="515" y="112">rate-limit store</text><text class="s" x="515" y="125">sessions, audit</text>
  <rect class="b" x="505" y="180" width="125" height="90" rx="6"/><rect class="h" x="505" y="180" width="125" height="22" rx="6"/>
  <text class="w" x="515" y="195">Outbound</text>
  <text class="s" x="515" y="220">SMTP email (optional)</text><text class="s" x="515" y="233">Signed webhook</text><text class="s" x="515" y="246">(optional)</text>
  <path class="a" d="M145,75 H213"/><path class="a" d="M145,215 H213"/>
  <path class="a" d="M430,90 H503"/><path class="a" d="M430,235 H503"/>
</svg>`;

const orderStates = `
<svg viewBox="0 0 640 120" width="100%" role="img" aria-label="Order status workflow">
  <style>
    .st{fill:#f4f7fc;stroke:#0a2150;stroke-width:1.2}
    .sx{fill:#fff4ed;stroke:#ee4a24;stroke-width:1.2}
    .tt{font:600 10.5px Helvetica,Arial,sans-serif;fill:#0a2150}
    .ts{font:9px Helvetica,Arial,sans-serif;fill:#47546b}
    .ar{stroke:#0b4ba2;stroke-width:1.4;fill:none;marker-end:url(#a2)}
    .dash{stroke:#ee4a24;stroke-width:1.2;fill:none;stroke-dasharray:4 3;marker-end:url(#a3)}
  </style>
  <defs>
    <marker id="a2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#0b4ba2"/></marker>
    <marker id="a3" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#ee4a24"/></marker>
  </defs>
  ${["New|Received", "Quoted|Quote sent", "Confirmed|Confirmed", "Dispatched|Dispatched", "Delivered|Delivered"]
    .map((pair, i) => {
      const [staff, customer] = pair.split("|");
      const x = 8 + i * 127;
      return `<rect class="st" x="${x}" y="14" width="104" height="44" rx="6"/><text class="tt" x="${x + 10}" y="32">${staff}</text><text class="ts" x="${x + 10}" y="48">customer sees: ${customer}</text>${i < 4 ? `<path class="ar" d="M${x + 104},36 H${x + 125}"/>` : ""}`;
    })
    .join("")}
  <rect class="sx" x="262" y="80" width="116" height="32" rx="6"/><text class="tt" x="276" y="100">Cancelled</text>
  <path class="dash" d="M60,58 C60,96 200,96 260,96"/><path class="dash" d="M440,58 C440,96 400,96 380,96"/>
</svg>`;

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Apex Care Technologies: Final Project Report</title>
<style>
  @page { size: A4; }
  * { box-sizing: border-box; }
  body { font: 10.4pt/1.55 Georgia, "Times New Roman", serif; color: #14192b; margin: 0; }
  h1, h2, h3, table, .sans { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; }
  h2 { font-size: 16pt; margin: 0 0 9pt; color: #0a2150; padding-bottom: 5pt; border-bottom: 2pt solid #ee4a24; line-height: 1.2; }
  h3 { font-size: 11.2pt; margin: 13pt 0 4pt; color: #0b4ba2; line-height: 1.25; }
  p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
  ul, ol { margin: 0 0 8pt; padding-left: 16pt; } li { margin-bottom: 2.5pt; text-align: justify; }
  /* Sections flow on; only the cover and a few chapter starts force a new page (no half-empty pages). */
  .page + .page { margin-top: 9mm; }
  .newpage { break-before: page; margin-top: 0 !important; }
  .cover { break-after: page; }
  .cover + .page { margin-top: 0; }
  .cover { height: 252mm; display: flex; flex-direction: column; justify-content: space-between; }
  .band { background: #0a2150; color: #fff; padding: 24mm 13mm 16mm; border-radius: 4pt; }
  .band .eyebrow { font: 700 9pt -apple-system, Arial, sans-serif; letter-spacing: .16em; text-transform: uppercase; color: #ff8a63; }
  .band h1 { font-size: 26pt; margin: 9pt 0 10pt; line-height: 1.15; }
  .band p { color: #c8d3ea; font: 12pt/1.45 -apple-system, Arial, sans-serif; max-width: 150mm; text-align: left; }
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
  .toc { font-family: -apple-system, Arial, sans-serif; font-size: 10.3pt; }
  .toc div { display: flex; justify-content: space-between; border-bottom: .6pt dotted #b9c4d8; padding: 3.6pt 0; }
  figure { margin: 6pt 0 10pt; } figcaption { font: italic 8.4pt -apple-system, Arial, sans-serif; color: #5b6880; margin-top: 3pt; }
  figure.shot { break-inside: avoid; }
  figure.shot img { display: block; margin: 0 auto; border: .8pt solid #dbe3f0; border-radius: 4pt; }
  figure.shot figcaption { text-align: center; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; }
  .missing { border: 1pt dashed #b45309; color: #b45309; padding: 18pt; font: 9pt -apple-system, Arial, sans-serif; text-align: center; }
</style></head><body>

<!-- ============================== COVER ============================== -->
<section class="page cover">
  <div class="band">
    <div class="eyebrow">Final project report</div>
    <h1>Apex Care Technologies: from a static brochure site to a full-stack ordering and management platform</h1>
    <p>Design, implementation and evaluation of a database-driven website, a quote-basket ordering system and a role-based administration panel for an industrial safety supplier, built with Next.js 16 and MongoDB.</p>
  </div>
  <div>
    <div class="id">
      <div><span>Submitted by</span><b>${STUDENT}</b></div>
      <div><span>Registration no.</span><b>${REG_NO}</b></div>
      <div><span>Date</span><b>${TODAY}</b></div>
    </div>
    <div class="stats">
      <div class="stat"><b>84</b><span>API operations<br>29 public · 55 admin</span></div>
      <div class="stat"><b>28</b><span>pages and screens<br>10 public · 18 admin</span></div>
      <div class="stat"><b>18</b><span>MongoDB collections<br>plus GridFS storage</span></div>
      <div class="stat"><b>362</b><span>automated tests, all passing<br>65 in a real browser</span></div>
    </div>
  </div>
</section>

<!-- ============================== CONTENTS + ABSTRACT ============================== -->
<section class="page">
  <h2>Contents</h2>
  <div class="toc">
    ${[
      ["1", "Abstract"], ["2", "Introduction and motivation"], ["3", "Objectives"], ["4", "Analysis of the existing website"],
      ["5", "Requirements"], ["6", "Proposed system and architecture"], ["7", "Technology choices and justification"],
      ["8", "Database design"], ["9", "Features implemented"], ["10", "System walkthrough"], ["11", "Security and privacy"],
      ["12", "Comparison: existing vs. proposed"], ["13", "Testing and validation"], ["14", "Deployment"],
      ["15", "Limitations and future work"], ["16", "Conclusion"], ["A", "Appendix A: API summary"], ["B", "Appendix B: Running the project"],
    ].map(([n, t]) => `<div><span>${n}. ${t}</span></div>`).join("")}
  </div>

</section>

<section class="page newpage">
  <h2>1. Abstract</h2>
  <p>Apex Care Technologies supplies fire-safety, personal-protective, welding and gas-detection equipment from Cuddalore, Tamil Nadu. Its existing website is a set of hand-written static HTML pages: content is typed into the page files, an enquiry is posted to a single server script, and the business cannot edit content, take orders, follow up leads or measure visitors without a developer.</p>
  <p>This project rebuilds the website as a full-stack application. One <b>Next.js 16</b> application serves the public website, a documented <b>REST API</b> and a sign-in protected <b>administration panel</b>; <b>MongoDB</b> is the only data store. Customers can browse a database-driven catalogue, collect products and quantities in a <b>quote basket</b> and send it as an order without online payment, receive a reference number, and track progress. Staff work in an 18-screen panel: an order desk, an enquiry inbox, content editing with a media library, testimonial moderation, site settings, analytics, user management, an audit log and backup and restore. Access is governed by three roles and fifteen permissions.</p>
  <p>The system provides 84 API operations over 18 collections and is verified by <b>362 automated tests</b>, all passing, of which 65 drive a real Chrome browser. This report describes the problem, the requirements, the design, the features with screenshots, the security model, the testing, and how the system is deployed on MongoDB Atlas. It also states plainly what is not yet done: production deployment and email delivery are prepared but not switched on, and products are sold as categories, without individual prices or stock.</p>
</section>

<!-- ============================== INTRODUCTION ============================== -->
<section class="page">
  <h2>2. Introduction and motivation</h2>
  <p>For a small industrial supplier, the website is the main route by which new customers find the company and ask for a price. Buyers of safety equipment usually know what they need (helmets for a plant crew, a breathing apparatus, a gas detector), compare options and then ask for a quotation, often for several items at once. The site therefore has four jobs: present the catalogue accurately, make it easy to ask for a quote or place an order, let the business respond quickly, and keep a record of every lead.</p>
  <h3>2.1 Why a rebuild was needed</h3>
  ${list([
    "<b>Every content change needs a developer.</b> Adding a product, correcting a phone number or publishing a training programme means editing HTML files and uploading them again.",
    "<b>No way to order.</b> A customer who needs several products must describe them in free text, and nothing is recorded as an order the business can work through.",
    "<b>Leads are fragile.</b> An enquiry is not given a reference number, cannot be followed up by the customer and has no status.",
    "<b>No visibility.</b> The business cannot see how many people visit, which products they view, what they search for or how many visitors become leads.",
    "<b>Weak discoverability.</b> Products have no pages of their own, so they cannot be found, linked or shared, and search engines receive little structured information.",
    "<b>Open to abuse.</b> Public forms attract automated spam; without defences the sales inbox fills with junk and real leads are lost.",
  ])}
  <h3>2.2 Scope of this project</h3>
  <p>The look and page set of the original site were kept recognisable so the business is not asked to relearn its own website. The work went into what lies underneath and behind it: a real data layer, a secure API, the business workflows around orders and enquiries, an administration panel that non-technical staff can use, and the testing needed to trust all of it.</p>
  <h3>2.3 How the project was carried out</h3>
  <p>The work proceeded in three stages, each finished and tested before the next began: first the data layer, API and database-driven public site; then the administration panel over the API; and finally quote-basket ordering, which added a new order collection, public checkout and tracking pages, and an order desk in the panel. Each stage extended the automated test suite, which is why the final system can be changed with confidence.</p>

  <h2 style="margin-top:10mm">3. Objectives</h2>
  ${olist([
    "Store <b>all</b> site content in a database and render every page from it, so that an edit appears on the live site immediately.",
    "Give each product, survey and training programme its own addressable page with search-engine metadata.",
    "Let customers <b>order several products in one go</b>, with quantities and delivery details, without online payment, and track the order afterwards.",
    "Capture every enquiry reliably, number it, notify the team, acknowledge the customer and let the customer check progress.",
    "Protect public forms against spam and abuse without inconveniencing real visitors.",
    "Provide a <b>graphical, role-based administration panel</b> for orders, enquiries, content, settings and users, protected so that only signed-in staff can reach it.",
    "Measure site usage without tracking individuals, respecting visitor privacy signals.",
    "Make the system easy to run, back up and deploy, and demonstrably correct through automated testing.",
  ])}
</section>

<!-- ============================== EXISTING SYSTEM ============================== -->
<section class="page">
  <h2>4. Analysis of the existing website</h2>
  <p>The live site at apexcaretechnologies.com was inspected through its public pages, response headers and the scripts it serves. Only what is observable from outside is reported; the server-side behaviour of its enquiry script cannot be inspected and is not assumed.</p>
  ${table(
    ["Aspect", "Observation on the existing site"],
    [
      ["Construction", "Static HTML files (<code>index.html</code>, <code>products.html</code>, <code>survey.html</code> …) with Bootstrap and jQuery; content is written into the page files."],
      ["Product pages", "All product categories link to one general <code>products.html</code>; there is no page, address or search entry per product."],
      ["Ordering", "None. There is no basket and no way to request several products together other than describing them in a message."],
      ["Enquiry submission", "A browser script validates the form and posts it to <code>enquiry.php</code>. Phone validation accepts exactly ten digits (<code>/^\\d{10}$/</code>), so <code>+91</code> or international numbers are rejected. There is no email field, so the customer cannot be answered or acknowledged by email."],
      ["Enquiry follow-up", "The confirmation says only “We’ll be in touch”. No reference number, status or tracking page."],
      ["Spam control", "No honeypot, token or rate limit is visible in the client code."],
      ["Search", "None."],
      ["Search-engine files", "<code>/sitemap.xml</code> and <code>/robots.txt</code> both return 404; no structured data on the home page."],
      ["Contact details", "Email addresses are hidden by Cloudflare’s obfuscation script and are not part of any editable settings."],
      ["Administration", "No administration area or content-management system was found."],
      ["Analytics, newsletter, testimonials", "None visible."],
    ],
    { caption: "Table 1. Observed characteristics of the existing website." },
  )}
  <div class="callout"><b>Conclusion of the analysis.</b> The existing site works as an online brochure but has no ordering, no content management, no lead management, no visibility into usage and limited discoverability. These are limits of its architecture, not of its design, and they are what the rebuild addresses.</div>
</section>

<!-- ============================== REQUIREMENTS ============================== -->
<section class="page">
  <h2>5. Requirements</h2>
  <h3>5.1 Users of the system</h3>
  ${table(
    ["Actor", "Goals"],
    [
      ["Visitor / customer", "Find products and services, order several products with quantities, ask questions, book surveys and training, track an order or enquiry, leave a testimonial, subscribe to updates."],
      ["Sales staff (role <i>sales</i>)", "See new orders and enquiries immediately, contact the customer, record notes, move each order through quote, confirmation, dispatch and delivery."],
      ["Content editor (role <i>editor</i>)", "Keep products, surveys, training, gallery, logos and leadership up to date; manage images and the catalogue PDF; see traffic."],
      ["Administrator (role <i>admin</i>)", "Everything above, plus users and roles, site settings, audit log, backup and restore, and deleting records."],
    ],
    { caption: "Table 2. Actors." },
  )}
  <h3>5.2 Functional requirements</h3>
  ${table(
    ["ID", "Requirement"],
    [
      ["FR1", "Every page is rendered from database content; an administrator’s edit is visible without redeploying."],
      ["FR2", "Each product, survey and training programme has its own page with metadata."],
      ["FR3", "A visitor can add products with a quantity and an optional size/model note to a basket, review it, and send it with contact and delivery details. No price or payment is involved."],
      ["FR4", "Every order and enquiry receives a unique reference number (ORD-… / ENQ-…), and the customer can check its status with that reference and their mobile number."],
      ["FR5", "The team is notified of each new order and enquiry; the customer receives an acknowledgement when they give an email address."],
      ["FR6", "Staff can list, filter, search, assign, annotate, change the status of, bulk-update and export orders and enquiries."],
      ["FR7", "Staff can create, edit, publish, hide, reorder and delete all content types and upload images and PDFs."],
      ["FR8", "Customer testimonials are held for moderation and published only after approval."],
      ["FR9", "The administration panel is reachable only by signed-in staff, and each screen and action is limited by role."],
      ["FR10", "The site records usage without cookies or raw IP addresses and reports visitors, top pages, products, searches and conversions."],
      ["FR11", "All content can be exported and restored."],
    ],
    { caption: "Table 3. Functional requirements." },
  )}
  <h3>5.3 Non-functional requirements</h3>
  ${list([
    "<b>Security:</b> hashed passwords, server-side sessions, brute-force protection, CSRF protection, strict input validation, safe file handling.",
    "<b>Privacy:</b> no raw IP storage, honour Do Not Track and Global Privacy Control, automatic expiry of personal and operational data.",
    "<b>Usability:</b> responsive layout from phone to desktop, dark mode, no CAPTCHA for genuine visitors, plain-language admin screens.",
    "<b>Reliability:</b> failed emails are recorded and retried; a database outage returns a clean error instead of crashing.",
    "<b>Maintainability:</b> one codebase, one database, typed end to end, and a hermetic automated test suite.",
  ])}
</section>

<!-- ============================== ARCHITECTURE ============================== -->
<section class="page">
  <h2>6. Proposed system and architecture</h2>
  <p>The proposed system is a single deployable application. Next.js renders the public pages and the administration screens on the server and exposes the REST API from the same codebase; everything talks to one MongoDB database. There is no separate backend service, no third-party content-management system and no second data store to keep in step.</p>
  <figure>${architecture}<figcaption>Figure 1. High-level architecture. Customers and staff use the same application; MongoDB is the single source of truth.</figcaption></figure>
  <h3>6.1 Layering</h3>
  ${table(
    ["Layer", "Responsibility"],
    [
      ["Public pages (<code>src/app/(site)</code>)", "Home, About, Products, Product detail, Surveys, Survey detail, Training, Contact, Quote basket, Order tracking; 404 and error pages; <code>sitemap.xml</code> and <code>robots.txt</code>."],
      ["Admin panel (<code>src/app/admin</code>)", "Sign-in page and 17 signed-in screens. Every screen checks the session and its permission on the server before rendering."],
      ["Proxy (<code>src/proxy.ts</code>)", "Sends visitors without a session cookie to the sign-in page before any admin page renders, remembering where they were going."],
      ["API routes (<code>src/app/api</code>)", "66 route files exposing 84 operations with a uniform response format and request ids."],
      ["Validation (<code>src/server/validation</code>)", "Every request body and query string is checked against a strict schema; unknown fields are rejected."],
      ["Services (<code>src/server/services</code>)", "Business logic: orders, enquiries, notifications, media, search, analytics, audit, backup, users, settings, dashboard."],
      ["Data (<code>src/server/db</code>, <code>data</code>)", "Mongoose models and indexes; cached reads invalidated by tag when content changes."],
      ["Client state (<code>src/components/quote</code>)", "The quote basket, kept in the browser’s local storage so no account or cookie is needed; synchronised across tabs."],
    ],
    { caption: "Table 4. Application layers and their responsibilities." },
  )}
  <h3>6.2 How an order is handled</h3>
  <p>The basket page fetches a short-lived signed form token. When the customer sends the order, the server checks the token and a hidden honeypot field, validates every field (quantities, Indian PIN code, optional GSTIN, mobile number), confirms that each product still exists and is published, merges repeated lines, scores the text for spam, applies per-address limits and collapses an accidental double submission. It then allocates a reference number atomically, stores the order and returns the reference. After the response, the sales email, the customer confirmation and an optional signed webhook are sent; each channel records its own status, attempt count and last error so a failure is visible and retried.</p>
  <figure>${orderStates}<figcaption>Figure 2. Order workflow. Staff move an order forward one step at a time; the customer’s tracking page shows the matching label. An order can be cancelled from any open state.</figcaption></figure>
</section>

<!-- ============================== TECH CHOICES ============================== -->
<section class="page">
  <h2>7. Technology choices and justification</h2>
  ${table(
    ["Technology", "Role", "Why it was chosen"],
    [
      ["Next.js 16 (App Router)", "Website, admin panel and API in one application", "Server rendering gives fast first loads and good indexing; route handlers remove the need for a separate API server; the Proxy file gates the admin area; one deployment."],
      ["React 19", "User interface", "Component model suits cards, forms, tables and dialogs; server components keep database access off the client."],
      ["MongoDB 8 + Mongoose 9", "Single data store", "Catalogue items and orders with varied line items fit documents naturally; TTL indexes expire data automatically; GridFS stores uploads in the same database; MongoDB Atlas provides managed hosting."],
      ["Zod 4", "Validation", "One schema defines both the check and the TypeScript type, so the API contract cannot drift from the code."],
      ["TypeScript 5", "Language", "Type checking across API, services and UI catches mismatches at build time."],
      ["Tailwind CSS 4", "Styling", "Consistent design tokens, responsive layout, dark mode and print styles (used for packing slips)."],
      ["Nodemailer", "Email", "Standard SMTP client; a local mail catcher is used in development so every email can be inspected without sending it."],
      ["Node crypto (scrypt, HMAC, SHA-256)", "Security primitives", "Built-in, audited primitives instead of extra dependencies."],
      ["Node test runner + Playwright core", "Testing", "API tests run against a real throw-away database; browser tests drive the installed Chrome."],
    ],
    { caption: "Table 5. Technology stack." },
  )}
  <h3>7.1 Why one database for everything</h3>
  <p>An earlier plan used a hosted content-management service alongside a database. It was dropped: two stores mean two sets of credentials, two backup procedures and the risk of content, orders and enquiries disagreeing. Keeping everything in MongoDB gives one consistent system, one backup and one place to look when something goes wrong.</p>
  <h3>7.2 Why a quote basket instead of a shop with payments</h3>
  <p>Industrial safety equipment is priced by quantity, specification and site, which is why the original site shows no prices. A conventional shop would need a price, tax rate and stock level for every model and size, and online payment. A quote basket matches how the business actually sells: the customer states what and how many, the team replies with a quote, and the order moves through confirmation and delivery. It needs no new product data and can grow into priced ordering later.</p>
  <h3>7.3 Why build the panel instead of using a CMS</h3>
  <p>A ready-made CMS would give an editing screen quickly but would not provide the order desk, enquiry triage, tracking, spam handling or privacy-preserving analytics that the business needs, and it would bring its own maintenance and security burden. The panel is built directly on the tested API, so every action it offers is already validated, permission-checked and audited.</p>
</section>

<!-- ============================== DATABASE ============================== -->
<section class="page">
  <h2>8. Database design</h2>
  <p>The database has 18 collections and a GridFS bucket for files. Slugs and reference numbers have unique indexes; operational collections carry TTL indexes so that old data removes itself.</p>
  ${table(
    ["Collection", "Holds", "Notable design points"],
    [
      ["products", "Catalogue items (39)", "Unique slug; belongs to a product group; featured flag, ordering, publish state, description, features, specification table, tags, gallery, SEO overrides"],
      ["productgroups", "Categories (5)", "Cannot be deleted or re-keyed while products reference them"],
      ["surveys · trainings", "Surveys (9), training programmes (10)", "Own pages, ordering, publish state"],
      ["galleries · logos · leaders", "Gallery, client and brand logos, leadership", "Ordered, publishable"],
      ["testimonials", "Customer feedback", "Public submissions stored unpublished; submitter email kept private"],
      ["sitesettings", "Singleton settings", "Company details, phones, emails, address, map, social links, tax numbers, page text, catalogue file, notification recipients"],
      ["<b>orders</b>", "Quote orders", "Reference ORD-YYYY-NNNNNN; line items (product slug, title at time of order, quantity, note); customer, company, GSTIN, delivery address; status history, assignee, internal notes, first-response time; per-channel notification state; spam rows auto-deleted after 30 days"],
      ["enquiries", "Leads", "Reference ENQ-YYYY-NNNNNN, status history, priority, assignee, tags, internal notes, notification state; spam auto-deleted after 30 days"],
      ["subscribers", "Newsletter", "Pending, confirmed or unsubscribed; unconfirmed rows expire after 14 days"],
      ["adminusers · sessions", "Staff and logins", "Only a hash of each session token is stored; sessions expire automatically"],
      ["analytics", "Usage events", "No raw IP addresses; daily-rotating visitor hash; expires after 400 days"],
      ["audit", "Change history", "Who changed which fields (not the values); expires after 730 days"],
      ["counters · ratelimits", "Infrastructure", "Atomic yearly counters for order and enquiry numbers; request windows stored in the database so limits hold across servers and restarts"],
      ["media.files / media.chunks (GridFS)", "Uploaded images and PDFs", "De-duplicated by SHA-256; usage-tracked"],
    ],
    { caption: "Table 6. Collections." },
  )}
  <h3>8.1 Design decisions for orders</h3>
  ${list([
    "Each line stores the product <i>title at the time of ordering</i> as well as its slug, so renaming or removing a product later never rewrites a customer’s past order.",
    "Orders are separate from enquiries rather than a new enquiry type: they have line items, a delivery address and a different workflow, and keeping them apart keeps both models simple.",
    "A hash of the normalised basket, together with the mobile number, detects an accidental double submission within ten minutes.",
  ])}
  <h3>8.2 Initial data</h3>
  <p>An idempotent seeding script loads the original site’s content (39 products, 5 groups, 9 surveys, 10 training programmes, 8 gallery images, 6 testimonials, 19 logos, 3 leaders and the site settings), creates all indexes and creates the first administrator. Running it again restores anything deleted but never overwrites edits; the same script seeds the production database on MongoDB Atlas (section 14).</p>
</section>

<!-- ============================== FEATURES ============================== -->
<section class="page">
  <h2>9. Features implemented</h2>
  <h3>9.1 Database-driven public website</h3>
  ${list([
    "Every page reads live data; home-page statistics (counts, years in business) are computed from the database.",
    "Reads are cached and invalidated by tag, so an edit made in the panel appears on the site, in the sitemap, in search and in form drop-downs without redeploying.",
    "Each product, survey and training item has its own page with title, description, canonical link and OpenGraph data; <code>Organization</code>, <code>Product</code> and <code>Service</code> JSON-LD; generated <code>sitemap.xml</code> and <code>robots.txt</code> (which keeps the admin area out of search engines).",
    "Responsive layout, dark mode, image lightbox, live search dialog, and a mobile action bar for call, WhatsApp, products, quote basket and directions.",
  ])}
  <h3>9.2 Quote basket and ordering</h3>
  ${list([
    "<b>Add to quote basket</b> on every product page, with a quantity stepper and an optional “size, model or colour” note. A badge in the header and the mobile bar shows how many products are in the basket.",
    "<b>Basket page</b> (<code>/quote</code>): change quantities and notes, remove lines, then send with name, mobile, optional email, company and GSTIN, delivery address (state list and 6-digit PIN code) and notes. No price or payment is involved.",
    "<b>Server-side checks:</b> every product must exist and be published (errors point at the exact basket line); repeated lines are merged; 1–100,000 units per line and up to 50 lines; GSTIN format; the same spam defences as enquiries.",
    "<b>Confirmation:</b> an on-screen reference such as <code>ORD-2026-000123</code>, an itemised email to the team (reply-to the customer) and, when an email was given, a confirmation to the customer with a tracking link.",
    "<b>Tracking</b> (<code>/quote/track</code>, also on the Contact page): Received → Quote sent → Confirmed → Dispatched → Delivered, or Cancelled. It needs the reference and the mobile number, and shows the items but never the address, notes or assignee.",
  ])}
  <h3>9.3 Enquiry management</h3>
  ${list([
    "Enquiry form on Home, Contact, product, survey and training pages, for questions, survey bookings and training requests. The subject is checked against real published items.",
    "Indian mobile numbers accepted with or without <code>+91</code>/<code>0</code> and normalised; international numbers accepted; email optional but verified.",
    "Reference numbers such as <code>ENQ-2026-000123</code>, allocated atomically; notifications by channel with status, attempts and last error; failed deliveries retried (up to five attempts) on demand or by a scheduled job.",
    "Customer tracking with reference and mobile number; a wrong reference and a wrong number give identical answers, so references cannot be probed.",
  ])}
  <h3>9.4 Anti-spam without annoying customers</h3>
  <p>Defences are layered and silent. A signed form token proves the page was loaded and enforces a minimum fill time; a hidden honeypot catches simple bots; content scoring looks at links, spam vocabulary, disposable email domains and URLs in names; identical submissions within ten minutes collapse into one; and per-address burst and daily limits apply. A bot is told the submission succeeded, but spam is stored out of sight, never emailed and deleted after 30 days. Genuine visitors never see a CAPTCHA.</p>
  <h3>9.5 Testimonials, newsletter, search, media and analytics</h3>
  ${list([
    "<b>Testimonials:</b> a public “Share your experience” form stores submissions unpublished; staff approve or reject them in the panel’s Reviews queue.",
    "<b>Newsletter:</b> double opt-in sign-up, one-click unsubscribe, identical responses for new and existing addresses, CSV export of confirmed subscribers and permanent erasure.",
    "<b>Search:</b> live, ranked search across products, surveys and training, with escaped queries and cancellation of stale requests.",
    "<b>Media library:</b> images up to 8 MB and PDFs up to 25 MB in GridFS; file type taken from the bytes, not the name; duplicates stored once; files still in use protected from deletion; the catalogue PDF is served through a tracked download link.",
    "<b>Analytics:</b> cookie-less, no raw IPs, daily-rotating visitor hash, bots dropped, Do Not Track and Global Privacy Control honoured. Reports visitors, page views, orders, enquiries and conversion, catalogue downloads, daily charts, top pages, products, surveys and searches, contact clicks, referrers and devices.",
  ])}
</section>

<section class="page">
  <h3>9.6 Administration panel</h3>
  <p>The panel at <code>/admin</code> is a complete graphical interface over the API, in the site’s own design, working from phone to desktop. Menus show only what the signed-in role may use, and badges count new orders, new enquiries and testimonials awaiting review.</p>
  ${table(
    ["Screen", "What staff can do"],
    [
      ["Dashboard", "New, open, ready-to-dispatch and delivered orders; orders per day; most-ordered products; latest orders; new and open enquiries, average first response, failed notifications, enquiries by status and type; quick actions."],
      ["Orders", "Status tabs; search by name, company, mobile, reference, product, city or PIN; filter by product, assignee and dates; bulk status, assign and delete; CSV export with one row per order line."],
      ["Order page", "Items and quantities, customer and GSTIN, delivery address with Copy and Open in Maps; one-tap Call, WhatsApp and Email; one-click next step; assignee; internal notes; activity timeline; notification status with resend; printable packing slip."],
      ["Enquiries", "Inbox with the same filtering, bulk actions and export; enquiry page with the full message, contact buttons, status, priority, assignee, tags, notes, activity and notifications."],
      ["Content", "All eight content types: search, filters, bulk publish/hide/delete, reorder, and editors for every field (images from the media library, galleries, feature lists, specification tables, icons, SEO)."],
      ["Reviews", "Testimonial moderation queue: approve publishes, reject deletes."],
      ["Media library", "Drag-and-drop upload, preview, alt text, “used in” list, safe delete."],
      ["Site settings", "Eleven sections (company, contact, address and map, social, registrations, home banner, about text, why-choose-us, values, catalogue PDF, notification recipients), each saved on its own."],
      ["Analytics · Subscribers", "Traffic report for any date range; newsletter list with export and erasure."],
      ["Users · Audit log · Backup", "Create users with a role, change role, deactivate, reset password; filterable audit log; content backup download, validated restore, cache refresh."],
      ["My account", "Change password; list signed-in devices and sign out any or all others."],
    ],
    { caption: "Table 7. Administration panel screens." },
  )}
  <h3>9.7 Authentication, protection of the admin area, and roles</h3>
  ${list([
    "Email and password sign-in; passwords hashed with scrypt; policy of at least 12 characters mixing letters and digits, not common and not based on the email.",
    "<b>Two layers protect <code>/admin</code>.</b> The Proxy redirects any request without a session cookie to the sign-in page. Every admin page then validates the session against the database on the server and checks its own permission, so a forged or expired cookie never renders anything. The API checks the same permissions on every call.",
    "After sign-in the user returns to the page they asked for, but only to <code>/admin</code> addresses, so the sign-in page cannot be abused to redirect elsewhere.",
    "Opaque server-side sessions with a seven-day sliding expiry; staff can see and revoke their devices; changing a password signs out other devices.",
    "Three roles and fifteen permissions: <i>admin</i> (everything), <i>editor</i> (content, media, analytics) and <i>sales</i> (orders, enquiries, subscriber list, analytics). Only administrators can delete orders and enquiries. The last administrator and the acting user cannot be removed or demoted.",
  ])}
</section>

<!-- ============================== WALKTHROUGH ============================== -->
<section class="page newpage">
  <h2>10. System walkthrough</h2>
  <p>The screenshots in this section were captured from the running application with a sample order and enquiry, which were deleted afterwards. Names, numbers and addresses in them are illustrative.</p>
  <h3>10.1 A customer places an order</h3>
  ${figure("home.jpg", "Figure 3. Home page banner with the main calls to action. The quote-basket icon sits in the header next to search.")}
  ${figure("product.jpg", "Figure 4. A product page. The customer chooses a quantity and an optional note and adds the product to the quote basket; the header badge counts the basket.")}
</section>
<section class="page">
  ${figure("basket.jpg", "Figure 5. The quote basket. Quantities and notes can be changed beside the delivery and contact form. No payment is taken.")}
  <div class="pair">
    ${figure("order-received.jpg", "Figure 6. Confirmation with the order reference.", { width: "100%" })}
    ${figure("tracking.jpg", "Figure 7. Order tracking after the team marked the quote as sent.", { width: "100%" })}
  </div>
</section>
<section class="page">
  <h3>10.2 Staff handle the order</h3>
  ${figure("admin-login.jpg", "Figure 8. Sign-in page. Visitors who open any /admin address without a valid session are sent here first.", { width: "82%" })}
  ${figure("admin-dashboard.jpg", "Figure 9. Dashboard: order tiles, orders per day, most-ordered products and the latest orders; menu badges count new orders and enquiries.")}
</section>
<section class="page">
  ${figure("admin-orders.jpg", "Figure 10. Orders desk with status tabs, search, filters, bulk actions and CSV export.")}
  ${figure("admin-order.jpg", "Figure 11. Order page: items, customer, GSTIN and delivery address, contact buttons, the one-click next step, assignee and notification status.")}
</section>
<section class="page">
  <h3>10.3 Enquiries, content and settings</h3>
  ${figure("admin-enquiry.jpg", "Figure 12. An enquiry (survey booking) with the customer’s message, contact buttons and triage controls.")}
  ${figure("admin-content.jpg", "Figure 13. Content management: products with publish state, featured flag, bulk actions and reorder.")}
</section>
<section class="page">
  ${figure("admin-settings.jpg", "Figure 14. Site settings, saved section by section; changes appear on the website immediately.")}
  <h3>10.4 On a phone</h3>
  <div class="pair">
    ${figure("mobile-basket.jpg", "Figure 15. The quote basket on a phone, with the basket badge in the header and the bottom action bar.", { width: "78%" })}
    <div class="callout" style="align-self:start"><b>Responsive by design.</b> Every public page and admin screen was checked at phone width for horizontal overflow by the automated browser tests. The admin panel collapses its sidebar into a drawer on small screens.</div>
  </div>
</section>

<!-- ============================== SECURITY ============================== -->
<section class="page">
  <h2>11. Security and privacy</h2>
  ${table(
    ["Threat", "Measure in the system"],
    [
      ["Unauthorised access to the admin area", "Proxy redirect for requests without a session; server-side session and permission check on every admin page; permission check on every admin API call; admin pages marked <code>noindex</code> and disallowed in <code>robots.txt</code>."],
      ["Password theft", "scrypt hashing with per-user salt; hashes never returned; password change revokes other sessions."],
      ["Session theft", "Random token of which only a SHA-256 is stored; HttpOnly, SameSite=Lax cookie (Secure over HTTPS); server-side revocation."],
      ["Brute force", "Per-address limit, per-address-and-email limit and account lockout (10 failures, 15 minutes); unknown emails get the same error in comparable time, so accounts cannot be enumerated."],
      ["Open redirect", "The post-sign-in destination is accepted only if it is an <code>/admin</code> path."],
      ["Cross-site request forgery", "Origin and Sec-Fetch-Site checks on cookie-authenticated writes."],
      ["Privilege escalation", "Role-based permissions on every operation; deleting orders and enquiries is administrator-only; role changes and deactivation end sessions."],
      ["Injection", "Strict schemas; typed queries so input cannot introduce database operators; escaped regular expressions; HTML-escaped email templates; header-injection guards; escaped JSON-LD; CSV formula neutralisation."],
      ["Tampered orders", "The basket lives in the browser, so the server re-validates every line: product exists and is published, quantity in range, line count capped; the title stored is the server’s, not the client’s."],
      ["Information leakage through tracking", "Order tracking needs reference and mobile; it never returns the address, notes or assignee; misses and mismatches are indistinguishable; throttled per address and per reference."],
      ["Malicious uploads", "Content sniffing, size limits, executable/SVG/HTML refusal, <code>nosniff</code> and sandboxing CSP on served files."],
      ["Spam and flooding", "Token, honeypot, scoring, duplicate collapsing and database-backed rate limits."],
      ["Excess data collection", "No raw IPs; daily-rotating visitor hash; consent-based newsletter; erasure; TTL expiry of sessions, analytics, audit logs, spam and unconfirmed subscribers."],
      ["Outages", "Database down returns a clean 503; failed emails and webhooks are recorded and retried; a health endpoint reports database and mail status."],
      ["Vulnerable dependencies", "Production dependencies audited clean (<code>npm audit --omit=dev</code>: 0). During this work, new Nodemailer advisories were found and fixed by upgrading to 10.2.1."],
    ],
    { caption: "Table 8. Threats and countermeasures." },
  )}
</section>

<!-- ============================== COMPARISON ============================== -->
<section class="page tight">
  <h2>12. Comparison: existing vs. proposed</h2>
  <p>The existing column describes what is observable on the live site (section 4). The proposed column describes what is implemented and tested in this project.</p>
  ${table(
    ["Capability", "Existing site", "Proposed system"],
    [
      ["Ordering several products", "<span class='bad'>Not possible</span>", "<span class='ok'>Quote basket with quantities, notes and delivery details</span>"],
      ["Order tracking for customers", "<span class='bad'>No</span>", "<span class='ok'>Reference + mobile; five-step progress</span>"],
      ["Order handling for staff", "<span class='bad'>No</span>", "<span class='ok'>Order desk: status workflow, notes, assignee, export, packing slip</span>"],
      ["Content storage", "In HTML files", "<span class='ok'>MongoDB; edits appear live</span>"],
      ["Changing a product or phone number", "Developer edits and uploads files", "<span class='ok'>A form in the admin panel; no redeploy</span>"],
      ["Graphical administration", "<span class='bad'>None found</span>", "<span class='ok'>18-screen panel with roles</span>"],
      ["Individual product pages", "<span class='bad'>No</span> (one shared page)", "<span class='ok'>39 products with own address and metadata</span>"],
      ["Site search", "<span class='bad'>None</span>", "<span class='ok'>Live, ranked, cross-collection</span>"],
      ["Phone number validation", "Exactly 10 digits only", "<span class='ok'>Indian formats normalised to +91; international accepted</span>"],
      ["Reference number for an enquiry", "<span class='bad'>No</span>", "<span class='ok'>Yes, e.g. ENQ-2026-000123</span>"],
      ["Staff lead management", "Not visible", "<span class='ok'>Inbox with status, priority, assignee, notes, history, bulk, CSV</span>"],
      ["Spam protection on forms", "None visible", "<span class='ok'>Token, honeypot, scoring, rate limits (silent)</span>"],
      ["Testimonials", "<span class='bad'>None</span>", "<span class='ok'>Public submission with moderation</span>"],
      ["Analytics", "<span class='bad'>None visible</span>", "<span class='ok'>First-party, no cookies, no raw IPs, DNT honoured</span>"],
      ["Search-engine optimisation", "<span class='bad'>No sitemap or robots.txt</span>", "<span class='ok'>Sitemap, robots, JSON-LD, canonical and OpenGraph per page</span>"],
      ["User accounts and roles", "<span class='bad'>None found</span>", "<span class='ok'>3 roles, 15 permissions, audit log</span>"],
      ["Backup and restore", "Copy files", "<span class='ok'>Validated JSON export and all-or-nothing import</span>"],
      ["Automated testing", "None known", "<span class='ok'>362 tests including 65 real-browser tests</span>"],
      ["Prices and online payment", "<span class='bad'>No</span>", "<span class='mid'>No, by design: orders are quoted (section 15)</span>"],
    ],
    { caption: "Table 9. Capability comparison." },
  )}
  <div class="callout"><b>Summary.</b> The public look stays familiar. Behind it, customers can now order and track, the business can manage its own content and handle every order and lead from one panel, and the site can be found by search engines and measured without tracking individuals.</div>
</section>

<!-- ============================== TESTING ============================== -->
<section class="page">
  <h2>13. Testing and validation</h2>
  <p>Testing is automated and hermetic: <code>npm test</code> starts its own temporary MongoDB and mail catcher on free ports, seeds data, builds and serves the production application, runs every suite and removes everything afterwards, so no real data is touched. The final run passed <b>362 of 362</b> tests in under two minutes.</p>
  ${table(
    ["Suite", "Tests", "What it demonstrates"],
    [
      ["Unit", 49, "Slugs, phone parsing, CSV-injection guard, spam scoring, file sniffing, password hashing, tokens, permissions"],
      ["Public API", 38, "Every public endpoint, filters, pagination, search, caching and security headers"],
      ["Orders", 25, "Checkout with real emails, line merging, double-submit collapse, validation of lines, quantities, PIN and GSTIN, unknown products, honeypot spam, tracking (items shown, address hidden, cancellation), triage, notes, filters, bulk, CSV, dashboard and analytics, resend, role access"],
      ["Enquiries", 38, "End-to-end pipeline with real emails, spam handling, rate limits, triage, notes, bulk actions, CSV"],
      ["Authentication", 33, "Login, enumeration resistance, lockout, sessions, CSRF, role matrix, user management"],
      ["Content", 35, "CRUD for all content types, instant public visibility, integrity rules, settings merge"],
      ["Engagement", 27, "Testimonials, enquiry tracking, newsletter double opt-in, import and restore"],
      ["Media", 16, "Upload, serving, ETag, hostile uploads, usage-aware delete, PDF catalogue"],
      ["Operations", 20, "Analytics, audit log, export, scheduled retries, access control"],
      ["Infrastructure", 10, "TTL and unique indexes, seed idempotency, hashing at rest"],
      ["Webhook", 6, "Signature, failure then retry then success, attempt cap"],
      ["Browser: public site", 28, "Every page free of console errors, broken images and overflow; search; forms; tracker; newsletter; testimonial; lightbox; mobile; dark mode; SEO tags; analytics; privacy signal"],
      ["Browser: admin and ordering", 37, "Sign-in redirect and return; forged cookie rejected; no open redirect; noindex; sign-out; every admin screen loads cleanly; a customer fills the basket, orders, the order reaches the desk, moves to “Quote sent” and the tracker follows; enquiry triage; content edits going live; moderation; settings; media; role limits; mobile drawer"],
    ],
    { num: [1], caption: "Table 10. Automated test suites (362 tests in total)." },
  )}
  <h3>13.1 Defects found by testing and fixed</h3>
  ${list([
    "<b>Navigation race in admin lists.</b> Browser tests showed that opening a row within a third of a second of typing in the search box could bounce the user back to the list, because the delayed search update rewrote the address while the router was navigating. The lists now flush the pending search when a row is opened and update the address through the History API, which cannot cancel a navigation.",
    "<b>Dependency advisory.</b> A pre-release audit found newly published advisories in Nodemailer’s address parser; the library was upgraded and the email-related suites (96 tests) re-run successfully.",
    "<b>Accessible labels.</b> Tests located form fields by their visible labels, which exposed a required-field asterisk leaking into the accessible name; it is now hidden from assistive technology.",
  ])}
  <h3>13.2 Static checks</h3>
  <p>The TypeScript type check and the linter pass across the whole project with no errors or warnings, and the production build succeeds without needing a database.</p>
  <h3>13.3 What testing has not covered</h3>
  <p>Browser tests ran in headless Google Chrome only; other browsers, screen readers and real-world load have not been tested. Email was verified through a local mail catcher rather than a live mail provider.</p>
</section>

<!-- ============================== DEPLOYMENT ============================== -->
<section class="page">
  <h2>14. Deployment</h2>
  <p>The production database is hosted on <b>MongoDB Atlas</b>. The application can run on any Node.js host (for example Vercel, Render, Railway or a virtual server) with build command <code>npm run build</code> and start command <code>npm start</code>, on Node 20.9 or later.</p>
  <h3>14.1 Configuration</h3>
  ${table(
    ["Variable", "Status", "Purpose"],
    [
      ["<code>MONGODB_URI</code>", "<span class='bad'>Required</span>", "Atlas connection string with <code>/apex</code> as the database name."],
      ["<code>SESSION_SECRET</code>", "<span class='bad'>Required</span>", "At least 32 characters; signs form tokens and keys visitor hashes. Generated once and never changed after launch."],
      ["<code>PUBLIC_SITE_URL</code>", "<span class='mid'>Strongly recommended</span>", "The https address; enables the Secure cookie flag and correct links in metadata and emails."],
      ["<code>SMTP_*</code>, <code>MAIL_FROM</code>, <code>SALES_EMAIL</code>", "Optional (later)", "Email delivery. Without them orders and enquiries are still stored, shown in the panel and trackable; notifications are recorded as skipped."],
      ["<code>CRON_SECRET</code>", "Optional (with email)", "Protects the scheduled endpoint that retries failed emails."],
      ["<code>TRUST_PROXY</code> and others", "Defaults are correct", "<code>TRUST_PROXY=true</code> suits hosts behind a proxy; retention periods and limits have sensible defaults."],
    ],
    { caption: "Table 11. Production environment variables." },
  )}
  <h3>14.2 Steps</h3>
  ${olist([
    "In Atlas, create a database user with read and write access and allow network access from the deployment host (and, for seeding, from the developer’s machine).",
    "Fill the production settings file (kept out of version control), including the first administrator’s email and password.",
    "Run the seed against Atlas: it creates every index and loads the catalogue, settings and first administrator. In production the application does not build indexes on start, so this step is required.",
    "Set the environment variables on the host and deploy; sign in at <code>/admin</code>, change the password and add staff accounts.",
  ])}
  <div class="callout"><b>Status at the time of writing.</b> The production settings file is prepared with generated secrets and the seed has been verified locally. Seeding Atlas and deploying the application are pending the Atlas connection string and the choice of hosting provider; email delivery is intentionally left off for now.</div>
</section>

<!-- ============================== LIMITS + CONCLUSION ============================== -->
<section class="page">
  <h2>15. Limitations and future work</h2>
  ${table(
    ["Limitation", "Effect", "Possible next step"],
    [
      ["Not yet deployed", "The system runs locally; the Atlas database is not yet seeded.", "Complete the steps in section 14."],
      ["Email not switched on", "Orders and enquiries are stored and visible, but the team and customers receive no emails; newsletter sign-ups cannot be confirmed.", "Configure an SMTP provider and schedule the retry job."],
      ["Products are categories", "Customers describe size or model in a note; there are no per-model prices, tax rates or stock levels.", "Add product variants with prices and stock, then optional online payment."],
      ["No customer accounts", "Customers track orders with reference and mobile; there is no order history across orders.", "Optional sign-in by one-time code sent to the mobile number."],
      ["Admin account recovery", "No “forgot password” on the sign-in page; another administrator must reset it (or a command-line script).", "Email-based password reset once email is on; optional two-factor sign-in."],
      ["Single-browser verification", "Tested in Chrome only; no screen-reader or load testing.", "Cross-browser, accessibility and load testing."],
      ["Product copy is generic", "Descriptions are the original category text; no certifications are claimed.", "Add real descriptions, features and specifications through the panel."],
      ["Development-only advisories", "Three moderate advisories remain in the local test mail catcher’s dependencies; nothing ships to production.", "Update when those packages release fixed versions."],
    ],
    { caption: "Table 12. Known limitations." },
  )}

  <h2 style="margin-top:10mm">16. Conclusion</h2>
  <p>The project turns a static brochure site into a maintainable, secure web application in which content, orders, leads and usage data live in one database, and in which the business runs its day-to-day work from a graphical administration panel. Each objective in section 3 is met: content is database-driven and live; every product has its own page; customers can order several products, receive a reference and track progress; enquiries are validated, numbered, trackable and protected from spam; the panel is protected at two layers and limited by role; analytics respect privacy; and the whole system can be run with one command and checked with 362 automated tests.</p>
  <p>Compared with the original site, the clearest gains are in selling (an ordering path that matches how industrial equipment is quoted), in lead handling (reference numbers, acknowledgements, tracking, and order and enquiry desks), in discoverability (individual pages, sitemap, structured data and search) and in operability (editing without a developer, backup and restore, audit and monitoring). The remaining work is operational rather than architectural: deploying to the prepared Atlas database, switching on email, and, when the business is ready, adding priced product variants.</p>
</section>

<!-- ============================== APPENDICES ============================== -->
<section class="page">
  <h2>Appendix A. API summary</h2>
  ${table(
    ["Group", "Operations"],
    [
      ["Public content (12)", "<code>GET /api/settings · stats · products · products/{slug} · product-groups · surveys · surveys/{slug} · training · gallery · testimonials · leaders · logos</code>"],
      ["Public utility (4)", "<code>GET /api/search · catalogue · media/{id} · health</code>"],
      ["Public orders (2)", "<code>POST /api/orders · orders/track</code>"],
      ["Public enquiries and engagement (10)", "<code>GET /api/enquiries/token</code>; <code>POST /api/enquiries · enquiries/track · testimonials · newsletter/subscribe · analytics/events</code>; <code>GET+POST /api/newsletter/confirm · unsubscribe</code>"],
      ["Scheduled (1)", "<code>POST /api/cron/notifications</code> (secret-protected; retries order and enquiry notifications)"],
      ["Admin (55)", "Authentication and sessions; users and assignees; <b>orders</b> (list, get, update, delete, notes, resend, bulk, CSV); enquiries (the same set); content for 8 types (list, create, get, update, delete, reorder, bulk); settings; media; subscribers; dashboard; analytics; audit; export, import and cache purge"],
    ],
    { caption: "Table 13. API overview (84 operations). The full table is in features.readme.md." },
  )}

  <h2 style="margin-top:6mm">Appendix B. Running the project</h2>
  <p>Requirements: Node 20.9 or later (developed on Node 24). No Docker or system database is needed for development.</p>
  <p><code>npm install</code> then <code>npm run dev:all</code>, which starts a local MongoDB, a local mail catcher, seeds the database and runs the site:</p>
  ${list([
    "Website: <code>http://localhost:3000</code> · Admin panel: <code>http://localhost:3000/admin</code>",
    "Mail catcher (every email the site sends): <code>http://127.0.0.1:8025</code>",
    "Tests: <code>npm test</code> · type check: <code>npm run typecheck</code> · lint: <code>npm run lint</code>",
    "This report: <code>npx tsx scripts/build-project-report.ts</code>; its screenshots: <code>scripts/capture-report-figures.ts</code>",
  ])}
  <h3>B.1 Project size</h3>
  ${table(
    ["Measure", "Value"],
    [
      ["Application source (TypeScript/TSX in <code>src/</code>)", "about 19,200 lines"],
      ["Automated tests (<code>tests/</code>)", "about 3,700 lines, 362 tests"],
      ["Public pages · admin screens", "10 · 18"],
      ["API route files · operations", "66 · 84"],
      ["Collections · roles · permissions", "18 · 3 · 15"],
    ],
    { caption: "Table 14. Project size." },
  )}
  <h3>B.2 Project documents</h3>
  <p><code>README.md</code> (how to run and deploy), <code>features.readme.md</code> (complete feature inventory and API reference), <code>.env.example</code> (every setting) and the source in <code>src/</code>, <code>scripts/</code> and <code>tests/</code>.</p>
  <p class="small" style="margin-top:4mm">Report prepared by ${STUDENT} (${REG_NO}), ${TODAY}. Observations of the existing website were made from its public pages and scripts and may change as that site is updated.</p>
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
    footerTemplate: `<div style="font:8px -apple-system,Arial,sans-serif;color:#5b6880;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Apex Care Technologies · Final project report · ${STUDENT} (${REG_NO})</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });
  await browser.close();
  console.log("wrote Apex-Project-Report.pdf");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
