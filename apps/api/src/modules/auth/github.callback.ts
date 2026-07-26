import type { FastifyInstance } from "fastify";
import type { AuthStateStore } from "./auth-state.store.js";
import { serializeCookie } from "./cookie.js";
import type { GithubOAuthClient } from "./github.oauth-client.js";
import type { SessionStore } from "./session.store.js";
import type { UserStore } from "./user.store.js";

export type GithubCallbackDeps = {
  stateStore: AuthStateStore;
  client: GithubOAuthClient;
  users: UserStore;
  sessions: SessionStore;
  webOrigin: string;
  sessionCookieName: string;
};

const PROVIDER = "github";

/**
 * Handles the GitHub OAuth redirect: validate the `state`, exchange the `code` for a token,
 * resolve the user, upsert the identity, open a session, set the session cookie, and redirect
 * back to the web app. Each failure mode maps to a distinct status so clients can react.
 */
export async function registerGithubCallbackRoutes(app: FastifyInstance, deps: GithubCallbackDeps) {
  app.get<{ Querystring: { code?: string; state?: string } }>(
    "/api/auth/github/callback",
    async (request, reply) => {
      const code = request.query.code?.trim();
      const state = request.query.state?.trim();
      if (!code || !state) {
        return reply.code(400).send({ error: "missing_code_or_state" });
      }

      const outcome = await deps.stateStore.consume(state);
      if (outcome === "unknown") {
        return reply.code(400).send({ error: "state_mismatch" });
      }
      if (outcome === "expired") {
        return reply.code(410).send({ error: "state_expired" });
      }

      const exchange = await deps.client.exchangeCode(code);
      if (exchange.status === "rejected") {
        return reply.code(401).send({ error: "code_rejected" });
      }
      if (exchange.status === "failed") {
        return reply.code(502).send({ error: "exchange_failed" });
      }

      const identity = await deps.client.fetchIdentity(exchange.accessToken);
      if (!identity) {
        return reply.code(502).send({ error: "identity_unavailable" });
      }

      const user = await deps.users.upsertByProvider({
        provider: PROVIDER,
        providerUserId: identity.providerUserId,
        displayName: identity.displayName,
        avatarUrl: identity.avatarUrl
      });
      const session = await deps.sessions.create(user.id);
      const maxAgeSeconds = Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000);
      reply.header("set-cookie", serializeCookie(deps.sessionCookieName, session.id, { maxAgeSeconds }));

      return reply.redirect(`${deps.webOrigin}/?login=success`);
    }
  );
}
