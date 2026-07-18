import cors from "@fastify/cors";
import sensible from "@fastify/sensible";
import Fastify from "fastify";
import { loadConfig } from "./config.js";
import { CacheJobRepository } from "./modules/cache-jobs/cache-job.repository.js";
import { registerCacheJobRoutes } from "./modules/cache-jobs/cache-job.routes.js";
import { registerRealtimeGateway } from "./modules/realtime/realtime.gateway.js";
import { RoomRepository } from "./modules/rooms/room.repository.js";
import { registerRoomRoutes } from "./modules/rooms/room.routes.js";
import { VideoRepository } from "./modules/videos/video.repository.js";
import { registerVideoRoutes } from "./modules/videos/video.routes.js";

const config = loadConfig();
const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.webOrigin,
  credentials: true
});
await app.register(sensible);

const videos = new VideoRepository();
const cacheJobs = new CacheJobRepository(videos);
const rooms = new RoomRepository();

app.get("/api/health", async () => ({
  status: "ok",
  service: "coplay-api",
  time: new Date().toISOString()
}));

await registerVideoRoutes(app, videos);
await registerCacheJobRoutes(app, cacheJobs);
await registerRoomRoutes(app, rooms, videos);

registerRealtimeGateway(app.server, rooms, config.webOrigin);

await app.listen({ port: config.port, host: "0.0.0.0" });
