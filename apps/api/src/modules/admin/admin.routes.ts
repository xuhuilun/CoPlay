import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseRouteId } from "../../shared/rest-params.js";
import type { CacheJobStatus } from "../cache-jobs/cache-job.model.js";
import type { CacheJobStore } from "../cache-jobs/cache-job.store.js";
import type { VideoStore } from "../videos/video.store.js";
import { requireAdmin, type AdminAccess } from "./admin.access.js";
import { computeUsage } from "./admin.usage.js";

const CACHE_JOB_STATUSES: CacheJobStatus[] = [
  "queued",
  "downloading",
  "uploading",
  "completed",
  "failed",
  "cancelled"
];

const MAX_LIST_LIMIT = 200;

const banBodySchema = z.object({ banned: z.boolean() });

export type AdminRoutesDeps = {
  jobs: CacheJobStore;
  videos: VideoStore;
  access: AdminAccess;
};

export async function registerAdminRoutes(app: FastifyInstance, deps: AdminRoutesDeps) {
  await app.register(async (admin) => {
    // Guard every route in this scope behind the admin allowlist.
    admin.addHook("preHandler", async (request, reply) => {
      const user = await requireAdmin(request, reply, deps.access);
      if (!user) {
        return reply;
      }
    });

    admin.get("/api/admin/me", async () => ({ ok: true }));

    admin.get<{ Querystring: { status?: string; limit?: string } }>(
      "/api/admin/cache-jobs",
      async (request) => {
        const status = CACHE_JOB_STATUSES.find((value) => value === request.query.status);
        const parsedLimit = Number(request.query.limit);
        const limit = Number.isInteger(parsedLimit)
          ? Math.min(MAX_LIST_LIMIT, Math.max(1, parsedLimit))
          : MAX_LIST_LIMIT;
        return { items: await deps.jobs.list({ status, limit }) };
      }
    );

    admin.post<{ Params: { id: string } }>("/api/admin/cache-jobs/:id/retry", async (request, reply) => {
      const id = parseRouteId(request.params.id, reply);
      if (!id) {
        return;
      }
      const job = await deps.jobs.retry(id);
      if (!job) {
        return reply.conflict("Cache job cannot be retried (missing or not in a retryable state)");
      }
      return job;
    });

    admin.post<{ Params: { id: string } }>("/api/admin/cache-jobs/:id/cancel", async (request, reply) => {
      const id = parseRouteId(request.params.id, reply);
      if (!id) {
        return;
      }
      const job = await deps.jobs.cancel(id);
      if (!job) {
        return reply.conflict("Cache job cannot be cancelled (missing or already finished)");
      }
      return job;
    });

    admin.get("/api/admin/users", async () => ({ items: await deps.access.users.list() }));

    admin.post<{ Params: { id: string } }>("/api/admin/users/:id/ban", async (request, reply) => {
      const id = parseRouteId(request.params.id, reply);
      if (!id) {
        return;
      }
      const body = banBodySchema.safeParse(request.body);
      if (!body.success) {
        return reply.badRequest("banned must be a boolean");
      }
      const user = await deps.access.users.setBanned(id, body.data.banned);
      if (!user) {
        return reply.notFound("User not found");
      }
      return user;
    });

    admin.get("/api/admin/usage", async () => {
      const [jobs, videos] = await Promise.all([deps.jobs.list(), deps.videos.list()]);
      return computeUsage(jobs, videos.length);
    });
  });
}
