import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRouteId } from "../../shared/rest-params.js";
import type { VideoStore } from "../videos/video.store.js";
import type { RoomStore } from "./room.store.js";

const nicknameSchema = z.string().trim().min(1).transform((value) => value.slice(0, 24));
const bodyIdSchema = z.string().trim().min(1).max(128);

const createRoomSchema = z.object({
  videoId: bodyIdSchema,
  type: z.enum(["couple", "screening"]),
  ownerGuestId: bodyIdSchema,
  ownerNickname: nicknameSchema.default("游客"),
  maxMembers: z.number().int().min(2).max(100).default(8)
});

const joinRoomSchema = z.object({
  guestId: bodyIdSchema,
  nickname: nicknameSchema.default("游客")
});

export async function registerRoomRoutes(
  app: FastifyInstance,
  rooms: RoomStore,
  videos: VideoStore
) {
  app.post("/api/rooms", async (request, reply) => {
    const parsed = createRoomSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("Invalid room payload");
    }
    if (!(await videos.findById(parsed.data.videoId))) {
      return reply.notFound("Video not found");
    }
    return reply.code(201).send(await rooms.create(parsed.data));
  });

  app.get<{ Params: { id: string } }>("/api/rooms/:id", async (request, reply) => {
    const id = parseRouteId(request.params.id, reply);
    if (!id) {
      return;
    }
    const room = await rooms.findById(id);
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
    const id = parseRouteId(request.params.id, reply);
    if (!id) {
      return;
    }
    try {
      const room = await rooms.join(id, parsed.data.guestId, parsed.data.nickname);
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
