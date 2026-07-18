# Data Model

## Purpose

This document records the durable MySQL model used by CoPlay. The MVP runtime can still use in-memory repositories, but the schema is ready for replacing repository internals with Prisma.

## Tables

### `Video`

Stores cached video metadata. `cdnUrl` is the direct CDN playback URL; the web/API server does not proxy video content.

Important fields:

- `title`: unique display title used by the seed script.
- `sourceUrl`: original Bilibili or library URL.
- `cdnUrl`: CDN playback URL.
- `tagsJson`: flexible tag list.
- `hotScore`: ordering signal for the homepage.

### `CacheJob`

Tracks user-submitted Bilibili cache tasks.

Important fields:

- `sourceUrl`: submitted Bilibili link.
- `status`: queued, downloading, uploading, completed, or failed.
- `progress`: integer percentage.
- `videoId`: set after CDN upload creates a library video.

### `Room`

Stores durable room metadata and reference player state.

Important fields:

- `type`: couple or screening.
- `hostGuestId`: guest identity of the creator.
- `currentTime`, `paused`, `playbackRate`: reference player state.
- `stateUpdatedBy`, `stateUpdatedAt`: conflict/debug metadata.

### `RoomMember`

Stores room membership and role.

Important fields:

- `guestId`: browser-generated guest identity.
- `role`: host or member.
- Unique constraint: one guest can appear once per room.
