import assert from "node:assert/strict";
import test from "node:test";
import { MemoryPresenceStore } from "./memory-presence.store.js";

test("memory presence keeps guest online until all sockets disconnect", async () => {
  const presence = new MemoryPresenceStore();

  await presence.markOnline("room_a", "guest_a", "socket_1");
  await presence.markOnline("room_a", "guest_a", "socket_2");
  assert.deepEqual(await presence.onlineGuestIds("room_a"), ["guest_a"]);

  await presence.markOffline("socket_1");
  assert.deepEqual(await presence.onlineGuestIds("room_a"), ["guest_a"]);

  await presence.markOffline("socket_2");
  assert.deepEqual(await presence.onlineGuestIds("room_a"), []);
});

test("memory presence tracks rooms independently", async () => {
  const presence = new MemoryPresenceStore();

  await presence.markOnline("room_a", "guest_a", "socket_1");
  await presence.markOnline("room_b", "guest_b", "socket_2");

  assert.deepEqual(await presence.onlineGuestIds("room_a"), ["guest_a"]);
  assert.deepEqual(await presence.onlineGuestIds("room_b"), ["guest_b"]);
});
