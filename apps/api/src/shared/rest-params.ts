import type { FastifyReply } from "fastify";
import { z } from "zod";

const routeIdSchema = z.string().trim().min(1);

export function parseRouteId(id: string, reply: FastifyReply): string | undefined {
  const parsed = routeIdSchema.safeParse(id);
  if (!parsed.success) {
    reply.badRequest("Invalid route id");
    return undefined;
  }
  return parsed.data;
}
