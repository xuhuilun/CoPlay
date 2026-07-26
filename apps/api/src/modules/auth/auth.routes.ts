import type { FastifyInstance } from "fastify";
import { parseRouteId } from "../../shared/rest-params.js";
import { AuthProviderNotConfiguredError } from "./auth.provider.js";
import type { AuthProviderRegistry } from "./auth.registry.js";

export async function registerAuthRoutes(app: FastifyInstance, registry: AuthProviderRegistry) {
  app.get("/api/auth/providers", async () => ({ items: registry.list() }));

  app.post<{ Params: { id: string } }>("/api/auth/providers/:id/start", async (request, reply) => {
    const id = parseRouteId(request.params.id, reply);
    if (!id) {
      return;
    }
    const provider = registry.find(id);
    if (!provider) {
      return reply.notFound("Auth provider not found");
    }
    try {
      return await provider.start();
    } catch (error) {
      if (error instanceof AuthProviderNotConfiguredError) {
        return reply.conflict("Auth provider is not configured");
      }
      throw error;
    }
  });
}
