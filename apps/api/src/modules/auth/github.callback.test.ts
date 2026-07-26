import sensible from "@fastify/sensible";
import assert from "node:assert/strict";
import test from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import { MemoryAuthStateStore } from "./auth-state.store.js";
import { registerGithubCallbackRoutes } from "./github.callback.js";
import type { ExchangeResult, GithubIdentity, GithubOAuthClient } from "./github.oauth-client.js";
import { registerSessionRoutes } from "./session.routes.js";
import { MemorySessionStore } from "./session.store.js";
import { MemoryUserStore } from "./user.store.js";

const SESSION_COOKIE = "coplay_session";
const WEB_ORIGIN = "https://bilisync.top";

const OCTOCAT: GithubIdentity = {
  providerUserId: "42",
  login: "octocat",
  displayName: "The Octocat",
  avatarUrl: "https://a/1.png"
};

class FakeGithubOAuthClient implements GithubOAuthClient {
  private readonly identity: GithubIdentity | undefined;

  constructor(
    private readonly exchangeResult: ExchangeResult,
    identity: GithubIdentity | undefined = OCTOCAT,
    private readonly identityProvided = true
  ) {
    this.identity = identityProvided ? identity : undefined;
  }

  static withoutIdentity(exchangeResult: ExchangeResult): FakeGithubOAuthClient {
    return new FakeGithubOAuthClient(exchangeResult, undefined, false);
  }

  async exchangeCode(): Promise<ExchangeResult> {
    return this.exchangeResult;
  }

  async fetchIdentity(): Promise<GithubIdentity | undefined> {
    return this.identity;
  }
}

test("callback rejects a missing code or state", async () => {
  const { app } = createApp({ client: new FakeGithubOAuthClient({ status: "success", accessToken: "t" }) });

  const response = await app.inject({ method: "GET", url: "/api/auth/github/callback?code=only_code" });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "missing_code_or_state");

  await app.close();
});

test("callback rejects an unknown state as a mismatch", async () => {
  const { app } = createApp({ client: new FakeGithubOAuthClient({ status: "success", accessToken: "t" }) });

  const response = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=c&state=never_issued"
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "state_mismatch");

  await app.close();
});

test("callback rejects an expired state", async () => {
  const clock = { value: 1000 };
  const stateStore = new MemoryAuthStateStore(5000, () => clock.value);
  stateStore.issue("state_exp");
  const { app } = createApp({
    client: new FakeGithubOAuthClient({ status: "success", accessToken: "t" }),
    stateStore
  });

  clock.value = 7000; // past the 5000ms TTL
  const response = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=c&state=state_exp"
  });
  assert.equal(response.statusCode, 410);
  assert.equal(response.json().error, "state_expired");

  await app.close();
});

test("callback returns 401 when github rejects the code", async () => {
  const { app, stateStore } = createApp({ client: new FakeGithubOAuthClient({ status: "rejected" }) });
  stateStore.issue("state_ok");

  const response = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=bad&state=state_ok"
  });
  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "code_rejected");

  await app.close();
});

test("callback returns 502 when the exchange fails", async () => {
  const { app, stateStore } = createApp({ client: new FakeGithubOAuthClient({ status: "failed" }) });
  stateStore.issue("state_ok");

  const response = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=c&state=state_ok"
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "exchange_failed");

  await app.close();
});

test("callback returns 502 when identity cannot be resolved", async () => {
  const { app, stateStore } = createApp({
    client: FakeGithubOAuthClient.withoutIdentity({ status: "success", accessToken: "t" })
  });
  stateStore.issue("state_ok");

  const response = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=c&state=state_ok"
  });
  assert.equal(response.statusCode, 502);
  assert.equal(response.json().error, "identity_unavailable");

  await app.close();
});

test("callback establishes a session and the user resolves via /me then /logout", async () => {
  const { app, stateStore, users, sessions } = createApp({
    client: new FakeGithubOAuthClient({ status: "success", accessToken: "t" })
  });
  stateStore.issue("state_ok");

  const callback = await app.inject({
    method: "GET",
    url: "/api/auth/github/callback?code=good&state=state_ok"
  });
  assert.equal(callback.statusCode, 302);
  assert.equal(callback.headers.location, `${WEB_ORIGIN}/?login=success`);

  const setCookie = firstSetCookie(callback.headers["set-cookie"]);
  assert.match(setCookie, /coplay_session=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);

  const sessionValue = setCookie.split(";")[0].split("=")[1];
  assert.ok(sessionValue.length > 0);
  assert.ok(sessions.find(sessionValue));

  // The identity was upserted.
  assert.equal(users.findById(sessions.find(sessionValue)!.userId)?.displayName, "The Octocat");

  const me = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: `${SESSION_COOKIE}=${sessionValue}` }
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().user.displayName, "The Octocat");
  assert.equal(me.json().user.provider, "github");

  const logout = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: { cookie: `${SESSION_COOKIE}=${sessionValue}` }
  });
  assert.equal(logout.statusCode, 200);
  assert.match(firstSetCookie(logout.headers["set-cookie"]), /Max-Age=0/);

  const afterLogout = await app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { cookie: `${SESSION_COOKIE}=${sessionValue}` }
  });
  assert.equal(afterLogout.json().user, null);

  await app.close();
});

function createApp(options: {
  client: GithubOAuthClient;
  stateStore?: MemoryAuthStateStore;
}): {
  app: FastifyInstance;
  stateStore: MemoryAuthStateStore;
  users: MemoryUserStore;
  sessions: MemorySessionStore;
} {
  const app = Fastify();
  const stateStore = options.stateStore ?? new MemoryAuthStateStore();
  const users = new MemoryUserStore();
  const sessions = new MemorySessionStore();
  app.register(sensible);
  app.register(async (instance) => {
    await registerGithubCallbackRoutes(instance, {
      stateStore,
      client: options.client,
      users,
      sessions,
      webOrigin: WEB_ORIGIN,
      sessionCookieName: SESSION_COOKIE
    });
    await registerSessionRoutes(instance, { sessions, users, sessionCookieName: SESSION_COOKIE });
  });
  return { app, stateStore, users, sessions };
}

function firstSetCookie(header: string | string[] | undefined): string {
  if (Array.isArray(header)) {
    return header[0] ?? "";
  }
  return header ?? "";
}
