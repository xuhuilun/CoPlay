import { randomUUID } from "node:crypto";
import type { PrismaClient, Session as PrismaSession } from "@prisma/client";
import type { Session, SessionStore } from "./session.store.js";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Durable {@link SessionStore} backed by Prisma/MySQL. Session ids are unguessable tokens
 * (randomUUID), not sequential defaults. Enabled with `PERSISTENCE_DRIVER=prisma` so sessions
 * survive restarts.
 */
export class PrismaSessionStore implements SessionStore {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
    private readonly now: () => number = Date.now
  ) {}

  async create(userId: string): Promise<Session> {
    const issuedAt = this.now();
    const session = await this.prisma.session.create({
      data: {
        id: randomUUID(),
        userId,
        createdAt: new Date(issuedAt),
        expiresAt: new Date(issuedAt + this.ttlMs)
      }
    });
    return toSession(session);
  }

  async find(id: string): Promise<Session | undefined> {
    const session = await this.prisma.session.findUnique({ where: { id } });
    if (!session) {
      return undefined;
    }
    if (this.now() >= session.expiresAt.getTime()) {
      // Best-effort cleanup of an expired session on access.
      await this.prisma.session.deleteMany({ where: { id } });
      return undefined;
    }
    return toSession(session);
  }

  async destroy(id: string): Promise<void> {
    await this.prisma.session.deleteMany({ where: { id } });
  }
}

export function toSession(session: PrismaSession): Session {
  return {
    id: session.id,
    userId: session.userId,
    createdAt: session.createdAt.toISOString(),
    expiresAt: session.expiresAt.toISOString()
  };
}
