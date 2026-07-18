import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { VideoRepository } from "../videos/video.repository.js";
import type { RoomRepository } from "./room.repository.js";

const createRoomSchema = z.object({
  videoId: z.string().min(1),
  type: z.enum(["couple", "screening"]),
  ownerGuestId: z.string().min(1),
  ownerNickname: z.string().min(1).default("游客"),
  maxMembers: z.number().int().min(2).max(100).default(8)
});

const joinRoomSchema = z.object({
  guestId: z.string().min(1),
  nickname: z.string().min(1).default("游客")
});

export async function registerRoomRoutes(
  app: FastifyInstance,
  rooms: RoomRepository,
  videos: VideoRepository
) {
  app.post("/api/rooms", async (request, reply) => {
    const parsed = createRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid room payload");
    }
    if (!videos.findById(parsed.data.videoId)) {
      return reply.notFound("Video not found");
    }
    return reply.code(201).send(rooms.create(parsed.data));
  });

  app.get<{ Params: { id: string } }>("/api/rooms/:id", async (request, reply) => {
    const room = rooms.findById(request.params.id);
    if (!room) {
      return reply.notFound("Room not found");
    }
    return room;
  });

  app.post<{ Params: { id: string } }>("/api/rooms/:id/join", async (request, reply) => {
    const parsed = joinRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid join payload");
    }
    try {
      const room = rooms.join(request.params.id, parsed.data.guestId, parsed.data.nickname);
      if (!room) {
        return reply.notFound("Room not found");
      }
      return room;
    } catch (error) {
      if (error instanceof Error && error.message === "ROOM_FULL") {
        return reply.code(409).send({ message: "Room is full" });
      }
      throw error;
    }
  });
}
