import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { MemorySessionStore } from "../auth/session.store.js";
import { MemoryUserStore } from "../auth/user.store.js";
import { CacheJobRepository } from "../cache-jobs/cache-job.repository.js";
import { registerAdminRoutes } from "./admin.routes.js";
import { isAdminUser } from "./admin.access.js";

const SESSION_COOKIE = "coplay_session";
const ADMIN_GITHUB_ID = "42";

test("isAdminUser only accepts allowlisted github ids", () => {
  const base = { id: "u1", displayName: "A", avatarUrl: "", createdAt: "" };
  assert.equal(isAdminUser({ ...base, provider: "github", providerUserId: "42" }, ["42"]), true);
  assert.equal(isAdminUser({ ...base, provider: "github", providerUserId: "99" }, ["42"]), false);
  assert.equal(isAdminUser({ ...base, provider: "wechat", providerUserId: "42" }, ["42"]), false);
});

test("admin routes reject anonymous (401) and non-admin (403) callers", async () => {
  const { app, memberCookie } = await createAdminTestApp();

  const anon = await app.inject({ method: "GET", url: "/api/admin/cache-jobs" });
  assert.equal(anon.statusCode, 401);

  const member = await app.inject({
    method: "GET",
    url: "/api/admin/cache-jobs",
    headers: { cookie: memberCookie }
  });
  assert.equal(member.statusCode, 403);

  await app.close();
});

test("admin can list cache jobs and filter by status", async () => {
  const { app, jobs, adminCookie } = await createAdminTestApp();
  jobs.create("https://www.bilibili.com/video/BV1aa411c7m1", "ip:1");
  const failing = jobs.create("https://www.bilibili.com/video/BV1aa411c7m2", "ip:1");
  jobs.cancel(failing.id);

  const all = await app.inject({ method: "GET", url: "/api/admin/cache-jobs", headers: { cookie: adminCookie } });
  assert.equal(all.statusCode, 200);
  assert.equal(all.json().items.length, 2);

  const cancelled = await app.inject({
    method: "GET",
    url: "/api/admin/cache-jobs?status=cancelled",
    headers: { cookie: adminCookie }
  });
  assert.deepEqual(
    cancelled.json().items.map((j: { status: string }) => j.status),
    ["cancelled"]
  );

  await app.close();
});

test("admin can cancel an active job and retry a cancelled one", async () => {
  const { app, jobs, adminCookie } = await createAdminTestApp();
  const job = jobs.create("https://www.bilibili.com/video/BV1aa411c7m1", "ip:1");

  const cancelled = await app.inject({
    method: "POST",
    url: `/api/admin/cache-jobs/${job.id}/cancel`,
    headers: { cookie: adminCookie }
  });
  assert.equal(cancelled.statusCode, 200);
  assert.equal(cancelled.json().status, "cancelled");

  const retried = await app.inject({
    method: "POST",
    url: `/api/admin/cache-jobs/${job.id}/retry`,
    headers: { cookie: adminCookie }
  });
  assert.equal(retried.statusCode, 200);
  assert.equal(retried.json().status, "queued");

  // Cancelling an already-terminal (completed) job is a conflict; retry of a queued job too.
  const badRetry = await app.inject({
    method: "POST",
    url: `/api/admin/cache-jobs/${job.id}/retry`,
    headers: { cookie: adminCookie }
  });
  assert.equal(badRetry.statusCode, 409);

  await app.close();
});

async function createAdminTestApp() {
  const app = Fastify();
  const users = new MemoryUserStore();
  const sessions = new MemorySessionStore();
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, { stepDelayMs: 100000 });

  const admin = users.upsertByProvider({
    provider: "github",
    providerUserId: ADMIN_GITHUB_ID,
    displayName: "Admin",
    avatarUrl: ""
  });
  const member = users.upsertByProvider({
    provider: "github",
    providerUserId: "member",
    displayName: "Member",
    avatarUrl: ""
  });
  const adminCookie = `${SESSION_COOKIE}=${sessions.create(admin.id).id}`;
  const memberCookie = `${SESSION_COOKIE}=${sessions.create(member.id).id}`;

  await app.register(sensible);
  await registerAdminRoutes(app, {
    jobs,
    access: { sessions, users, sessionCookieName: SESSION_COOKIE, adminGithubIds: [ADMIN_GITHUB_ID] }
  });
  return { app, jobs, adminCookie, memberCookie };
}

class StubVideoStore {
  list() {
    return [];
  }
  hot() {
    return [];
  }
  findById() {
    return undefined;
  }
  addFromCache() {
    return {
      id: "vid_stub",
      title: "t",
      description: "d",
      source: "bilibili" as const,
      sourceUrl: "https://www.bilibili.com",
      cdnUrl: "https://cdn.example/v.mp4",
      posterUrl: "",
      durationSeconds: 30,
      cachedAt: "",
      tags: [],
      hotScore: 0,
      sources: [{ id: "auto", label: "原画", url: "https://cdn.example/v.mp4" }]
    };
  }
}
