import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { VideoRepository } from "../videos/video.repository.js";
import { RoomRepository } from "./room.repository.js";
import { registerRoomRoutes } from "./room.routes.js";

test("POST /api/rooms creates a room for an existing video", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });

  assert.equal(response.statusCode, 201);
  const room = response.json();
  assert.equal(room.videoId, videoId);
  assert.equal(room.hostGuestId, "host");
  assert.equal(room.maxMembers, 8);
  assert.equal(room.members[0].role, "host");

  await app.close();
});

test("POST /api/rooms caps couple room capacity to two members", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "couple",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 100
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().maxMembers, 2);

  await app.close();
});

test("POST /api/rooms normalizes owner nicknames", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: `  ${"A".repeat(40)}  `,
      maxMembers: 8
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().members[0].nickname, "A".repeat(24));

  await app.close();
});

test("POST /api/rooms normalizes body ids", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId: ` ${videoId} `,
      type: "screening",
      ownerGuestId: " host ",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().videoId, videoId);
  assert.equal(response.json().hostGuestId, "host");
  assert.equal(response.json().members[0].guestId, "host");

  await app.close();
});

test("POST /api/rooms rejects invalid payloads and unknown videos", async () => {
  const { app } = await createRoomRoutesTestApp();

  const invalidPayload = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: { videoId: "", type: "screening", ownerGuestId: "host" }
  });
  assert.equal(invalidPayload.statusCode, 400);

  const blankIdPayload = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId: " ",
      type: "screening",
      ownerGuestId: " ",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });
  assert.equal(blankIdPayload.statusCode, 400);

  const unknownVideo = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId: "missing_video",
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });
  assert.equal(unknownVideo.statusCode, 404);

  await app.close();
});

test("POST /api/rooms/:id/join normalizes guest nicknames", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });
  const room = created.json();

  const joined = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.id}/join`,
    payload: { guestId: "guest_a", nickname: `  ${"B".repeat(40)}  ` }
  });

  assert.equal(joined.statusCode, 200);
  assert.equal(
    joined.json().members.find((member: { guestId: string }) => member.guestId === "guest_a")?.nickname,
    "B".repeat(24)
  );

  await app.close();
});

test("POST /api/rooms/:id/join normalizes body ids", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });
  const room = created.json();

  const joined = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.id}/join`,
    payload: { guestId: " guest_a ", nickname: "Guest A" }
  });

  assert.equal(joined.statusCode, 200);
  assert.ok(
    joined.json().members.find((member: { guestId: string }) => member.guestId === "guest_a")
  );

  await app.close();
});

test("room detail and join normalize route ids", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "screening",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 8
    }
  });
  const room = created.json();
  const paddedRoomId = encodeURIComponent(` ${room.id} `);

  const detail = await app.inject({
    method: "GET",
    url: `/api/rooms/${paddedRoomId}`
  });
  assert.equal(detail.statusCode, 200);
  assert.equal(detail.json().id, room.id);

  const joined = await app.inject({
    method: "POST",
    url: `/api/rooms/${paddedRoomId}/join`,
    payload: { guestId: "guest_a", nickname: "Guest A" }
  });
  assert.equal(joined.statusCode, 200);
  assert.equal(joined.json().members.length, 2);

  await app.close();
});

test("room route ids reject blank values", async () => {
  const { app } = await createRoomRoutesTestApp();

  const detail = await app.inject({
    method: "GET",
    url: "/api/rooms/%20"
  });
  assert.equal(detail.statusCode, 400);

  const joined = await app.inject({
    method: "POST",
    url: "/api/rooms/%20/join",
    payload: { guestId: "guest_a", nickname: "Guest A" }
  });
  assert.equal(joined.statusCode, 400);

  await app.close();
});

test("POST /api/rooms/:id/join joins guests and enforces capacity", async () => {
  const { app, videoId } = await createRoomRoutesTestApp();

  const created = await app.inject({
    method: "POST",
    url: "/api/rooms",
    payload: {
      videoId,
      type: "couple",
      ownerGuestId: "host",
      ownerNickname: "Host",
      maxMembers: 2
    }
  });
  const room = created.json();

  const joined = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.id}/join`,
    payload: { guestId: "guest_a", nickname: "Guest A" }
  });
  assert.equal(joined.statusCode, 200);
  assert.equal(joined.json().members.length, 2);

  const full = await app.inject({
    method: "POST",
    url: `/api/rooms/${room.id}/join`,
    payload: { guestId: "guest_b", nickname: "Guest B" }
  });
  assert.equal(full.statusCode, 409);
  assert.deepEqual(full.json(), { message: "Room is full" });

  await app.close();
});

test("POST /api/rooms/:id/join rejects malformed requests and missing rooms", async () => {
  const { app } = await createRoomRoutesTestApp();

  const invalidPayload = await app.inject({
    method: "POST",
    url: "/api/rooms/missing_room/join",
    payload: { guestId: "" }
  });
  assert.equal(invalidPayload.statusCode, 400);

  const blankGuestId = await app.inject({
    method: "POST",
    url: "/api/rooms/missing_room/join",
    payload: { guestId: " ", nickname: "Guest A" }
  });
  assert.equal(blankGuestId.statusCode, 400);

  const missingRoom = await app.inject({
    method: "POST",
    url: "/api/rooms/missing_room/join",
    payload: { guestId: "guest_a", nickname: "Guest A" }
  });
  assert.equal(missingRoom.statusCode, 404);

  await app.close();
});

async function createRoomRoutesTestApp() {
  const app = Fastify();
  const rooms = new RoomRepository();
  const videos = new VideoRepository();
  await app.register(sensible);
  await registerRoomRoutes(app, rooms, videos);
  const [video] = await videos.hot();
  assert.ok(video);
  return { app, videoId: video.id };
}
