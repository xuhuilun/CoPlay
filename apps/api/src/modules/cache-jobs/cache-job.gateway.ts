import type { Server } from "socket.io";
import { z } from "zod";
import type { CacheJobNotifier } from "./cache-job.notifier.js";

type SubscribePayload = {
  jobId: string;
};

const subscribePayloadSchema = z.object({
  jobId: z.string().trim().min(1).max(128)
});

export function registerCacheJobGateway(io: Server, notifier: CacheJobNotifier): () => void {
  io.on("connection", (socket) => {
    socket.on("cache-job:subscribe", (rawPayload: unknown) => {
      const payload = validateCacheJobSubscribePayload(rawPayload);
      if (!payload) {
        return;
      }
      socket.join(cacheJobRoom(payload.jobId));
    });
  });

  return notifier.onUpdate((job) => {
    io.to(cacheJobRoom(job.id)).emit("cache-job:update", job);
  });
}

export function validateCacheJobSubscribePayload(payload: unknown): SubscribePayload | undefined {
  const parsed = subscribePayloadSchema.safeParse(payload);
  return parsed.success ? parsed.data : undefined;
}

function cacheJobRoom(jobId: string): string {
  return `cache-job:${jobId}`;
}
