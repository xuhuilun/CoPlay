import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { CacheJob } from "./cache-job.model.js";
import { registerCacheJobRoutes } from "./cache-job.routes.js";
import type { CacheJobStore } from "./cache-job.store.js";

test("POST /api/cache-jobs creates a cache job", async () => {
  const { app } = await createCacheJobRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: "https://www.bilibili.com/video/BV1xx411c7mD" }
  });

  assert.equal(response.statusCode, 201);
  const job = response.json();
  assert.equal(job.sourceUrl, "https://www.bilibili.com/video/BV1xx411c7mD");
  assert.equal(job.status, "queued");
  assert.equal(job.progress, 5);

  await app.close();
});

test("POST /api/cache-jobs accepts Bilibili short links", async () => {
  const { app } = await createCacheJobRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: "https://b23.tv/example" }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().sourceUrl, "https://b23.tv/example");

  await app.close();
});

test("POST /api/cache-jobs normalizes source URLs", async () => {
  const { app } = await createCacheJobRoutesTestApp();
  const sourceUrl = "https://www.bilibili.com/video/BV1xx411c7mD";

  const response = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: ` ${sourceUrl} ` }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.json().sourceUrl, sourceUrl);

  await app.close();
});

test("POST /api/cache-jobs rejects invalid URLs", async () => {
  const { app } = await createCacheJobRoutesTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: "not-a-url" }
  });

  assert.equal(response.statusCode, 400);

  const unsupportedHost = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: "https://example.com/video/BV1xx411c7mD" }
  });

  assert.equal(unsupportedHost.statusCode, 400);

  const blank = await app.inject({
    method: "POST",
    url: "/api/cache-jobs",
    payload: { sourceUrl: " " }
  });

  assert.equal(blank.statusCode, 400);

  await app.close();
});

test("GET /api/cache-jobs/:id returns an existing cache job", async () => {
  const { app, jobs } = await createCacheJobRoutesTestApp();
  const created = await jobs.create("https://www.bilibili.com/video/BV1xx411c7mD");

  const response = await app.inject({
    method: "GET",
    url: `/api/cache-jobs/${created.id}`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), created);

  await app.close();
});

test("GET /api/cache-jobs/:id normalizes route ids", async () => {
  const { app, jobs } = await createCacheJobRoutesTestApp();
  const created = await jobs.create("https://www.bilibili.com/video/BV1xx411c7mD");

  const padded = await app.inject({
    method: "GET",
    url: `/api/cache-jobs/${encodeURIComponent(` ${created.id} `)}`
  });
  assert.equal(padded.statusCode, 200);
  assert.deepEqual(padded.json(), created);

  const blank = await app.inject({
    method: "GET",
    url: "/api/cache-jobs/%20"
  });
  assert.equal(blank.statusCode, 400);

  await app.close();
});

test("GET /api/cache-jobs/:id returns 404 for missing cache jobs", async () => {
  const { app } = await createCacheJobRoutesTestApp();

  const response = await app.inject({
    method: "GET",
    url: "/api/cache-jobs/missing_job"
  });

  assert.equal(response.statusCode, 404);

  await app.close();
});

async function createCacheJobRoutesTestApp() {
  const app = Fastify();
  const jobs = new TestCacheJobStore();
  await app.register(sensible);
  await registerCacheJobRoutes(app, jobs);
  return { app, jobs };
}

class TestCacheJobStore implements CacheJobStore {
  private readonly jobs = new Map<string, CacheJob>();
  private nextId = 1;

  create(sourceUrl: string): CacheJob {
    const now = "2026-07-19T00:00:00.000Z";
    const job: CacheJob = {
      id: `job_${this.nextId++}`,
      sourceUrl,
      status: "queued",
      progress: 5,
      message: "缓存任务已创建，等待下载。",
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    return job;
  }

  findById(id: string): CacheJob | undefined {
    return this.jobs.get(id);
  }
}
