import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { CacheJobRepository } from "./cache-job.repository.js";

const createCacheJobSchema = z.object({
  sourceUrl: z.string().url()
});

export async function registerCacheJobRoutes(app: FastifyInstance, jobs: CacheJobRepository) {
  app.post("/api/cache-jobs", async (request, reply) => {
    const parsed = createCacheJobSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.badRequest("sourceUrl must be a valid URL");
    }
    return reply.code(201).send(jobs.create(parsed.data.sourceUrl));
  });

  app.get<{ Params: { id: string } }>("/api/cache-jobs/:id", async (request, reply) => {
    const job = jobs.findById(request.params.id);
    if (!job) {
      return reply.notFound("Cache job not found");
    }
    return job;
  });
}
