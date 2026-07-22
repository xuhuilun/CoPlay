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
- API CORS configuration supports comma-separated `WEB_ORIGINS` while keeping `WEB_ORIGIN` compatibility.
- API numeric environment settings fall back to safe defaults when invalid.
- API string environment settings trim whitespace and fall back when blank.
- API CDN base URL settings are normalized and fall back to the production CDN default when invalid.
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

## Phase 3: Production Integrations

1. Connect real Bilibili download task workers.
2. Upload cached files to CDN.
3. Add GitHub and QR-code login providers.
4. Add observability, rate limits, and admin operations.
