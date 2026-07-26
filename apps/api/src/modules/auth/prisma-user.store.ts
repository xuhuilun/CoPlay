import type { PrismaClient, User as PrismaUser } from "@prisma/client";
import type { UpsertUserInput, User, UserStore } from "./user.store.js";

/**
 * Durable {@link UserStore} backed by Prisma/MySQL. Enabled with `PERSISTENCE_DRIVER=prisma`
 * so identities and ban state survive restarts; the in-memory store remains the default.
 */
export class PrismaUserStore implements UserStore {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertByProvider(input: UpsertUserInput): Promise<User> {
    const user = await this.prisma.user.upsert({
      where: {
        provider_providerUserId: { provider: input.provider, providerUserId: input.providerUserId }
      },
      // Refresh mutable profile fields on each login; never touch `banned` here.
      update: { displayName: input.displayName, avatarUrl: input.avatarUrl },
      create: {
        provider: input.provider,
        providerUserId: input.providerUserId,
        displayName: input.displayName,
        avatarUrl: input.avatarUrl
      }
    });
    return toUser(user);
  }

  async findById(id: string): Promise<User | undefined> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user ? toUser(user) : undefined;
  }

  async list(): Promise<User[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: "asc" } });
    return users.map(toUser);
  }

  async setBanned(id: string, banned: boolean): Promise<User | undefined> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return undefined;
    }
    const updated = await this.prisma.user.update({ where: { id }, data: { banned } });
    return toUser(updated);
  }
}

export function toUser(user: PrismaUser): User {
  return {
    id: user.id,
    provider: user.provider,
    providerUserId: user.providerUserId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    banned: user.banned,
    createdAt: user.createdAt.toISOString()
  };
}
