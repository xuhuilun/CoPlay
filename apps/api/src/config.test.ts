import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.js";

test("loadConfig uses WEB_ORIGINS as a comma separated CORS allowlist", () => {
  withEnv(
    {
      WEB_ORIGIN: "http://localhost:5173",
      WEB_ORIGINS: "http://localhost:5173, http://127.0.0.1:5175"
    },
    () => {
      const config = loadConfig();

      assert.equal(config.webOrigin, "http://localhost:5173");
      assert.deepEqual(config.webOrigins, ["http://localhost:5173", "http://127.0.0.1:5175"]);
    }
  );
});

test("loadConfig keeps WEB_ORIGIN compatibility when WEB_ORIGINS is absent", () => {
  withEnv({ WEB_ORIGIN: "https://bilisync.top", WEB_ORIGINS: undefined }, () => {
    const config = loadConfig();

    assert.equal(config.webOrigin, "https://bilisync.top");
    assert.deepEqual(config.webOrigins, ["https://bilisync.top"]);
  });
});

test("loadConfig falls back to the local web origin when origins are empty", () => {
  withEnv({ WEB_ORIGIN: undefined, WEB_ORIGINS: " , " }, () => {
    const config = loadConfig();

    assert.equal(config.webOrigin, "http://localhost:5173");
    assert.deepEqual(config.webOrigins, ["http://localhost:5173"]);
  });
});

test("loadConfig parses valid positive integer settings", () => {
  withEnv({ API_PORT: "4100", RATE_LIMIT_MAX: "120" }, () => {
    const config = loadConfig();

    assert.equal(config.port, 4100);
    assert.equal(config.rateLimitMax, 120);
  });
});

test("loadConfig normalizes string settings", () => {
  withEnv({ RATE_LIMIT_WINDOW: " 30 seconds " }, () => {
    const config = loadConfig();

    assert.equal(config.rateLimitWindow, "30 seconds");
  });
});

test("loadConfig falls back when string settings are blank", () => {
  withEnv({ RATE_LIMIT_WINDOW: "   " }, () => {
    const config = loadConfig();

    assert.equal(config.rateLimitWindow, "1 minute");
  });
});

test("loadConfig normalizes enum settings", () => {
  withEnv({ PERSISTENCE_DRIVER: " prisma ", SOCKET_ADAPTER: " redis " }, () => {
    const config = loadConfig();

    assert.equal(config.persistenceDriver, "prisma");
    assert.equal(config.socketAdapter, "redis");
  });
});

test("loadConfig falls back when enum settings are unknown", () => {
  withEnv({ PERSISTENCE_DRIVER: "postgres", SOCKET_ADAPTER: "nats" }, () => {
    const config = loadConfig();

    assert.equal(config.persistenceDriver, "memory");
    assert.equal(config.socketAdapter, "memory");
  });
});

test("loadConfig normalizes CDN base URLs", () => {
  withEnv({ CDN_BASE_URL: " https://cdn.example.com/assets/ " }, () => {
    const config = loadConfig();

    assert.equal(config.cdnBaseUrl, "https://cdn.example.com/assets");
  });
});

test("loadConfig falls back when CDN base URLs are invalid", () => {
  withEnv({ CDN_BASE_URL: "not-a-url" }, () => {
    const config = loadConfig();

    assert.equal(config.cdnBaseUrl, "https://cdn.bilisync.top");
  });
});

test("loadConfig normalizes optional dependency URLs", () => {
  withEnv(
    {
      DATABASE_URL: " mysql://coplay:password@mysql:3306/coplay ",
      REDIS_URL: " redis://redis:6379 "
    },
    () => {
      const config = loadConfig();

      assert.equal(config.databaseUrl, "mysql://coplay:password@mysql:3306/coplay");
      assert.equal(config.redisUrl, "redis://redis:6379");
    }
  );
});

test("loadConfig drops invalid optional dependency URLs", () => {
  withEnv({ DATABASE_URL: "not-a-url", REDIS_URL: " " }, () => {
    const config = loadConfig();

    assert.equal(config.databaseUrl, undefined);
    assert.equal(config.redisUrl, undefined);
  });
});

test("loadConfig falls back when positive integer settings are invalid", () => {
  withEnv({ API_PORT: "not-a-port", RATE_LIMIT_MAX: "-1" }, () => {
    const config = loadConfig();

    assert.equal(config.port, 4000);
    assert.equal(config.rateLimitMax, 300);
  });
});

function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(values)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    run();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}
