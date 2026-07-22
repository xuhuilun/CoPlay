# Deployment

## Target

- Server: Alibaba Cloud Hong Kong, Ubuntu 22.04.
- Domain: `bilisync.top`.
- Video CDN: stores and distributes cached videos. CoPlay only stores CDN URLs.

## Services

Docker Compose starts:

- `web`: Vite-built static site served by Nginx.
- `api`: REST API and Socket.IO.
- `mysql`: future durable store.
- `redis`: future room state and Socket.IO adapter.
- `nginx`: public reverse proxy.

## Nginx Routing

- `/` -> web static files.
- `/api` -> API service.
- `/socket.io` -> API WebSocket endpoint.

## Health Checks

- `GET /api/health/live`: process liveness.
- `GET /api/health/ready`: dependency readiness.

Readiness checks MySQL only when `PERSISTENCE_DRIVER=prisma`, and Redis only when `SOCKET_ADAPTER=redis`.
Driver settings are trimmed before matching. Unknown values fall back to `memory`.

## API Safety Defaults

The API enables standard security headers and global HTTP rate limiting.

```bash
WEB_ORIGINS="https://bilisync.top,https://www.bilisync.top"
RATE_LIMIT_MAX=300
RATE_LIMIT_WINDOW="1 minute"
CDN_BASE_URL="https://cdn.bilisync.top"
```

`WEB_ORIGINS` is the preferred comma-separated CORS allowlist for both REST and Socket.IO. `WEB_ORIGIN` remains supported for single-origin deployments.

`CDN_BASE_URL` must be a valid URL. It is trimmed, normalized without a trailing slash, and falls back to `https://cdn.bilisync.top` when invalid.

`API_PORT` and `RATE_LIMIT_MAX` must be positive integers. Invalid values fall back to `4000` and `300` so a bad environment value does not start the API with `NaN`.

`RATE_LIMIT_WINDOW` is trimmed before registration. Blank values fall back to `1 minute`.

WebSocket player actions are validated and throttled per socket so noisy clients cannot flood room synchronization.

## Quality Gate

GitHub Actions runs the same core checks used locally:

```bash
npm ci
npm run prisma:generate -w apps/api
npm test
npm run typecheck
npm run build
npm audit --omit=dev
```

## Request Tracing

The API accepts `x-request-id` from upstream proxies or generates one per request. The same value is returned in the response header and appears in Fastify logs.

## Local Commands

```bash
npm install
npm run prisma:generate -w apps/api
npm run dev -w apps/api
npm run dev -w apps/web
```

Database setup:

```bash
npm run prisma:migrate -w apps/api
npm run db:seed -w apps/api
```

Production migration:

```bash
npm exec -w apps/api -- prisma migrate deploy --schema prisma/schema.prisma
```

To run the API against MySQL, set:

```bash
PERSISTENCE_DRIVER=prisma
DATABASE_URL=mysql://coplay:coplay_password@mysql:3306/coplay
```

`DATABASE_URL` is trimmed and must be a valid URL. Invalid values are ignored so Prisma mode fails with an explicit missing dependency instead of receiving a malformed URL.

The default remains `PERSISTENCE_DRIVER=memory` so local development still works without a running database.

To run multiple API instances behind Nginx, enable the Socket.IO Redis adapter:

```bash
SOCKET_ADAPTER=redis
REDIS_URL=redis://redis:6379
```

Keep `SOCKET_ADAPTER=memory` for single-instance development.

`REDIS_URL` is trimmed and must be a valid URL. Invalid values are ignored so Redis mode fails before opening a malformed client connection.

Docker:

```bash
docker compose up --build
```

Compose health checks:

- `api`: calls `/api/health/ready`.
- `web`: verifies the static site responds.
- `nginx`: waits for healthy `api` and `web` before serving traffic.

Nginx keeps long WebSocket reads open for room synchronization and enables gzip for static/API text responses.
