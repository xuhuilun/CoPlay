# CoPlay

Enterprise-grade synchronized "watch together" platform. Cache Bilibili videos to a CDN and
watch them in sync with friends — couple rooms and screening rooms, a full custom player,
GitHub login, and an admin backend. Target deployment: `bilisync.top`.

- **Frontend/backend split** — React SPA (`apps/web`) + Fastify REST/WebSocket API (`apps/api`).
- **Synchronized playback** — couple rooms (event-driven two-way sync) and screening rooms
  (host reference state + member autonomy + one-tap "sync to host", follow-or-stay on video switch).
- **Bilibili → CDN pipeline** — submit a link, it is downloaded and published to Aliyun OSS with
  content-addressed keys; the player streams directly from the CDN (the web server never proxies video).
- **Guest-first auth** — anyone can watch; optional GitHub OAuth login with cookie sessions.
- **Operations** — per-submitter cache quota (abuse guard), structured pipeline logs, admin backend
  (task retry/cancel, user ban, usage), health checks, rate limiting.

> New here? This README gets you running. Deeper docs live in [`docs/`](docs/): architecture,
> API design, data model, deployment, and security.

## Tech stack

| Layer      | Choice                                                            |
| ---------- | ---------------------------------------------------------------- |
| API        | Node.js 20, Fastify 5, Socket.IO, Zod                            |
| Web        | React 18, Vite, React Router                                     |
| Durable    | MySQL 8 via Prisma, Redis (Socket.IO adapter + presence)        |
| CDN        | Aliyun OSS (`ali-oss`), player streams directly from the CDN    |
| Downloader | `yt-dlp` (optional; simulated by default)                       |
| Deploy     | Docker Compose, Nginx reverse proxy                             |

The API runs fully in-memory by default, so you can develop with **zero external services**.
MySQL, Redis, OSS, and yt-dlp are opt-in via environment flags.

## Prerequisites

- **Node.js ≥ 20** and npm (required).
- Optional, only for durable/production mode: Docker, MySQL 8, Redis 7, the `yt-dlp` binary,
  an Aliyun OSS bucket, and a GitHub OAuth App.

## Quick start (local, no external services)

```bash
git clone https://github.com/xuhuilun/CoPlay.git
cd CoPlay
npm install
cp .env.example .env        # defaults work as-is for local dev
npm run dev                 # starts the API (:4000) and the web app (:5173)
```

Open http://localhost:5173. The API serves REST + WebSocket on http://localhost:4000.
In the default `memory` mode, seed videos are available immediately and cache jobs are simulated.

Run the two apps separately if you prefer:

```bash
npm run dev -w apps/api     # API on :4000  (tsx watch)
npm run dev -w apps/web     # web on :5173  (vite)
```

## Configuration

All settings are environment variables — copy `.env.example` to `.env` and edit. The example
file documents every variable and where to obtain credentials. Highlights:

| Variable                        | Purpose                                                            |
| ------------------------------- | ----------------------------------------------------------------- |
| `API_PORT` / `WEB_ORIGINS`      | API port; comma-separated CORS allowlist                          |
| `PERSISTENCE_DRIVER`            | `memory` (default) or `prisma` (MySQL)                            |
| `SOCKET_ADAPTER`                | `memory` (default) or `redis` (horizontal scaling)               |
| `DATABASE_URL` / `REDIS_URL`    | required by the `prisma` / `redis` drivers                        |
| `CDN_BASE_URL`                  | public CDN domain the player streams from                         |
| `CACHE_DOWNLOADER`              | `simulated` (default) or `ytdlp` (real download; needs the binary)|
| `OSS_ACCESS_KEY_ID` / `_SECRET` / `OSS_BUCKET` / `OSS_REGION` | enable real Aliyun OSS upload      |
| `GITHUB_CLIENT_ID` / `_SECRET` / `GITHUB_REDIRECT_URI` | enable GitHub OAuth login         |
| `CACHE_JOB_DAILY_QUOTA`         | per-submitter rolling-24h cache limit (0 = unlimited)             |
| `ADMIN_GITHUB_IDS`              | comma-separated GitHub user ids granted admin access              |

### Durable mode (MySQL + Redis)

```bash
# .env
PERSISTENCE_DRIVER=prisma
SOCKET_ADAPTER=redis
DATABASE_URL=mysql://coplay:coplay_password@localhost:3306/coplay
REDIS_URL=redis://localhost:6379
```

Then generate the client, run migrations, and seed:

```bash
npm run prisma:generate -w apps/api
npm run prisma:migrate  -w apps/api     # dev; use `prisma migrate deploy` in production
npm run db:seed         -w apps/api
```

Under the `prisma` driver, videos, rooms, cache jobs, **and auth users/sessions** (identities,
bans, login sessions) are persisted and survive restarts.

### Real Bilibili → CDN caching

Set `CACHE_DOWNLOADER=ytdlp` (with the `yt-dlp` binary installed) and configure the `OSS_*`
variables. A submitted link is then downloaded and multipart-uploaded to your OSS bucket; the
returned URL is content-addressed and immutable, so the CDN can cache it indefinitely. Without
these, the pipeline is simulated end-to-end.

### GitHub login & admin

Register a GitHub OAuth App (callback URL = `GITHUB_REDIRECT_URI`) and set the three `GITHUB_*`
variables. Put your GitHub numeric user id(s) in `ADMIN_GITHUB_IDS` to unlock the admin backend
at `/admin` (task retry/cancel, user ban, usage). WeChat/QQ QR login is intentionally not
included (its web-application entity requirements do not fit an individual developer).

## Docker

```bash
docker compose up --build
```

Starts `mysql`, `redis`, `api`, `web`, and an `nginx` reverse proxy on port 80
(`/` → web, `/api` → API, `/socket.io` → WebSocket). Video is never proxied — the player hits
the CDN directly. See [`docs/deployment.md`](docs/deployment.md) for the production setup.

## Quality checks

```bash
npm test         # API unit/integration tests (node:test)
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=high   # the CI gate
```

CI runs the same checks on every push and PR (`.github/workflows/ci.yml`).

## Smoke test

After deploying (or locally) with your real environment, one command exercises the full chain —
submit a cache job, poll to completion, validate the returned CDN/OSS URL serves bytes, and run
the GitHub OAuth authorize + callback token exchange:

```bash
npm run smoke     # drives a RUNNING API; configure via SMOKE_* env vars
```

## Project layout

```
apps/
  api/                  Fastify API (REST + Socket.IO)
    src/modules/
      videos/           video library
      cache-jobs/       Bilibili download → OSS upload pipeline (+ quota, adapters)
      rooms/            couple / screening rooms
      realtime/         WebSocket gateway + presence
      auth/             GitHub OAuth, sessions, users
      admin/            admin backend (tasks, users, usage)
      health/           liveness / readiness
    prisma/             schema + migrations + seed
  web/                  React SPA (Vite)
infra/nginx/            reverse proxy config
docs/                   architecture, api-design, data-model, deployment, security
scripts/smoke.mjs       end-to-end smoke test
docker-compose.yml
```

## Documentation

- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Data model](docs/data-model.md)
- [Deployment](docs/deployment.md) — Docker, Nginx, health checks, launch smoke
- [Security](docs/security.md) — dependency audit policy
- [Implementation plan / changelog](docs/implementation-plan.md)
