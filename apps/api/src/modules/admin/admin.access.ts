import type { FastifyReply, FastifyRequest } from "fastify";
import { readCookie } from "../auth/cookie.js";
import type { SessionStore } from "../auth/session.store.js";
import type { User, UserStore } from "../auth/user.store.js";

export type AdminAccess = {
  sessions: SessionStore;
  users: UserStore;
  sessionCookieName: string;
  /** GitHub provider user ids allowed to use the admin backend. */
  adminGithubIds: string[];
};

/** Admin membership is a simple allowlist of GitHub ids — no separate admin account system. */
export function isAdminUser(user: User, adminGithubIds: string[]): boolean {
  return user.provider === "github" && adminGithubIds.includes(user.providerUserId);
}

/**
 * Resolves the current admin user from the session cookie, or sends the appropriate error:
 * 401 when there is no valid session, 403 when the user is not on the admin allowlist.
 * Returns undefined (and a sent reply) in both failure cases.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
  access: AdminAccess
): Promise<User | undefined> {
  const sessionId = readCookie(request.headers.cookie, access.sessionCookieName);
  const session = sessionId ? await access.sessions.find(sessionId) : undefined;
  const user = session ? await access.users.findById(session.userId) : undefined;
  if (!user) {
    await reply.code(401).send({ error: "unauthenticated" });
    return undefined;
  }
  if (!isAdminUser(user, access.adminGithubIds)) {
    await reply.code(403).send({ error: "forbidden" });
    return undefined;
  }
  return user;
}
