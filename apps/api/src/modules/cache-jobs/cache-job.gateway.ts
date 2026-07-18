import type { Server } from "socket.io";
import type { CacheJobNotifier } from "./cache-job.notifier.js";

type SubscribePayload = {
  jobId: string;
};

export function registerCacheJobGateway(io: Server, notifier: CacheJobNotifier): () => void {
  io.on("connection", (socket) => {
    socket.on("cache-job:subscribe", (payload: SubscribePayload) => {
      if (!payload.jobId) {
        return;
      }
      socket.join(cacheJobRoom(payload.jobId));
    });
  });

  return notifier.onUpdate((job) => {
    io.to(cacheJobRoom(job.id)).emit("cache-job:update", job);
  });
}

function cacheJobRoom(jobId: string): string {
  return `cache-job:${jobId}`;
}
