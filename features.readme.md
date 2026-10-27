# Features implemented

The Apex Care Technologies site: **Next.js 16 as the server, MongoDB as the only data store**, with a
public website, a REST API and a sign-in protected **admin panel at `/admin`**. Everything below is
implemented and covered by the automated suite (**333 tests, all passing**, run by `npm test`; 61 of
them drive real Chrome through the UI).

| At a glance | |
|---|---|
| API operations | **73** (27 public, 46 admin) in 57 route files |
| MongoDB collections | **17** + GridFS (`media.files`, `media.chunks`) |
| Roles / permissions | 3 roles, 12 permissions |
| Admin panel | **14 screens** at `/admin`, protected server-side, menus filtered by role |
| Automated tests | **333** (49 unit · 284 against a live server and database, 61 of them in real Chrome) |
| Production dependency advisories | **0** (`npm audit --omit=dev`) |

---

## 1. Site content, served from MongoDB

Every page reads live data; nothing is hard-coded.

- **Products** (39 seeded): grouping, search, brand, featured flag, ordering, publish/unpublish,
  per-product description, feature list, spec table, tags, gallery, SEO overrides.
- **Product groups** (5), **Surveys** (9), **Training programmes** (10), **Gallery** (8),
  **Testimonials**, **Client & brand logos** (19), **Leadership** (3).
- **Site settings** (singleton): company details, phones, **public emails** (recovered from the
  original site's obfuscated contact page), address, map embed, social links, GST/MSME/IEC
  numbers, About copy, home-page hero text, value pillars, differentiators, catalogue file.
- **Live stats** on the home page computed from the database (counts, years in business).
- **Edit → live instantly:** reads are cached and tag-invalidated, so an admin edit appears on the
  site (and in the sitemap, search, enquiry dropdowns) without a deploy.
- **Dynamic SEO:** per-page metadata, canonical URLs, OpenGraph, `Organization` / `Product` /
  `Service` JSON-LD (escaped so database text can never break out of the script tag),
  database-driven `sitemap.xml`, `robots.txt`.
- Friendly **404** and **error** pages.

## 2. Enquiries (the core business feature)

Public form on Home, Contact, every Product, Survey and Training page.

- **Validation:** Indian mobile numbers (with/without +91/0) normalised to `+91…`, international
  E.164 accepted, optional email, subject checked against real published items.
- **Atomic reference numbers** `ENQ-2026-000123` (per-year counter).
- **Notifications, per channel with status/attempts/last error:**
  - email to the sales team (HTML-escaped, `Reply-To` = customer),
  - auto-acknowledgement email to the customer containing the reference,
  - signed outbound **webhook** (`X-Apex-Signature: sha256=HMAC(timestamp.body)`).
  - Retries: admin "resend" + `POST /api/cron/notifications` (max 5 attempts, then it stops).
- **Anti-spam, silent to bots:** signed form token (proves the page loaded, minimum fill time),
  honeypot field, content scoring (links, spam words, disposable emails, URLs in name…), duplicate
  collapsing (same mobile + message within 10 min), per-IP burst and daily limits. Spam is stored,
  hidden from the inbox, never emailed, and auto-deleted after 30 days.
- **Customer tracking:** reference **+** mobile → friendly status (Received → In progress →
  Quote sent → Closed) and timeline; internal notes/assignee never exposed; wrong reference and
  wrong mobile are indistinguishable; throttled per IP and per reference.
- **Admin triage:** list with filters (status, type, priority, assignee, dates, free-text search),
  pagination and sorting; status workflow with full history and *first-response time*; priority;
  assignment; tags; internal notes (author-only delete); bulk status/assign/delete; delete
  (admin only); **CSV export** with Excel BOM and spreadsheet-formula-injection protection.

## 3. Customer testimonials with moderation

- Public "Share your experience" form on the About page → stored **unpublished**
  (`source: public`); the team is emailed; nothing is public until approved.
- Approve = publish; reject = delete; queue = `?source=public&published=false`.
- Submitter email kept private (admin-only). Same token/honeypot/spam/limit defences; spam and
  repeats dropped silently.

## 4. Newsletter (double opt-in)

- Footer sign-up → confirmation email → subscribed only after the address owner presses the
  button on the confirmation page (links open a page, they don't act on GET, so mail scanners
  can't confirm or unsubscribe anyone).
- One-click **unsubscribe** link in every email; re-subscribing requires fresh confirmation.
- Same response for new / pending / already-subscribed (no list probing); resend throttle.
- Admin: list with status counts, **CSV export** (confirmed only by default), permanent erasure.
  Unconfirmed sign-ups expire after 14 days.

## 5. Search

- Cross-collection (products, surveys, training), all-terms-must-match, relevance-ranked,
  regex-safe (no injection / ReDoS). **Live search dialog** in the header, debounced with
  cancellation of stale requests. Searches feed analytics.

## 6. Media (files stored in MongoDB GridFS)

- Upload (images ≤ 8 MB, PDF ≤ 25 MB) with **magic-byte sniffing** (client MIME type ignored);
  SVG/HTML/executables rejected; identical files de-duplicated by SHA-256.
- Served with immutable caching, ETag/304, `nosniff`, sandbox CSP; works through the Next.js
  image optimiser.
- **Usage tracking:** deleting a file still used by content is refused (409) unless forced; the
  live catalogue PDF is protected.
- **Catalogue download tracking:** every "Download" link goes through `/api/catalogue`, which
  counts it and redirects to the current file (static or an uploaded PDF).

## 7. Analytics (first-party, privacy-preserving)

- Cookie-less beacon: page views, product/survey views, call/WhatsApp/email clicks; server-side
  events for catalogue downloads, searches and enquiries.
- No raw IPs stored; **daily-rotating hashed visitor id** gives unique-visitor counts without
  identifying anyone. Bots dropped. Honours **Do Not Track / Global Privacy Control**. API/admin
  paths and query strings never stored. Auto-deleted after 400 days.
- Admin report: totals, visitors, **enquiry conversion rate**, daily time series, top pages /
  products / surveys / searches, CTA clicks, devices, referrers, date-range queries.

## 8. Admin API

- **Generic CRUD** for 8 content types: list (search, filters, sort, pagination), create (auto
  slug incl. German transliteration, conflict-safe), partial update, delete, **reorder**,
  **bulk** publish/unpublish/delete. Referential integrity (can't delete or re-key a group that
  still has products; products must reference a real group).
- **Dashboard:** content counts, enquiries by status/type, 14-day trend, open and unassigned
  counts, failed notifications, average first-response hours, recent enquiries.
- **Settings** editing with nested merge; map embed restricted to Google Maps URLs.
- **Audit log:** who did what and which fields changed (values deliberately not stored); 2-year
  retention.
- **Content backup / restore:** `GET /api/admin/export` (JSON) and `POST /api/admin/import`
  (merge, or confirmed replace). The whole file is validated first — any problem rejects it and
  nothing is written; error paths point at the exact row.
- Manual cache purge.

## 9. Admin panel (`/admin`)

A complete web interface over the admin API, in the site's own design (light and dark, phone to
desktop). Every screen calls the same permission-checked API the tests exercise.

- **Sign-in & protection:** `/admin/login`. A proxy (`src/proxy.ts`) sends visitors without a session
  cookie to sign-in (remembering where they were going); every admin page then validates the session
  against the database on the server and checks its own permission, so a forged or expired cookie
  never renders anything. Post-login redirects only go to `/admin…` paths. Admin pages send
  `X-Robots-Tag: noindex` and are disallowed in `robots.txt`.
- **Dashboard:** new / open / unassigned enquiries, average first response, failed notifications,
  14-day enquiry chart, enquiries by status and type (click through to the filtered inbox), latest
  enquiries, quick actions. Live badges in the menu for new enquiries and testimonials awaiting review.
- **Enquiries inbox:** status tabs, search (name, mobile, email, reference, message), type / priority /
  assignee / date filters, sorting, pagination, shareable URLs; bulk status, assign and delete; CSV
  export of the current filter.
- **Enquiry page:** the customer's full message, contact details with one-tap **Call / WhatsApp /
  Email**, the product/survey it's about, source page and campaign; change status, priority, assignee
  ("Me"), tags; internal notes (author or admin can delete); activity timeline with first-response
  time; per-channel delivery status with **Resend**; spam score and reasons; delete (admin).
- **Content:** overview of all 8 content types with counts; per type: search, published/hidden and
  type-specific filters, sorting, bulk publish/hide/delete, one-click publish toggle, link to the live
  page, **reorder** mode. Editor forms for every field the API accepts — images with a media-library
  picker, extra-image galleries, feature lists, spec tables, tags, icons, SEO overrides — with
  required-field checks and the API's field errors shown inline. Only changed fields are sent.
- **Reviews:** the testimonial moderation queue — approve (publishes) or reject (deletes), with the
  submitter's private email.
- **Media library:** drag-and-drop or button upload (images and PDFs), search and type filter, preview,
  copy link, edit alt text, "used in" list, delete with a warning when the file is still in use.
- **Site settings:** 11 sections (company, contact, address & map, social, registrations, home banner,
  about text, why-choose-us, values, **product catalogue PDF** with upload/pick and a "test the
  download" button, enquiry email recipients). Each section saves on its own, sending only what changed.
- **Analytics:** 7 / 30 / 90-day or custom range; visitors, page views, enquiries and conversion,
  catalogue downloads; daily charts; top pages, products, surveys, searches, contact clicks, referrers,
  devices.
- **Subscribers:** status tabs with counts, search, sort, CSV export, permanent erasure.
- **Users** (admin): add users with a role, change role, deactivate/reactivate, reset password, delete;
  you can't demote, deactivate or delete yourself.
- **Audit log:** filter by area, action and user.
- **Backup & system:** download a content backup, restore it (merge, or replace with explicit
  confirmation; the API's row-level errors are listed), clear the website cache.
- **My account:** profile and permissions, change password, signed-in devices with sign-out per device
  or everywhere else, sign out.

## 10. Authentication & authorization

- Email + password; passwords hashed with **scrypt** (per-user salt, versioned format), policy
  (12+ chars, letters+digits, no common/email-based passwords).
- **Opaque server-side sessions** (only a SHA-256 of the token is stored), HttpOnly +
  SameSite=Lax cookie (Secure over https) or `Authorization: Bearer`; 7-day sliding expiry;
  list devices, revoke one, revoke all others, logout invalidates server-side.
- **Brute-force defence in layers:** per-IP limit, per-IP+email limit, per-account lockout
  (10 failures → 15 min). Identical error and equalised CPU for unknown emails (no account
  enumeration).
- **CSRF protection** for cookie-authenticated writes (Origin / Sec-Fetch-Site), not applied to
  Bearer clients.
- **RBAC:** `admin` (everything), `editor` (content, media, analytics), `sales` (enquiries,
  subscribers read, analytics). User management: create, change role, deactivate (kills sessions),
  reset password, delete; the last administrator and the acting user are protected.
- Password change revokes other sessions.

## 11. Platform & hardening

- **Uniform API:** `{data, meta}` / `{error:{code,message,details}, requestId}`, request ids,
  proper status codes, pagination metadata, strict unknown-field rejection on every body/query.
- **Rate limiting in MongoDB** (works across instances; TTL-cleaned) with `X-RateLimit-*` headers.
- Body size caps (streamed), content-type checks, NoSQL-injection-safe typed queries,
  regex-escaped searches, CRLF/header-injection guards in email, HTML escaping in templates.
- Optional **CORS** allow-list; security headers on every page and API response.
- **Health endpoint** (DB ping + mail status), structured JSON logs, graceful 503 when the
  database is down.
- **TTL indexes** expire sessions, rate-limit windows, analytics, audit logs, spam enquiries and
  stale pending subscribers.
- Build needs **no database**; `next start` renders per request with cached, tag-invalidated reads.
- Dependencies: **0 production advisories** (Next.js upgraded 16.3.6 → 16.4.2 to fix two).

## 12. Developer experience

- `npm run dev:all` — local MongoDB (npm-managed `mongod`, persistent) + local mail catcher +
  idempotent seed + dev server. No Docker, no system installs.
- Idempotent **seeder** (restores deleted originals, never overwrites edits), `create-admin` CLI.
- Hermetic **`npm test`** (throw-away DB + mail + server on free ports).

## 13. Test coverage

| Suite | Tests | What it proves |
|---|---:|---|
| unit | 49 | slugs, phone parsing, CSV-injection guard, spam scoring, file sniffing, scrypt, tokens, permissions |
| public API | 38 | every public endpoint, filters, pagination, search, caching/security headers |
| enquiries | 38 | pipeline end to end incl. **real emails**, spam, rate limits, triage, notes, bulk, CSV |
| auth | 33 | login, enumeration, lockout, sessions, CSRF, role matrix, password change, user mgmt |
| content | 35 | CRUD for all types, **instant public visibility**, integrity rules, settings merge |
| engagement | 27 | testimonials, tracking, newsletter double opt-in, import/restore |
| media | 16 | GridFS upload/serve/ETag, hostile uploads, usage-aware delete, PDF catalogue |
| ops | 20 | analytics, audit log, export, cron, access control |
| infra | 10 | TTL & unique indexes, seed idempotency, hashing at rest |
| webhook | 6 | HMAC signature, failure → retry → success, attempt cap |
| browser (Chrome) | 28 | all pages clean (no console errors / broken images / overflow), search, forms, tracker, newsletter, testimonial, lightbox, mobile, dark mode, SEO, analytics, privacy signal |
| admin panel (Chrome) | 33 | sign-in redirect and return, forged cookie rejected, no open redirect, noindex, sign-out; all 14 admin screens load cleanly; a website enquiry reaches the inbox and is triaged (status, assign, note, tags, bulk, CSV) and the customer's tracker follows; product create → live, edit → live, hide → 404, delete; testimonial approval → About page; settings → home page; catalogue PDF; media upload/alt/delete; sales vs editor access; mobile drawer |

## 14. API reference

Public (no sign-in):

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness + DB/mail status |
| GET | `/api/settings` · `/api/stats` | site settings · live counts |
| GET | `/api/products` · `/api/products/{slug}` | catalogue (filter `group`, `brand`, `featured`, `q`) · detail + related |
| GET | `/api/product-groups` · `/api/surveys` · `/api/surveys/{slug}` | groups · surveys |
| GET | `/api/training` · `/api/gallery` · `/api/testimonials` · `/api/leaders` · `/api/logos?kind=` | content lists |
| GET | `/api/search?q=&types=&limit=` | site search |
| GET | `/api/catalogue` | tracked download → redirect |
| GET | `/api/media/{id}` | stream an uploaded file |
| GET | `/api/enquiries/token` | signed form token |
| POST | `/api/enquiries` · `/api/enquiries/track` | submit · track |
| POST | `/api/testimonials` | submit for moderation |
| POST | `/api/newsletter/subscribe` | start double opt-in |
| GET/POST | `/api/newsletter/confirm` · `/unsubscribe` | token pages (button → POST) |
| POST | `/api/analytics/events` | first-party beacon |
| POST | `/api/cron/notifications` | retry failed deliveries (secret) |

Admin (session cookie or Bearer; permission in brackets):

| Method | Path | Permission |
|---|---|---|
| POST | `/api/admin/auth/login` · `logout` · `change-password` | — · any · any |
| GET | `/api/admin/auth/me` · `sessions` | any |
| DELETE | `/api/admin/auth/sessions` · `/sessions/{id}` | any |
| GET/POST | `/api/admin/users` · GET/PATCH/DELETE `/users/{id}` · POST `/users/{id}/reset-password` | users:manage |
| GET | `/api/admin/enquiries` · `/export` · `/{id}` | enquiries:read |
| PATCH / POST | `/enquiries/{id}` · `/{id}/notes` · `/{id}/resend` · `/bulk` | enquiries:write |
| DELETE | `/api/admin/enquiries/{id}` · `/{id}/notes/{noteId}` | enquiries:delete · :write |
| GET/POST | `/api/admin/content/{resource}` | content:write |
| GET/PATCH/DELETE | `/api/admin/content/{resource}/{id}` | content:write |
| POST | `/api/admin/content/{resource}/reorder` · `/bulk` | content:write |
| GET/PATCH | `/api/admin/settings` | settings:write |
| GET/POST | `/api/admin/media` · PATCH/DELETE/GET `/media/{id}` | media:write |
| GET | `/api/admin/subscribers` · `/export` | subscribers:read |
| DELETE | `/api/admin/subscribers/{id}` | subscribers:manage |
| GET | `/api/admin/dashboard` · `/api/admin/assignees` | enquiries:read |
| GET | `/api/admin/analytics` | analytics:read |
| GET | `/api/admin/audit` | audit:read |
| GET / POST | `/api/admin/export` · `/import` · `/cache` | system:manage |

`{resource}` ∈ `products`, `product-groups`, `surveys`, `training`, `gallery`, `testimonials`,
`logos`, `leaders`.

## 15. Honest limits

- Verified in Chrome only (headless); not cross-browser, not screen-reader tested.
- Docker files exist but were not exercised end-to-end here; local Node is the supported path.
- 5 dev-only advisories remain in lint tooling (`eslint-config-next` → glob matchers); the only
  offered fix downgrades to Next 14. Nothing there ships to production.
- Newsletter campaigns are not sent from here (sign-ups, consent and export only).
- Rate limiting trusts `X-Forwarded-For`; set `TRUST_PROXY=false` if exposed without a proxy.
