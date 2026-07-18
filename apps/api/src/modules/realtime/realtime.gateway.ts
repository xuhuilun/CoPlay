import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { RoomStore } from "../rooms/room.store.js";

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

export function registerRealtimeGateway(
  httpServer: HttpServer,
  rooms: RoomStore,
  corsOrigin: string
) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:join", (payload: JoinPayload) => {
      runSocketHandler(socket, async () => {
        const room = await rooms.join(payload.roomId, payload.guestId, payload.nickname);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }
        socket.join(payload.roomId);
        io.to(payload.roomId).emit("room:presence", room.members);
        socket.emit("player:sync-state", room.playerState);
      });
    });

    socket.on("player:action", (payload: PlayerActionPayload) => {
      runSocketHandler(socket, async () => {
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

    socket.on("player:sync-request", (payload: SyncRequestPayload) => {
      runSocketHandler(socket, async () => {
        const room = await rooms.findById(payload.roomId);
        if (!room) {
          socket.emit("room:error", { message: "Room not found" });
          return;
        }
        socket.emit("player:sync-state", room.playerState);
      });
    });

    socket.on("video:switch", (payload: VideoSwitchPayload) => {
      runSocketHandler(socket, async () => {
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

function runSocketHandler(socket: { emit: (event: string, payload: { message: string }) => void }, handler: () => Promise<void>) {
  handler().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Realtime event failed";
    socket.emit("room:error", { message });
  });
}
