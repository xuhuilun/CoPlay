import assert from "node:assert/strict";
import test from "node:test";
import { RoomRepository } from "./room.repository.js";

test("couple room accepts member player state as reference", () => {
  const rooms = new RoomRepository();
  const room = rooms.create({
    type: "couple",
    videoId: "video_a",
    ownerGuestId: "host",
    ownerNickname: "Host",
    maxMembers: 2
  });

  const updated = rooms.updatePlayerState(room.id, {
    guestId: "member",
    currentTime: 42,
    paused: false,
    playbackRate: 1.25
  });

  assert.equal(updated?.playerState.currentTime, 42);
  assert.equal(updated?.playerState.paused, false);
  assert.equal(updated?.playerState.updatedBy, "member");
});

test("screening room ignores non-host player state as reference", () => {
  const rooms = new RoomRepository();
  const room = rooms.create({
    type: "screening",
    videoId: "video_a",
    ownerGuestId: "host",
    ownerNickname: "Host",
    maxMembers: 8
  });

  const updated = rooms.updatePlayerState(room.id, {
    guestId: "member",
    currentTime: 42,
    paused: false,
    playbackRate: 1.25
  });

  assert.equal(updated?.playerState.currentTime, 0);
  assert.equal(updated?.playerState.paused, true);
  assert.equal(updated?.playerState.updatedBy, "host");
});

test("screening room accepts host player state as reference", () => {
  const rooms = new RoomRepository();
  const room = rooms.create({
    type: "screening",
    videoId: "video_a",
    ownerGuestId: "host",
    ownerNickname: "Host",
    maxMembers: 8
  });

  const updated = rooms.updatePlayerState(room.id, {
    guestId: "host",
    currentTime: 88,
    paused: false,
    playbackRate: 1
  });

  assert.equal(updated?.playerState.currentTime, 88);
  assert.equal(updated?.playerState.updatedBy, "host");
});

test("joining again updates existing member nickname", () => {
  const rooms = new RoomRepository();
  const room = rooms.create({
    type: "screening",
    videoId: "video_a",
    ownerGuestId: "host",
    ownerNickname: "Host",
    maxMembers: 8
  });

  rooms.join(room.id, "guest_a", "Old Nick");
  const updated = rooms.join(room.id, "guest_a", "New Nick");

  assert.equal(updated?.members.find((member) => member.guestId === "guest_a")?.nickname, "New Nick");
  assert.equal(updated?.members.length, 2);
});
