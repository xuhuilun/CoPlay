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

To run the API against MySQL, set:

```bash
PERSISTENCE_DRIVER=prisma
DATABASE_URL=mysql://coplay:coplay_password@mysql:3306/coplay
```

The default remains `PERSISTENCE_DRIVER=memory` so local development still works without a running database.

Docker:

```bash
docker compose up --build
```
