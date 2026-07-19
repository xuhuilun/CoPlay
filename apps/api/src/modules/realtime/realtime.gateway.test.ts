import assert from "node:assert/strict";
import test from "node:test";
import {
  createSocketEventLimiter,
  validateJoinPayload,
  validatePlayerActionPayload,
  validateSyncRequestPayload,
  validateVideoSwitchPayload
} from "./realtime.gateway.js";

test("realtime payload validators accept expected socket events", () => {
  assert.deepEqual(validateJoinPayload({ roomId: "room_a", guestId: "guest_a", nickname: "Alex" }), {
    roomId: "room_a",
    guestId: "guest_a",
    nickname: "Alex"
  });
  assert.deepEqual(
    validatePlayerActionPayload({
      roomId: "room_a",
      guestId: "guest_a",
      currentTime: 42,
      paused: false,
      playbackRate: 1.25,
      action: "seek"
    }),
    {
      roomId: "room_a",
      guestId: "guest_a",
      currentTime: 42,
      paused: false,
      playbackRate: 1.25,
      action: "seek"
    }
  );
  assert.deepEqual(validateSyncRequestPayload({ roomId: "room_a", guestId: "guest_a" }), {
    roomId: "room_a",
    guestId: "guest_a"
  });
  assert.deepEqual(validateVideoSwitchPayload({ roomId: "room_a", guestId: "guest_a", videoId: "video_a" }), {
    roomId: "room_a",
    guestId: "guest_a",
    videoId: "video_a"
  });
});

test("realtime payload validators reject malformed player actions", () => {
  assert.equal(
    validatePlayerActionPayload({
      roomId: "room_a",
      guestId: "guest_a",
      currentTime: -1,
      paused: false,
      playbackRate: 1,
      action: "seek"
    }),
    undefined
  );
  assert.equal(
    validatePlayerActionPayload({
      roomId: "room_a",
      guestId: "guest_a",
      currentTime: 10,
      paused: false,
      playbackRate: 99,
      action: "seek"
    }),
    undefined
  );
  assert.equal(
    validatePlayerActionPayload({
      roomId: "room_a",
      guestId: "guest_a",
      currentTime: 10,
      paused: "false",
      playbackRate: 1,
      action: "seek"
    }),
    undefined
  );
});

test("socket event limiter blocks events above the window limit", () => {
  let now = 1000;
  const limiter = createSocketEventLimiter({
    maxEvents: 2,
    windowMs: 1000,
    now: () => now
  });

  assert.equal(limiter.allow("socket_a", "player:action"), true);
  assert.equal(limiter.allow("socket_a", "player:action"), true);
  assert.equal(limiter.allow("socket_a", "player:action"), false);
  assert.equal(limiter.allow("socket_b", "player:action"), true);

  now = 2000;
  assert.equal(limiter.allow("socket_a", "player:action"), true);
});

test("socket event limiter clears buckets for disconnected sockets", () => {
  const limiter = createSocketEventLimiter({
    maxEvents: 1,
    windowMs: 1000,
    now: () => 1000
  });

  assert.equal(limiter.allow("socket_a", "player:action"), true);
  assert.equal(limiter.allow("socket_a", "player:action"), false);

  limiter.clear("socket_a");

  assert.equal(limiter.allow("socket_a", "player:action"), true);
});
