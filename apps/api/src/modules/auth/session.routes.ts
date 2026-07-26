import type { FastifyInstance } from "fastify";
import { clearCookie, readCookie } from "./cookie.js";
import type { SessionStore } from "./session.store.js";
import type { User, UserStore } from "./user.store.js";

export type SessionRoutesDeps = {
  sessions: SessionStore;
  users: UserStore;
  sessionCookieName: string;
};

export type PublicUser = {
  id: string;
  provider: string;
  displayName: string;
  avatarUrl: string;
};

/**
 * Session-aware routes shared by all login providers. `/me` resolves the current user from the
 * session cookie (guests get `{ user: null }`), and `/logout` destroys the session and clears it.
 */
export async function registerSessionRoutes(app: FastifyInstance, deps: SessionRoutesDeps) {
  app.get("/api/auth/me", async (request) => {
    const sessionId = readCookie(request.headers.cookie, deps.sessionCookieName);
    if (!sessionId) {
      return { user: null };
    }
    const session = await deps.sessions.find(sessionId);
    if (!session) {
      return { user: null };
    }
    const user = await deps.users.findById(session.userId);
    return { user: user ? toPublicUser(user) : null };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const sessionId = readCookie(request.headers.cookie, deps.sessionCookieName);
    if (sessionId) {
      await deps.sessions.destroy(sessionId);
    }
    reply.header("set-cookie", clearCookie(deps.sessionCookieName));
    return { ok: true };
  });
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    provider: user.provider,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl
  };
}
