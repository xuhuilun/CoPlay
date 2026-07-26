import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { AuthProviderRegistry } from "./auth.registry.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { GithubAuthProvider } from "./github.provider.js";

test("GET /api/auth/providers lists provider availability", async () => {
  const { app } = await createAuthRoutesTestApp();

  const response = await app.inject({ method: "GET", url: "/api/auth/providers" });

  assert.equal(response.statusCode, 200);
  const items = response.json().items as Array<{ id: string; available: boolean }>;
  assert.deepEqual(
    items.map((item) => [item.id, item.available]),
    [["github", true]]
  );

  await app.close();
});

test("POST /api/auth/providers/:id/start returns an authorize url for a configured provider", async () => {
  const { app } = await createAuthRoutesTestApp();

  const response = await app.inject({ method: "POST", url: "/api/auth/providers/github/start" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().kind, "redirect");
  assert.match(response.json().url, /github\.com\/login\/oauth\/authorize/);

  await app.close();
});

test("POST /api/auth/providers/:id/start reports an unconfigured provider as conflict", async () => {
  const app = Fastify();
  // A GitHub provider without config is available:false and rejects start with 409.
  const registry = new AuthProviderRegistry([new GithubAuthProvider()]);
  await app.register(sensible);
  await registerAuthRoutes(app, registry);

  const response = await app.inject({ method: "POST", url: "/api/auth/providers/github/start" });
  assert.equal(response.statusCode, 409);

  await app.close();
});

test("POST /api/auth/providers/:id/start returns 404 for unknown providers", async () => {
  const { app } = await createAuthRoutesTestApp();

  const response = await app.inject({ method: "POST", url: "/api/auth/providers/unknown/start" });

  assert.equal(response.statusCode, 404);

  await app.close();
});

async function createAuthRoutesTestApp() {
  const app = Fastify();
  const registry = new AuthProviderRegistry([
    new GithubAuthProvider(
      { clientId: "client_123", redirectUri: "https://bilisync.top/auth/github/callback" },
      { generateState: () => "state_fixed" }
    )
  ]);
  await app.register(sensible);
  await registerAuthRoutes(app, registry);
  return { app };
}
