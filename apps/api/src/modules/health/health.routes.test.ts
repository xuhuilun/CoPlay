import type { PrismaClient } from "@prisma/client";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import type { AppConfig } from "../../config.js";
import { registerHealthRoutes } from "./health.routes.js";

test("GET /api/health/live returns liveness payload", async () => {
  const app = await createHealthTestApp(baseConfig());

  const response = await app.inject({
    method: "GET",
    url: "/api/health/live"
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
  assert.equal(response.json().service, "coplay-api");

  await app.close();
});

test("GET /api/health/ready skips external checks in memory mode", async () => {
  const app = await createHealthTestApp(baseConfig());

  const response = await app.inject({
    method: "GET",
    url: "/api/health/ready"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().checks, {
    api: "ok",
    mysql: "skipped",
    redis: "skipped"
  });

  await app.close();
});

test("GET /api/health/ready checks prisma and redis dependencies", async () => {
  const app = await createHealthTestApp(
    baseConfig({ persistenceDriver: "prisma", socketAdapter: "redis" }),
    {
      prisma: { $queryRawUnsafe: async () => 1 } as unknown as PrismaClient,
      redis: { ping: async () => "PONG" }
    }
  );

  const response = await app.inject({
    method: "GET",
    url: "/api/health/ready"
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().checks, {
    api: "ok",
    mysql: "ok",
    redis: "ok"
  });

  await app.close();
});

test("GET /api/health/ready returns 503 when a required dependency fails", async () => {
  const app = await createHealthTestApp(
    baseConfig({ persistenceDriver: "prisma", socketAdapter: "redis" }),
    {
      prisma: {
        $queryRawUnsafe: async () => {
          throw new Error("database unavailable");
        }
      } as unknown as PrismaClient,
      redis: { ping: async () => "PONG" }
    }
  );

  const response = await app.inject({
    method: "GET",
    url: "/api/health/ready"
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().status, "not_ready");
  assert.deepEqual(response.json().checks, {
    api: "ok",
    mysql: "failed",
    redis: "failed"
  });

  await app.close();
});

async function createHealthTestApp(
  config: AppConfig,
  deps: {
    prisma?: PrismaClient;
    redis?: { ping(): Promise<string> };
  } = {}
) {
  const app = Fastify();
  await registerHealthRoutes(app, {
    config,
    getPrisma: () => deps.prisma,
    getRedisClient: () => deps.redis
  });
  return app;
}

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 4000,
    webOrigin: "http://localhost:5173",
    cdnBaseUrl: "https://cdn.bilisync.top",
    persistenceDriver: "memory",
    socketAdapter: "memory",
    rateLimitMax: 300,
    rateLimitWindow: "1 minute",
    ...overrides
  };
}
