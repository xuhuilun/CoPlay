import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import type { RoomStore } from "../rooms/room.store.js";
import type { PresenceStore } from "./presence.store.js";

type JoinPayload = {
  roomId: string;
  guestId: string;
  nickname: string;
};

type PlayerActionPayload = {
  roomId: string;
  guestId: string;
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  action: "play" | "pause" | "seek" | "sync-progress";
};

type SyncRequestPayload = {
  roomId: string;
  guestId: string;
};

type VideoSwitchPayload = {
  roomId: string;
  guestId: string;
  videoId: string;
};

const idSchema = z.string().trim().min(1).max(128);
const nicknameSchema = z.string().trim().min(1).max(32);
const joinPayloadSchema = z.object({
  roomId: idSchema,
  guestId: idSchema,
  nickname: nicknameSchema
});
const playerActionPayloadSchema = z.object({
  roomId: idSchema,
  guestId: idSchema,
  currentTime: z.number().finite().min(0).max(24 * 60 * 60),
  paused: z.boolean(),
  playbackRate: z.number().finite().min(0.25).max(3),
  action: z.enum(["play", "pause", "seek", "sync-progress"])
});
const syncRequestPayloadSchema = z.object({
  roomId: idSchema,
  guestId: idSchema
});
const videoSwitchPayloadSchema = z.object({
  roomId: idSchema,
  guestId: idSchema,
  videoId: idSchema
});

type SocketEventName = "room:join" | "player:action" | "player:sync-request" | "video:switch";
const playerActionLimiter = createSocketEventLimiter({ maxEvents: 12, windowMs: 1000 });

export function registerRealtimeGateway(
  httpServer: HttpServer,
  rooms: RoomStore,
  presence: PresenceStore,
  corsOrigin: string
) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", (rawPayload: unknown) => {
      runSocketHandler(socket, async () => {
        const parsed = parseSocketPayload(socket, "room:join", joinPayloadSchema, rawPayload);
        if (!parsed) {
          return;
        }
        const payload = parsed;
        const room = await rooms.join(payload.roomId, payload.guestId, payload.nickname);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }
        socket.join(payload.roomId);
        await presence.markOnline(payload.roomId, payload.guestId, socket.id);
        await broadcastPresence(io, rooms, presence, payload.roomId);
        socket.emit("player:sync-state", room.playerState);
      });
    });

    socket.on("disconnect", () => {
      runSocketHandler(socket, async () => {
        playerActionLimiter.clear(socket.id);
        const offline = await presence.markOffline(socket.id);
        if (offline) {
          await broadcastPresence(io, rooms, presence, offline.roomId);
        }
      });
    });

    socket.on("player:action", (rawPayload: unknown) => {
      runSocketHandler(socket, async () => {
        const parsed = parseSocketPayload(socket, "player:action", playerActionPayloadSchema, rawPayload);
        if (!parsed) {
          return;
        }
        const payload = parsed;
        if (!playerActionLimiter.allow(socket.id, "player:action")) {
          socket.emit("room:error", { message: "Player action rate limit exceeded" });
          return;
        }
        const room = await rooms.updatePlayerState(payload.roomId, payload);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }

        const shouldBroadcast =
          room.type === "couple" ||
          payload.action === "sync-progress" ||
          room.hostGuestId === payload.guestId;

        if (shouldBroadcast) {
          socket.to(payload.roomId).emit("player:event", {
            ...payload,
            roomType: room.type,
            referenceState: room.playerState
          });
        }
      });
    });

    socket.on("player:sync-request", (rawPayload: unknown) => {
      runSocketHandler(socket, async () => {
        const parsed = parseSocketPayload(socket, "player:sync-request", syncRequestPayloadSchema, rawPayload);
        if (!parsed) {
          return;
        }
        const payload = parsed;
        const room = await rooms.findById(payload.roomId);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }
        socket.emit("player:sync-state", room.playerState);
      });
    });

    socket.on("video:switch", (rawPayload: unknown) => {
      runSocketHandler(socket, async () => {
        const parsed = parseSocketPayload(socket, "video:switch", videoSwitchPayloadSchema, rawPayload);
        if (!parsed) {
          return;
        }
        const payload = parsed;
        const room = await rooms.switchVideo(payload.roomId, payload.guestId, payload.videoId);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }
        if (room.hostGuestId !== payload.guestId) {
          socket.emit("room:error", { message: "Only host can switch video" });
          return;
        }
        io.to(payload.roomId).emit("video:switch-event", room.playerState);
      });
    });
  });

  return io;
}

export function validateJoinPayload(payload: unknown): JoinPayload | undefined {
  const parsed = joinPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

export function validatePlayerActionPayload(payload: unknown): PlayerActionPayload | undefined {
  const parsed = playerActionPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

export function validateSyncRequestPayload(payload: unknown): SyncRequestPayload | undefined {
  const parsed = syncRequestPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

export function validateVideoSwitchPayload(payload: unknown): VideoSwitchPayload | undefined {
  const parsed = videoSwitchPayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

export function createSocketEventLimiter(options: {
  maxEvents: number;
  windowMs: number;
  now?: () => number;
}) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const now = options.now ?? Date.now;

  return {
    allow(socketId: string, eventName: SocketEventName): boolean {
      const key = `${socketId}:${eventName}`;
      const currentTime = now();
      const bucket = buckets.get(key);

      if (!bucket || currentTime >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: currentTime + options.windowMs });
        return true;
      }

      if (bucket.count >= options.maxEvents) {
        return false;
      }

      bucket.count += 1;
      return true;
    },
    clear(socketId: string): void {
      for (const key of buckets.keys()) {
        if (key.startsWith(`${socketId}:`)) {
          buckets.delete(key);
        }
      }
    }
  };
}

async function broadcastPresence(
  io: Server,
  rooms: RoomStore,
  presence: PresenceStore,
  roomId: string
) {
  const room = await rooms.findById(roomId);
  if (!room) {
    return;
  }
  io.to(roomId).emit("room:presence", {
    members: room.members,
    onlineGuestIds: await presence.onlineGuestIds(roomId)
  });
}

function parseSocketPayload<T>(
  socket: Pick<Socket, "emit">,
  eventName: SocketEventName,
  schema: z.ZodSchema<T>,
  payload: unknown
): T | undefined {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    socket.emit("room:error", { message: `Invalid ${eventName} payload` });
    return undefined;
  }
  return parsed.data;
}

function runSocketHandler(socket: Pick<Socket, "emit">, handler: () => Promise<void>) {
  handler().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Realtime event failed";
    socket.emit("room:error", { message });
  });
}
