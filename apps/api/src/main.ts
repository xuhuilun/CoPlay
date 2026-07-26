import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { PrismaClient } from "@prisma/client";
import Fastify, { type FastifyRequest } from "fastify";
import crypto from "node:crypto";
import { createClient } from "redis";
import { loadConfig } from "./config.js";
import { MemoryAuthStateStore } from "./modules/auth/auth-state.store.js";
import { AuthProviderRegistry } from "./modules/auth/auth.registry.js";
import { registerAuthRoutes } from "./modules/auth/auth.routes.js";
import { registerGithubCallbackRoutes } from "./modules/auth/github.callback.js";
import { HttpGithubOAuthClient } from "./modules/auth/github.oauth-client.js";
import { GithubAuthProvider } from "./modules/auth/github.provider.js";
import { registerAdminRoutes } from "./modules/admin/admin.routes.js";
import { readCookie } from "./modules/auth/cookie.js";
import { registerSessionRoutes } from "./modules/auth/session.routes.js";
import { MemorySessionStore } from "./modules/auth/session.store.js";
import { MemoryUserStore } from "./modules/auth/user.store.js";
import { registerCacheJobGateway } from "./modules/cache-jobs/cache-job.gateway.js";
import { CacheJobNotifier } from "./modules/cache-jobs/cache-job.notifier.js";
import { CacheJobRepository } from "./modules/cache-jobs/cache-job.repository.js";
import { registerCacheJobRoutes } from "./modules/cache-jobs/cache-job.routes.js";
import type { CacheJobStore } from "./modules/cache-jobs/cache-job.store.js";
import { AliOssClient } from "./modules/cache-jobs/ali-oss.client.js";
import type { BilibiliDownloader, CdnUploader } from "./modules/cache-jobs/cache-pipeline.js";
import { SpawnCommandRunner } from "./modules/cache-jobs/command-runner.js";
import { OssCdnUploader } from "./modules/cache-jobs/oss-cdn.uploader.js";
import { YtDlpBilibiliDownloader } from "./modules/cache-jobs/ytdlp.downloader.js";
import { registerHealthRoutes } from "./modules/health/health.routes.js";
import { PrismaCacheJobRepository } from "./modules/cache-jobs/prisma-cache-job.repository.js";
import { MemoryPresenceStore } from "./modules/realtime/memory-presence.store.js";
import type { PresenceStore } from "./modules/realtime/presence.store.js";
import { registerRealtimeGateway } from "./modules/realtime/realtime.gateway.js";
import { registerRedisSocketAdapter } from "./modules/realtime/redis-socket-adapter.js";
import { RedisPresenceStore, type RedisPresenceClient } from "./modules/realtime/redis-presence.store.js";
import { PrismaRoomRepository } from "./modules/rooms/prisma-room.repository.js";
import { RoomRepository } from "./modules/rooms/room.repository.js";
import { registerRoomRoutes } from "./modules/rooms/room.routes.js";
import type { RoomStore } from "./modules/rooms/room.store.js";
import { PrismaVideoRepository } from "./modules/videos/prisma-video.repository.js";
import { VideoRepository } from "./modules/videos/video.repository.js";
import { registerVideoRoutes } from "./modules/videos/video.routes.js";
import type { VideoStore } from "./modules/videos/video.store.js";

const config = loadConfig();
const app = Fastify({
  logger: true,
  // Behind the Nginx reverse proxy, read the real client IP from X-Forwarded-For so
  // per-submitter quota accounting is not defeated by everyone sharing the proxy address.
  trustProxy: true,
  requestIdHeader: "x-request-id",
  genReqId: () => crypto.randomUUID()
});

await app.register(cors, {
  origin: config.webOrigins,
  credentials: true
});
await app.register(helmet, {
  contentSecurityPolicy: false
});
await app.register(rateLimit, {
  max: config.rateLimitMax,
  timeWindow: config.rateLimitWindow
});
await app.register(sensible);

app.addHook("onRequest", async (request, reply) => {
  reply.header("x-request-id", request.id);
});

let prisma: PrismaClient | undefined;
let videos: VideoStore;
let cacheJobs: CacheJobStore;
let rooms: RoomStore;
let presence: PresenceStore;
let redisPresenceClient: { ping(): Promise<string> } | undefined;
const cacheJobNotifier = new CacheJobNotifier();

const cacheDownloader: BilibiliDownloader | undefined =
  config.cacheDownloader === "ytdlp"
    ? new YtDlpBilibiliDownloader(new SpawnCommandRunner(), { binaryPath: config.ytdlpBinary })
    : undefined;
const cacheUploader: CdnUploader | undefined = config.ossUpload
  ? new OssCdnUploader(
      new AliOssClient({
        accessKeyId: config.ossUpload.accessKeyId,
        accessKeySecret: config.ossUpload.accessKeySecret,
        bucket: config.ossUpload.bucket,
        region: config.ossUpload.region,
        internal: config.ossUpload.internal,
        endpoint: config.ossUpload.endpoint
      }),
      {
        bucket: config.ossUpload.bucket,
        region: config.ossUpload.region,
        internal: config.ossUpload.internal,
        cdnBaseUrl: config.cdnBaseUrl
      }
    )
  : undefined;
const cachePipeline = {
  downloader: cacheDownloader,
  uploader: cacheUploader,
  logger: app.log,
  dailyQuota: config.cacheJobDailyQuota
};

if (config.persistenceDriver === "prisma") {
  prisma = new PrismaClient();
  videos = new PrismaVideoRepository(prisma);
  cacheJobs = new PrismaCacheJobRepository(prisma, videos, cacheJobNotifier, cachePipeline);
  rooms = new PrismaRoomRepository(prisma);
} else {
  videos = new VideoRepository();
  cacheJobs = new CacheJobRepository(videos, cacheJobNotifier, cachePipeline);
  rooms = new RoomRepository();
}

if (config.socketAdapter === "redis") {
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is required when SOCKET_ADAPTER=redis");
  }
  const client = createClient({ url: config.redisUrl });
  await client.connect();
  redisPresenceClient = client;
  presence = new RedisPresenceStore(client as unknown as RedisPresenceClient);
  app.addHook("onClose", async () => {
    await client.quit();
  });
} else {
  presence = new MemoryPresenceStore();
}

await registerHealthRoutes(app, {
  config,
  getPrisma: () => prisma,
  getRedisClient: () => redisPresenceClient
});

const SESSION_COOKIE = "coplay_session";
const authStateStore = new MemoryAuthStateStore();
const users = new MemoryUserStore();
const sessions = new MemorySessionStore();

// Login is GitHub-only. WeChat/QQ QR sign-in was cut: 微信 网站应用 requires a company
// entity, which an individual developer cannot obtain. The AuthProvider seam remains, so a
// future QR provider can be added without touching the rest of the app.
const authRegistry = new AuthProviderRegistry([
  new GithubAuthProvider(config.githubOAuth, { stateStore: authStateStore })
]);

// Quota accounting keys by the authenticated user when a session exists, else the client IP.
const resolveSubmitter = async (request: FastifyRequest): Promise<string> => {
  const sessionId = readCookie(request.headers.cookie, SESSION_COOKIE);
  if (sessionId) {
    const session = await sessions.find(sessionId);
    if (session) {
      return `user:${session.userId}`;
    }
  }
  return `ip:${request.ip}`;
};

await registerVideoRoutes(app, videos);
await registerCacheJobRoutes(app, cacheJobs, { resolveSubmitter });
await registerRoomRoutes(app, rooms, videos);
await registerAuthRoutes(app, authRegistry);
await registerSessionRoutes(app, { sessions, users, sessionCookieName: SESSION_COOKIE });
await registerAdminRoutes(app, {
  jobs: cacheJobs,
  videos,
  access: {
    sessions,
    users,
    sessionCookieName: SESSION_COOKIE,
    adminGithubIds: config.adminGithubIds
  }
});

if (config.githubOAuth) {
  const githubClient = new HttpGithubOAuthClient({
    clientId: config.githubOAuth.clientId,
    clientSecret: config.githubOAuth.clientSecret ?? "",
    redirectUri: config.githubOAuth.redirectUri
  });
  await registerGithubCallbackRoutes(app, {
    stateStore: authStateStore,
    client: githubClient,
    users,
    sessions,
    webOrigin: config.webOrigin,
    sessionCookieName: SESSION_COOKIE
  });
}

const io = registerRealtimeGateway(app.server, rooms, presence, config.webOrigins);
const unregisterCacheJobGateway = registerCacheJobGateway(io, cacheJobNotifier);
let closeRedisSocketAdapter: (() => Promise<void>) | undefined;

if (config.socketAdapter === "redis") {
  if (!config.redisUrl) {
    throw new Error("REDIS_URL is required when SOCKET_ADAPTER=redis");
  }
  closeRedisSocketAdapter = await registerRedisSocketAdapter(io, config.redisUrl);
  app.log.info("Socket.IO Redis adapter enabled");
}

app.addHook("onClose", async () => {
  unregisterCacheJobGateway();
  await closeRedisSocketAdapter?.();
  await prisma?.$disconnect();
});

await app.listen({ port: config.port, host: "0.0.0.0" });
