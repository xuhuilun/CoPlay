import assert from "node:assert/strict";
import test from "node:test";
import { toUser } from "./prisma-user.store.js";
import { toSession } from "./prisma-session.store.js";

test("toUser maps every domain field including the ban flag", () => {
  const mapped = toUser({
    id: "usr_1",
    provider: "github",
    providerUserId: "42",
    displayName: "Octocat",
    avatarUrl: "https://a/1.png",
    banned: true,
    createdAt: new Date("2026-07-19T00:00:00.000Z"),
    updatedAt: new Date("2026-07-20T00:00:00.000Z")
  });

  assert.deepEqual(mapped, {
    id: "usr_1",
    provider: "github",
    providerUserId: "42",
    displayName: "Octocat",
    avatarUrl: "https://a/1.png",
    banned: true,
    createdAt: "2026-07-19T00:00:00.000Z"
  });
});

test("toSession maps ids and ISO timestamps", () => {
  const mapped = toSession({
    id: "sess_token",
    userId: "usr_1",
    createdAt: new Date("2026-07-19T00:00:00.000Z"),
    expiresAt: new Date("2026-07-26T00:00:00.000Z")
  });

  assert.deepEqual(mapped, {
    id: "sess_token",
    userId: "usr_1",
    createdAt: "2026-07-19T00:00:00.000Z",
    expiresAt: "2026-07-26T00:00:00.000Z"
  });
});
