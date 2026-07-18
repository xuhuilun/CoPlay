import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import { PrismaClient } from "@prisma/client";
import Fastify from "fastify";
import { createClient } from "redis";
import { loadConfig } from "./config.js";
import { CacheJobRepository } from "./modules/cache-jobs/cache-job.repository.js";
import { registerCacheJobRoutes } from "./modules/cache-jobs/cache-job.routes.js";
import type { CacheJobStore } from "./modules/cache-jobs/cache-job.store.js";
import { PrismaCacheJobRepository } from "./modules/cache-jobs/prisma-cache-job.repository.js";
import { MemoryPresenceStore } from "./modules/realtime/memory-presence.store.js";
import type { PresenceStore } from "./modules/realtime/presence.store.js";
import { registerRealtimeGateway } from "./modules/realtime/realtime.gateway.js";
import { registerRedisSocketAdapter } from "./modules/realtime/redis-socket-adapter.js";
import { RedisPresenceStore } from "./modules/realtime/redis-presence.store.js";
import { PrismaRoomRepository } from "./modules/rooms/prisma-room.repository.js";
import { RoomRepository } from "./modules/rooms/room.repository.js";
import { registerRoomRoutes } from "./modules/rooms/room.routes.js";
import type { RoomStore } from "./modules/rooms/room.store.js";
import { PrismaVideoRepository } from "./modules/videos/prisma-video.repository.js";
import { VideoRepository } from "./modules/videos/video.repository.js";
import { registerVideoRoutes } from "./modules/videos/video.routes.js";
import type { VideoStore } from "./modules/videos/video.store.js";

const config = loadConfig();
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.webOrigin,
  credentials: true
});
await app.register(sensible);

let prisma: PrismaClient | undefined;
let videos: VideoStore;
let cacheJobs: CacheJobStore;
let rooms: RoomStore;
let presence: PresenceStore;

if (config.persistenceDriver === "prisma") {
  prisma = new PrismaClient();
  videos = new PrismaVideoRepository(prisma);
  cacheJobs = new PrismaCacheJobRepository(prisma, videos);
  rooms = new PrismaRoomRepository(prisma);
} else {
  videos = new VideoRepository();
  cacheJobs = new CacheJobRepository(videos);
  rooms = new RoomRepository();
}

if (config.socketAdapter === "redis") {
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is required when SOCKET_ADAPTER=redis");
  }
  const redisPresenceClient = createClient({ url: config.redisUrl });
  await redisPresenceClient.connect();
  presence = new RedisPresenceStore(redisPresenceClient);
  app.addHook("onClose", async () => {
    await redisPresenceClient.quit();
  });
} else {
  presence = new MemoryPresenceStore();
}

app.get("/api/health", async () => ({
  status: "ok",
  service: "coplay-api",
  time: new Date().toISOString()
}));

await registerVideoRoutes(app, videos);
await registerCacheJobRoutes(app, cacheJobs);
await registerRoomRoutes(app, rooms, videos);

const io = registerRealtimeGateway(app.server, rooms, presence, config.webOrigin);
let closeRedisSocketAdapter: (() => Promise<void>) | undefined;

if (config.socketAdapter === "redis") {
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is required when SOCKET_ADAPTER=redis");
  }
  closeRedisSocketAdapter = await registerRedisSocketAdapter(io, config.redisUrl);
  app.log.info("Socket.IO Redis adapter enabled");
}

app.addHook("onClose", async () => {
  await closeRedisSocketAdapter?.();
  await prisma?.$disconnect();
});

await app.listen({ port: config.port, host: "0.0.0.0" });
