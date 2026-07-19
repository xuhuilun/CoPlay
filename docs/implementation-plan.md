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
- API CORS configuration supports comma-separated `WEB_ORIGINS` while keeping `WEB_ORIGIN` compatibility.
- API numeric environment settings fall back to safe defaults when invalid.

## Phase 3: Production Integrations

1. Connect real Bilibili download task workers.
2. Upload cached files to CDN.
3. Add GitHub and QR-code login providers.
4. Add observability, rate limits, and admin operations.
