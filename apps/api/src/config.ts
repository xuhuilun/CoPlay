export type AppConfig = {
  port: number;
  webOrigin: string;
  webOrigins: string[];
  cdnBaseUrl: string;
  persistenceDriver: "memory" | "prisma";
  socketAdapter: "memory" | "redis";
  rateLimitMax: number;
  rateLimitWindow: string;
  databaseUrl?: string;
  redisUrl?: string;
};

export function loadConfig(): AppConfig {
  const webOrigins = parseWebOrigins();

  return {
    port: parsePositiveInteger(process.env.API_PORT, 4000),
    webOrigin: webOrigins[0],
    webOrigins,
    cdnBaseUrl: parseUrlSetting(process.env.CDN_BASE_URL, "https://cdn.bilisync.top"),
    persistenceDriver: process.env.PERSISTENCE_DRIVER === "prisma" ? "prisma" : "memory",
    socketAdapter: process.env.SOCKET_ADAPTER === "redis" ? "redis" : "memory",
    rateLimitMax: parsePositiveInteger(process.env.RATE_LIMIT_MAX, 300),
    rateLimitWindow: parseStringSetting(process.env.RATE_LIMIT_WINDOW, "1 minute"),
    databaseUrl: parseOptionalUrlSetting(process.env.DATABASE_URL),
    redisUrl: parseOptionalUrlSetting(process.env.REDIS_URL)
  };
}

function parseWebOrigins(): string[] {
  const raw = process.env.WEB_ORIGINS ?? process.env.WEB_ORIGIN ?? "http://localhost:5173";
  const origins = raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : ["http://localhost:5173"];
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStringSetting(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  return normalized || fallback;
}

function parseUrlSetting(value: string | undefined, fallback: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  try {
    const url = new URL(normalized);
    return url.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

function parseOptionalUrlSetting(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    return new URL(normalized).toString();
  } catch {
    return undefined;
  }
}
