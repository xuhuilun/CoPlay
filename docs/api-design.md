# API Design

## REST API

Base path: `/api`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health check |
| GET | `/health/live` | Liveness check for process supervisors |
| GET | `/health/ready` | Readiness check for dependent services |
| GET | `/videos/hot` | List hot videos |
| GET | `/videos?query=` | Search cached videos |
| GET | `/videos/:id` | Read video detail |
| POST | `/cache-jobs` | Create a Bilibili cache job |
| GET | `/cache-jobs/:id` | Read cache progress |
| POST | `/rooms` | Create a room |
| GET | `/rooms/:id` | Read room detail |
| POST | `/rooms/:id/join` | Join room as guest |

REST route `:id` parameters are trimmed before lookup. Blank or whitespace-only IDs return `400`; syntactically non-empty but missing resources still return `404`.

Room REST body IDs (`videoId`, `ownerGuestId`, `guestId`) are trimmed, must be non-empty, and are capped at 128 characters before they reach room state.

Cache job `sourceUrl` values are trimmed before URL validation and persistence. Cache requests only accept Bilibili sources: `bilibili.com` subdomains and `b23.tv` short links.

Room nicknames are trimmed and capped at 24 characters on create, join, and realtime join events.

## WebSocket Events

Namespace: default Socket.IO namespace.

| Event | Direction | Purpose |
| --- | --- | --- |
| `room:join` | Client to server | Join a room socket channel |
| `room:presence` | Server to client | Broadcast durable members and online guest IDs |
| `player:action` | Client to server | Send play, pause, seek, or progress sync action |
| `player:event` | Server to client | Broadcast accepted player action |
| `player:sync-request` | Client to server | Ask for host/reference player state |
| `player:sync-state` | Server to client | Return current reference state |
| `video:switch` | Client to server | Host switches room video |
| `video:switch-event` | Server to client | Notify members of video switch |
| `cache-job:subscribe` | Client to server | Subscribe to one cache job progress |
| `cache-job:update` | Server to client | Push cache job progress update |

`room:presence` payload:

```json
{
  "members": [
    { "guestId": "guest_123", "nickname": "游客123", "role": "host" }
  ],
  "onlineGuestIds": ["guest_123"]
}
```

`video:switch-event` carries the new reference `PlayerState`. Clients must load `videoId` from the video API before applying playback state.

### WebSocket Guardrails

Realtime client-to-server events are validated before touching room state:

- Common IDs (`roomId`, `guestId`, `videoId`) must be non-empty strings up to 128 characters.
- `nickname` must be a non-empty string up to 32 characters.
- `player:action.currentTime` must be finite and between 0 seconds and 24 hours.
- `player:action.playbackRate` must be finite and between `0.25` and `3`.
- `player:action.action` only accepts `play`, `pause`, `seek`, or `sync-progress`.
- `cache-job:subscribe.jobId` must be a non-empty string up to 128 characters.

Invalid events return `room:error` and are ignored. `player:action` is limited to 12 events per socket per second to protect room synchronization from noisy clients.

`cache-job:subscribe` payload:

```json
{
  "jobId": "job_123"
}
```

`cache-job:update` payload is the same shape as `GET /cache-jobs/:id`.

## Invite Message

The web client generates the invite text from the current full URL:

`快来加入我的房间一起玩吧！ <current-url>`
