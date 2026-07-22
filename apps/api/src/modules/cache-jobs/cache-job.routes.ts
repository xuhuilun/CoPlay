import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRouteId } from "../../shared/rest-params.js";
import type { CacheJobStore } from "./cache-job.store.js";

const createCacheJobSchema = z.object({
  sourceUrl: z.string().trim().url().max(512).refine(isSupportedBilibiliUrl)
});

function isSupportedBilibiliUrl(value: string): boolean {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "bilibili.com" || hostname.endsWith(".bilibili.com") || hostname === "b23.tv";
  } catch {
    return false;
  }
}

export async function registerCacheJobRoutes(app: FastifyInstance, jobs: CacheJobStore) {
  app.post("/api/cache-jobs", async (request, reply) => {
    const parsed = createCacheJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("sourceUrl must be a valid URL");
    }
    return reply.code(201).send(await jobs.create(parsed.data.sourceUrl));
  });

  app.get<{ Params: { id: string } }>("/api/cache-jobs/:id", async (request, reply) => {
    const id = parseRouteId(request.params.id, reply);
    if (!id) {
      return;
    }
    const job = await jobs.findById(id);
    if (!job) {
      return reply.notFound("Cache job not found");
    }
    return job;
  });
}
