import assert from "node:assert/strict";
import test from "node:test";
import { MemoryAuthStateStore } from "./auth-state.store.js";
import { MemorySessionStore } from "./session.store.js";
import { MemoryUserStore } from "./user.store.js";

test("auth state store validates, expires, and single-uses states", () => {
  let now = 1000;
  const store = new MemoryAuthStateStore(5000, () => now);

  store.issue("state_a");
  assert.equal(store.consume("state_a"), "valid");
  // Replaying a consumed state is treated as unknown, not valid.
  assert.equal(store.consume("state_a"), "unknown");

  store.issue("state_b");
  now = 6001; // past the 5000ms TTL
  assert.equal(store.consume("state_b"), "expired");

  assert.equal(store.consume("never_issued"), "unknown");
});

test("user store upserts identities by provider without duplicating", () => {
  const store = new MemoryUserStore(() => "2026-07-19T00:00:00.000Z");

  const first = store.upsertByProvider({
    provider: "github",
    providerUserId: "42",
    displayName: "Octocat",
    avatarUrl: "https://avatars.example/1.png"
  });
  const second = store.upsertByProvider({
    provider: "github",
    providerUserId: "42",
    displayName: "Octocat Renamed",
    avatarUrl: "https://avatars.example/2.png"
  });

  assert.equal(second.id, first.id);
  assert.equal(second.displayName, "Octocat Renamed");
  assert.equal(second.avatarUrl, "https://avatars.example/2.png");
  assert.equal(store.findById(first.id)?.displayName, "Octocat Renamed");

  const other = store.upsertByProvider({
    provider: "github",
    providerUserId: "99",
    displayName: "Someone",
    avatarUrl: ""
  });
  assert.notEqual(other.id, first.id);
});

test("session store creates, resolves, expires, and destroys sessions", () => {
  let now = 1000;
  const store = new MemorySessionStore(5000, () => now);

  const session = store.create("usr_1");
  assert.equal(store.find(session.id)?.userId, "usr_1");

  store.destroy(session.id);
  assert.equal(store.find(session.id), undefined);

  const expiring = store.create("usr_2");
  now = 6001;
  assert.equal(store.find(expiring.id), undefined);
});
