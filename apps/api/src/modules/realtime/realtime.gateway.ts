import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { RoomRepository } from "../rooms/room.repository.js";

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
  rooms: RoomRepository,
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
      const room = rooms.join(payload.roomId, payload.guestId, payload.nickname);
      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }
      socket.join(payload.roomId);
      io.to(payload.roomId).emit("room:presence", room.members);
      socket.emit("player:sync-state", room.playerState);
    });

    socket.on("player:action", (payload: PlayerActionPayload) => {
      const room = rooms.updatePlayerState(payload.roomId, payload);
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

    socket.on("player:sync-request", (payload: SyncRequestPayload) => {
      const room = rooms.findById(payload.roomId);
      if (!room) {
        socket.emit("room:error", { message: "Room not found" });
        return;
      }
      socket.emit("player:sync-state", room.playerState);
    });

    socket.on("video:switch", (payload: VideoSwitchPayload) => {
      const room = rooms.switchVideo(payload.roomId, payload.guestId, payload.videoId);
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

  return io;
}
