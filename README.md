# Apex Care Technologies — Next.js + MongoDB

Full-stack rebuild of [apexcaretechnologies.com](https://apexcaretechnologies.com). One Next.js 16
app is both the website and the REST API; **MongoDB** stores everything — content, enquiries, users,
sessions, analytics and uploaded files (GridFS).

> What is implemented, in detail: **[features.readme.md](./features.readme.md)** ·
> a printable report: **[Apex-Backend-Report.pdf](./Apex-Backend-Report.pdf)**

## Quick start (local Node, no Docker)

Requires Node ≥ 20.9 (developed on 24).

```bash
npm install
npm run dev:all
```

That single command starts a persistent local MongoDB (an npm-managed `mongod`, data in
`.data/mongo`, downloaded once on first run), a local mail catcher, seeds the database
(idempotent) and runs `next dev`:

| | |
|---|---|
| http://localhost:3000 | the site |
| http://127.0.0.1:8025 | every email the site sends (enquiry alerts, confirmations…) |
| `mongodb://127.0.0.1:27017/apex` | the database (works with Compass) |

`.env` holds the settings (git-ignored; `.env.example` documents every variable). The seeded admin
is `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

```bash
# the admin API, with curl
curl -c jar -H 'Content-Type: application/json' \
  -d '{"email":"admin@apexcare.local","password":"<ADMIN_PASSWORD>"}' \
  http://localhost:3000/api/admin/auth/login
curl -b jar http://localhost:3000/api/admin/dashboard
curl -b jar 'http://localhost:3000/api/admin/enquiries?limit=5'
curl      'http://localhost:3000/api/products?group=draeger'      # public
```

## Commands

| | |
|---|---|
| `npm run dev:all` | MongoDB + mail catcher + seed + dev server, together |
| `npm run dev:db` / `dev:mail` | run just the database / just the mail catcher |
| `npm run seed` | add any missing content + first admin (never overwrites edits) |
| `npm run seed -- --reset` | **destructive:** replace all content with the originals |
| `npm run create-admin -- --email you@x.com --name "You" --role editor` | needs `ADMIN_PASSWORD` in env |
| `npm test` | **everything**, hermetic (see below) |
| `npm test -- auth media` | only suites whose file name contains those words |
| `npm run lint` · `npm run typecheck` | static checks |
| `npm run build` · `npm start` | production build / server |

### Tests

`npm test` starts its own throw-away MongoDB and mail catcher on free ports, seeds, builds and
serves the app, runs every suite, and tears it all down — your dev data is never touched.
**300 tests in about a minute**, including 28 that drive your installed **Google Chrome**
(`playwright-core`; nothing to download) through the real UI: search, enquiry form, tracking,
newsletter double opt-in, testimonial moderation, lightbox, mobile layout, dark mode, analytics.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · MongoDB 8 + Mongoose 9 · Zod 4 ·
Nodemailer · scrypt (node:crypto) for passwords · Node's built-in test runner + tsx.

## Layout

```
src/app/            pages (server components) and the REST API under src/app/api
src/components/     UI
src/lib/types.ts    JSON shapes shared by API and UI
src/server/         config · db (models) · validation (zod) · services · data (cached reads)
                    · auth · mail · seed · lib (http wrapper, rate limit, cache, errors…)
scripts/            dev-all, dev-db, dev-mail, seed, create-admin, test-all
tests/              unit · API · enquiry pipeline · auth/RBAC · content · media · ops · e2e (Chrome)
public/media/       original images / video / PDF (uploads go to MongoDB GridFS instead)
```

## Production

Set real values (see `.env.example`): `MONGODB_URI` (Atlas or your own cluster), `SESSION_SECRET`
(`openssl rand -hex 32`), `PUBLIC_SITE_URL=https://…`, SMTP settings and `SALES_EMAIL`.

```bash
npm run build && npm start        # needs Node and a reachable MongoDB; the build itself needs no DB
npm run seed                      # once: indexes, content, first admin — then change that password
```

- Put TLS in front. With an `https://` `PUBLIC_SITE_URL`, session cookies get the `Secure` flag.
- `TRUST_PROXY=true` only behind a proxy/CDN that **overwrites** `X-Forwarded-For`; otherwise
  `false` (rate limits then share one bucket).
- Schedule `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/notifications`
  every few minutes to retry failed emails/webhooks.
- Back up with `mongodump` and/or `GET /api/admin/export` (restore: `POST /api/admin/import`).
- A `Dockerfile` and an optional `docker-compose.yml` (MongoDB with auth + the app) are included
  but **untested** on this machine; local Node is the supported path.

## Not included

- **No admin web UI.** The admin surface is the authenticated API under `/api/admin`
  (curl, Postman, or a UI you build on it). This is the natural next step.
- Product copy is the original site's generic category text; no standards or certifications are
  claimed. Per-product descriptions, features and specs can be added through the API.
- Newsletter *sending* is out of scope: sign-ups, consent and CSV export are built; use a mailing
  tool for campaigns.
