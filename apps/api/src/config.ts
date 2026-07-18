export type AppConfig = {
  port: number;
  webOrigin: string;
  cdnBaseUrl: string;
  persistenceDriver: "memory" | "prisma";
  socketAdapter: "memory" | "redis";
  rateLimitMax: number;
  rateLimitWindow: string;
  databaseUrl?: string;
  redisUrl?: string;
};

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.API_PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    cdnBaseUrl: process.env.CDN_BASE_URL ?? "https://cdn.bilisync.top",
    persistenceDriver: process.env.PERSISTENCE_DRIVER === "prisma" ? "prisma" : "memory",
    socketAdapter: process.env.SOCKET_ADAPTER === "redis" ? "redis" : "memory",
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 300),
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW ?? "1 minute",
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL
  };
}
