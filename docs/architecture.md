# CoPlay Architecture

## Goal

CoPlay is a front-end/back-end separated synchronized video watching platform. The first release focuses on a usable MVP: video discovery, simulated Bilibili cache jobs, a video library, room creation, invite links, and WebSocket player coordination.

## Recommended Stack

- Web: React, Vite, TypeScript.
- API: Node.js, TypeScript, Fastify, Socket.IO.
- Data: MySQL for durable records, Redis for online room state and future Socket.IO scaling.
- Edge: Nginx for web/API/WebSocket routing.
- Delivery: third-party CDN for video files. The web server never proxies video streams.
- Deployment: Docker Compose on Ubuntu 22.04.

## Modules

- `videos`: cached video metadata, hot videos, search.
- `cache-jobs`: accepts Bilibili URLs and tracks cache progress.
- `rooms`: room lifecycle, guest join, room policy.
- `realtime`: WebSocket events for player actions and room presence.
- `web`: product UI and player experience.

## Room Policies

### Couple Room

- Maximum 2 members.
- Play, pause, and seek events sync immediately.
- The `sync-progress` button is always available as fallback.

### Screening Room

- Capacity is selected by the host.
- Host player is the reference state.
- Members are not force-paused or force-seeked during normal playback.
- Members can click `sync to host`.
- Host video switching is broadcast as a high-priority event so members can follow.

## Scaling Path

The current runtime still keeps MVP repositories in process for fast local development. Prisma/MySQL schema and Redis configuration are now present as the persistence foundation. The next implementation step is replacing repository internals with Prisma and moving online room state to Redis without changing REST or WebSocket contracts. Socket.IO can then use the Redis adapter when multiple API instances are deployed.
