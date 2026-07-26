import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { parseRouteId } from "../../shared/rest-params.js";
import { isSupportedBilibiliUrl } from "./bilibili.js";
import { toPublicCacheJob } from "./cache-job.model.js";
import { CacheJobQuotaExceededError, type CacheJobStore } from "./cache-job.store.js";

const createCacheJobSchema = z.object({
  sourceUrl: z.string().trim().url().max(512).refine(isSupportedBilibiliUrl)
});

export type CacheJobRoutesOptions = {
  /** Resolves the submitter identity for quota accounting; defaults to the client IP. */
  resolveSubmitter?: (request: FastifyRequest) => string | Promise<string>;
};

export async function registerCacheJobRoutes(
  app: FastifyInstance,
  jobs: CacheJobStore,
  options: CacheJobRoutesOptions = {}
) {
  const resolveSubmitter = options.resolveSubmitter ?? ((request) => `ip:${request.ip}`);

  app.post("/api/cache-jobs", async (request, reply) => {
    const parsed = createCacheJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("sourceUrl must be a valid URL");
    }
    const submitter = await resolveSubmitter(request);
    try {
      const job = await jobs.create(parsed.data.sourceUrl, submitter);
      return reply.code(201).send(toPublicCacheJob(job));
    } catch (error) {
      if (error instanceof CacheJobQuotaExceededError) {
        return reply
          .code(429)
          .send({ error: "quota_exceeded", message: "已达到每日缓存任务上限，请稍后再试。" });
      }
      throw error;
    }
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
    return toPublicCacheJob(job);
  });
}
