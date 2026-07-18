# API Design

## REST API

Base path: `/api`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health check |
| GET | `/videos/hot` | List hot videos |
| GET | `/videos?query=` | Search cached videos |
| GET | `/videos/:id` | Read video detail |
| POST | `/cache-jobs` | Create a Bilibili cache job |
| GET | `/cache-jobs/:id` | Read cache progress |
| POST | `/rooms` | Create a room |
| GET | `/rooms/:id` | Read room detail |
| POST | `/rooms/:id/join` | Join room as guest |

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

`room:presence` payload:

```json
{
  "members": [
    { "guestId": "guest_123", "nickname": "游客123", "role": "host" }
  ],
  "onlineGuestIds": ["guest_123"]
}
```

## Invite Message

The web client generates the invite text from the current full URL:

`快来加入我的房间一起玩吧！ <current-url>`
