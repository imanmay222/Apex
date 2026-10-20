# Features implemented

Backend for the Apex Care Technologies site: **Next.js 16 as the server, MongoDB as the only data
store.** Everything below is implemented and covered by the automated suite (**300 tests, all
passing**, run by `npm test`; 28 of them drive real Chrome through the UI).

| At a glance | |
|---|---|
| API operations | **72** (27 public, 45 admin) in 56 route files |
| MongoDB collections | **17** + GridFS (`media.files`, `media.chunks`) |
| Roles / permissions | 3 roles, 12 permissions |
| Automated tests | **300** (49 unit · 251 against a live server and database, 28 of them in real Chrome) |
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

## 9. Authentication & authorization

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

## 10. Platform & hardening

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

## 11. Developer experience

- `npm run dev:all` — local MongoDB (npm-managed `mongod`, persistent) + local mail catcher +
  idempotent seed + dev server. No Docker, no system installs.
- Idempotent **seeder** (restores deleted originals, never overwrites edits), `create-admin` CLI.
- Hermetic **`npm test`** (throw-away DB + mail + server on free ports).

## 12. Test coverage

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

## 13. API reference

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
| GET | `/api/admin/dashboard` | enquiries:read |
| GET | `/api/admin/analytics` | analytics:read |
| GET | `/api/admin/audit` | audit:read |
| GET / POST | `/api/admin/export` · `/import` · `/cache` | system:manage |

`{resource}` ∈ `products`, `product-groups`, `surveys`, `training`, `gallery`, `testimonials`,
`logos`, `leaders`.

## 14. Honest limits

- **No admin web UI** — admin work is API-only today.
- Verified in Chrome only (headless); not cross-browser, not screen-reader tested.
- Docker files exist but were not exercised end-to-end here; local Node is the supported path.
- 5 dev-only advisories remain in lint tooling (`eslint-config-next` → glob matchers); the only
  offered fix downgrades to Next 14. Nothing there ships to production.
- Newsletter campaigns are not sent from here (sign-ups, consent and export only).
- Rate limiting trusts `X-Forwarded-For`; set `TRUST_PROXY=false` if exposed without a proxy.
