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

## Phase 3: Production Integrations

1. Connect real Bilibili download task workers.
2. Upload cached files to CDN.
3. Add GitHub and QR-code login providers.
4. Add observability, rate limits, and admin operations.
