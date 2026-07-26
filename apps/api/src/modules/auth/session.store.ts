import { randomUUID } from "node:crypto";
import type { Awaitable } from "../../shared/awaitable.js";

export type Session = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

/** Stores opaque session tokens issued after a successful login. */
export interface SessionStore {
  create(userId: string): Awaitable<Session>;
  /** Returns the session only when it exists and has not expired. */
  find(id: string): Awaitable<Session | undefined>;
  destroy(id: string): Awaitable<void>;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  create(userId: string): Session {
    const issuedAt = this.now();
    const session: Session = {
      // Unguessable token; not derived from the user so it cannot be forged from a known id.
      id: randomUUID(),
      userId,
      createdAt: new Date(issuedAt).toISOString(),
      expiresAt: new Date(issuedAt + this.ttlMs).toISOString()
    };
    this.sessions.set(session.id, session);
    return session;
  }

  find(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) {
      return undefined;
    }
    if (this.now() >= Date.parse(session.expiresAt)) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  destroy(id: string): void {
    this.sessions.delete(id);
  }
}
