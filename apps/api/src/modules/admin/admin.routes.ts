import type { FastifyInstance } from "fastify";
import { parseRouteId } from "../../shared/rest-params.js";
import type { CacheJobStatus } from "../cache-jobs/cache-job.model.js";
import type { CacheJobStore } from "../cache-jobs/cache-job.store.js";
import { requireAdmin, type AdminAccess } from "./admin.access.js";

const CACHE_JOB_STATUSES: CacheJobStatus[] = [
  "queued",
  "downloading",
  "uploading",
  "completed",
  "failed",
  "cancelled"
];

const MAX_LIST_LIMIT = 200;

export type AdminRoutesDeps = {
  jobs: CacheJobStore;
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
  });
}
