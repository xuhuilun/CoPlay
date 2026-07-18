import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../../config.js";

type RedisHealthClient = {
  ping(): Promise<string>;
};

type HealthDependencies = {
  config: AppConfig;
  getPrisma(): PrismaClient | undefined;
  getRedisClient(): RedisHealthClient | undefined;
};

export async function registerHealthRoutes(app: FastifyInstance, deps: HealthDependencies) {
  app.get("/api/health", async () => livePayload());
  app.get("/api/health/live", async () => livePayload());

  app.get("/api/health/ready", async (_request, reply) => {
    const checks: Record<string, "ok" | "skipped" | "failed"> = {
      api: "ok",
      mysql: deps.config.persistenceDriver === "prisma" ? "failed" : "skipped",
      redis: deps.config.socketAdapter === "redis" ? "failed" : "skipped"
    };

    try {
      if (deps.config.persistenceDriver === "prisma") {
        const prisma = deps.getPrisma();
        if (!prisma) {
          throw new Error("Prisma client is not initialized");
        }
        await prisma.$queryRawUnsafe("SELECT 1");
        checks.mysql = "ok";
      }
      if (deps.config.socketAdapter === "redis") {
        const redis = deps.getRedisClient();
        if (!redis) {
          throw new Error("Redis client is not initialized");
        }
        await redis.ping();
        checks.redis = "ok";
      }
    } catch {
      return reply.code(503).send({
        status: "not_ready",
        service: "coplay-api",
        checks,
        time: new Date().toISOString()
      });
    }

    return {
      status: "ready",
      service: "coplay-api",
      checks,
      time: new Date().toISOString()
    };
  });
}

function livePayload() {
  return {
    status: "ok",
    service: "coplay-api",
    time: new Date().toISOString()
  };
}
