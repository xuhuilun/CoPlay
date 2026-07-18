export type AppConfig = {
  port: number;
  webOrigin: string;
  cdnBaseUrl: string;
};

export function loadConfig(): AppConfig {
  return {
    port: Number(process.env.API_PORT ?? 4000),
    webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
    cdnBaseUrl: process.env.CDN_BASE_URL ?? "https://cdn.bilisync.top"
  };
}
