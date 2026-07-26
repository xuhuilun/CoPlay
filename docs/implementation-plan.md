# Implementation Plan

## Phase 1: MVP

1. Scaffold monorepo, TypeScript configs, Docker files, and docs.
2. Implement API modules with in-memory stores and stable contracts.
3. Implement WebSocket room events for couple rooms and screening rooms.
4. Build React pages: home, video library, detail, and room.
5. Verify local build, typecheck, and Docker config syntax.

## Phase 2: Durable Infrastructure

1. Replace in-memory stores with MySQL repositories.
2. Move online room state and player reference state to Redis.
3. Add Socket.IO Redis adapter for horizontal scaling.
4. Add migrations and seed scripts.

Progress:

- Prisma/MySQL repositories are available behind `PERSISTENCE_DRIVER=prisma`.
- Socket.IO Redis fan-out is available behind `SOCKET_ADAPTER=redis`.
- Online room presence is separated from durable room membership and can use Redis in multi-instance mode.
- Room hosts can switch videos from the room sidebar; clients load the new source before applying reference state.
- Cache job progress can be pushed through WebSocket while HTTP polling remains as a fallback.
- API exposes liveness and readiness endpoints for deployment health checks.
- API has baseline HTTP security headers and global rate limiting.
- Backend policy tests cover room synchronization rules and memory presence counting.
- Guests can edit their local room nickname without requiring login.
- Initial Prisma migration SQL is committed for production review and deploy.
- GitHub Actions CI runs install, Prisma generate, tests, typecheck, build, and production dependency audit.
- API returns `x-request-id` for request tracing across logs and clients.
- Realtime socket events validate payload shape and throttle high-frequency player actions.
- Room REST routes have Fastify injection tests for create, join, validation, missing resources, and capacity limits.
- Web pages expose polished loading, empty, and error states for video discovery, detail, and room entry flows.
- Health routes have Fastify injection tests for live checks, memory readiness, dependency success, and dependency failure.
- Cache job REST routes have Fastify injection tests for create, invalid URL, detail, and missing job behavior.
- Video REST routes have Fastify injection tests for hot ranking, search, detail, and missing video behavior.
- Video search normalization is covered for padded and case-insensitive queries.
- API CORS configuration validates comma-separated `WEB_ORIGINS` while keeping `WEB_ORIGIN` compatibility.
- API numeric environment settings fall back to safe defaults when invalid.
- API string environment settings trim whitespace and fall back when blank.
- API driver environment settings trim whitespace, match case-insensitively, and fall back when unknown.
- API CDN base URL settings are normalized and fall back to the production CDN default when invalid.
- API optional dependency URLs are normalized and discarded when invalid.
- Cache job WebSocket subscriptions validate payload shape before joining progress channels.
- Web routing includes a polished 404 fallback for unknown paths.
- The web room creation form clamps screening room capacity to the supported 2-100 member range.
- Couple room capacity is covered by repository and REST route tests to stay fixed at two members.
- Host video switching controls show loading, unavailable, and empty states before enabling switches.
- Host-only video switching policy is covered by backend room tests.
- Room nicknames are normalized server-side across REST and realtime joins.
- Host video switching clears stale selected video IDs after switch requests and switch events.
- REST route ID parameters are normalized consistently before video, room, join, and cache-job lookups.
- Room create and join REST payload IDs are normalized before validation and persistence.
- Cache job source URLs are trimmed before validation and persistence.
- Cache job creation rejects non-Bilibili source URLs before creating work.
- The web cache submission form validates Bilibili URLs before sending cache job requests.
- Cache job source URLs are capped at 512 characters in API and web validation.
- Room invites fall back to a manual copy field when browser clipboard access is unavailable.
- Screening room host video switches invite other members to follow or stay, preserving member autonomy, while couple rooms keep applying switches immediately for both partners.
- The room player control bar reveals on pointer activity and auto-hides after an idle window during playback, staying visible while paused, matching the hidden-control-bar requirement.
- Videos carry a normalized rendition list (`sources`) so the player quality selector switches resolution per viewer, preserving playback position without broadcasting to the room; freshly cached videos fall back to a single 原画 rendition.
- The fullscreen control expands the theater container rather than the bare video element so the custom control overlay stays visible and usable in fullscreen, and toggles back out when already fullscreen.
- Bilibili cache submissions are validated to carry a real BV/av video id (or a b23.tv short link) so homepage and listing links are rejected in both API and web, and completed cache jobs surface the recognized video id in the cached library title.
- Cache job creation is idempotent: resubmitting a source with an in-flight or completed job reuses it instead of triggering a duplicate download or library entry, while failed jobs still allow retries; worker timers are unref'd so they never block process shutdown.
- The room player supports keyboard shortcuts (space/k play-pause, f fullscreen, m mute, arrow keys seek and volume) that are ignored while typing in form controls and reveal the control bar on use.

## Phase 4: Operations & Admin

1. Per-submitter cache-job quota to guard OSS storage and CDN egress from abuse.
2. Admin backend: task list (filter/retry/cancel), user list (ban), storage & usage view.
3. Freeze WeChat/QQ QR login (seam retained) pending business-entity qualification.

Progress:

- Cache jobs record a `submitter` (`user:<id>` when authenticated via session, else `ip:<addr>` with Fastify `trustProxy` so the real client IP is read behind Nginx). Creation enforces a per-submitter rolling-24h quota (`CACHE_JOB_DAILY_QUOTA`, 0 = unlimited) in both the in-memory and Prisma repositories; over-limit submissions return 429 and the web surfaces the server message. Idempotent reuse of an existing job never consumes quota. Covered by repository (limit, per-submitter isolation, reuse, window) and route (429, IP-keying) tests.

## Phase 3: Production Integrations

1. Connect real Bilibili download task workers.
2. Upload cached files to CDN.
3. Add GitHub and QR-code login providers.
4. Add observability, rate limits, and admin operations.

Progress:

- The cache worker orchestrates two injectable ports — `BilibiliDownloader` (fetch the source into storage) and `CdnUploader` (publish renditions to the CDN) — with default simulated implementations and unit coverage. A production integration only needs to implement these ports (e.g. a yt-dlp downloader and an object-storage/CDN uploader); the worker, job status handling, and library persistence stay unchanged. Downloaded duration and uploaded renditions now flow into the cached library video instead of hardcoded values.
- A `YtDlpBilibiliDownloader` implements the download port by wrapping the yt-dlp CLI: probe (`--dump-single-json`) then download (remuxed to mp4 into a configured output dir, yielding a deterministic `filePath`), with pure, unit-tested command construction and probe parsing, and process execution behind an injectable `CommandRunner` (never spawned in tests). It is selectable via `CACHE_DOWNLOADER=ytdlp` (with `YTDLP_BINARY`) and defaults off. The worker now catches download/upload failures and transitions the job to `failed` with a message instead of leaving an unhandled rejection, so a missing binary or network error degrades gracefully without crashing the server.
- Production dependency audit hardened: `npm audit fix` resolved the Fastify/find-my-way high within the current major (pinned `find-my-way@9.7.0`); the react-router moderates have no advisory-free release (every `7.12.0`–`8.2.0` carries a higher RSC-CSRF advisory and no `8.x` is published), so react-router stays on the latest `6.x` and CI gates at `--audit-level=high`. Rationale and applicability (client-only SPA, no RSC/SSR/untrusted-URL nav) are documented in `docs/security.md`.
- An `OssCdnUploader` implements the CDN upload port against Aliyun OSS: it resolves the Content-Type from the artifact extension, uploads via multipart with a configurable part size (Aliyun's 100 KB minimum enforced), builds a playback URL from `CDN_BASE_URL` or the bucket endpoint (with intranet/extranet switching), and runs an optional CDN refresh/preheat step. The object-storage calls sit behind an injected `OssClient` so success, failure, large-file multipart chunking, content-type, and refresh paths are all unit-tested without credentials; the production `AliOssClient` wraps the official `ali-oss` SDK. Enabled via `OSS_ACCESS_KEY_ID`/`OSS_ACCESS_KEY_SECRET`/`OSS_BUCKET`/`OSS_REGION` (+ `OSS_INTERNAL`/`OSS_ENDPOINT`), paired with `CACHE_DOWNLOADER=ytdlp`; transcoding remains out of scope, so a single 原画 rendition is published.
- Launch-readiness: `.env.example` documents every variable (core, drivers, OSS, GitHub, cache backend, smoke) with acquisition notes, and `npm run smoke` (`scripts/smoke.mjs`) drives a running API end-to-end — cache submit → poll state machine → validate the returned CDN/OSS URL serves bytes → GitHub OAuth authorize-URL generation and a real callback token exchange. The smoke test surfaced and fixed a real bug: the web API client sent `Content-Type: application/json` on bodyless POSTs (`/auth/logout`, provider `start`), which Fastify rejects with 400 — login/logout would have failed in production.
- The cache worker emits structured logs (via an injected `PipelineLogger`, wired to Fastify's pino `app.log`) threading the job id through the download → upload → completed stages, and logging a `failed` stage with the error on failure. The OSS uploader labels its internal seams (`content digest failed:` / `oss multipart upload failed:`), and the yt-dlp downloader labels probe/download failures, so a failure log pinpoints exactly which seam (download, hash, or upload) broke. Covered by recording-logger tests.
- Object keys are content-addressed — `videos/<artifactId>/<sha256-prefix>.<ext>`, where the digest is streamed from the artifact via an injectable `ContentDigest` (`FileSha256Digest` in production). Identical content maps to the same immutable URL (idempotent, dedup-friendly) and any content change yields a new URL, so the CDN can cache indefinitely and never serves stale bytes. This removes the need for a CDN cache refresh by design; the `CdnRefresher` seam is retained but left unwired.
- Login providers are modeled behind an `AuthProvider` port and registry exposed at `GET /api/auth/providers` and `POST /api/auth/providers/:id/start`. The GitHub provider is a real OAuth-initiation adapter that activates when `GITHUB_CLIENT_ID`/`GITHUB_REDIRECT_URI` are configured (returning a correct authorize URL, and recording the `state` in a single-use, TTL-bound state store) and reports itself unavailable otherwise; WeChat/QQ QR providers are honest placeholders. Guests remain first-class.
- The GitHub OAuth callback (`GET /api/auth/github/callback`) validates `state` (distinct mismatch and expiry branches), exchanges the code through an injectable, HTTP-mockable client covering success/rejected/failed paths, resolves the GitHub identity, upserts the user, and opens a cookie session; `GET /api/auth/me` and `POST /api/auth/logout` manage the session. The web login menu shows the signed-in user with a logout control. State, user, and session stores are in-memory with injectable clocks and full unit + route coverage; a Redis/DB implementation can replace them for horizontal scale. The token exchange requires `GITHUB_CLIENT_SECRET`.
