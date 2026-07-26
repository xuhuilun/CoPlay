import { createId } from "../../shared/id.js";
import type { Awaitable } from "../../shared/awaitable.js";

export type User = {
  id: string;
  provider: string;
  providerUserId: string;
  displayName: string;
  avatarUrl: string;
  banned: boolean;
  createdAt: string;
};

export type UpsertUserInput = {
  provider: string;
  providerUserId: string;
  displayName: string;
  avatarUrl: string;
};

/** Persists identities linked to an external provider. */
export interface UserStore {
  upsertByProvider(input: UpsertUserInput): Awaitable<User>;
  findById(id: string): Awaitable<User | undefined>;
  list(): Awaitable<User[]>;
  setBanned(id: string, banned: boolean): Awaitable<User | undefined>;
}

export class MemoryUserStore implements UserStore {
  private readonly usersById = new Map<string, User>();
  private readonly idByProvider = new Map<string, string>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  upsertByProvider(input: UpsertUserInput): User {
    const key = providerKey(input.provider, input.providerUserId);
    const existingId = this.idByProvider.get(key);
    if (existingId) {
      const existing = this.usersById.get(existingId);
      if (existing) {
        // Refresh the mutable profile fields on each login, preserving the ban flag.
        const updated: User = { ...existing, displayName: input.displayName, avatarUrl: input.avatarUrl };
        this.usersById.set(existing.id, updated);
        return updated;
      }
    }
    const user: User = {
      id: createId("usr"),
      provider: input.provider,
      providerUserId: input.providerUserId,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      banned: false,
      createdAt: this.clock()
    };
    this.usersById.set(user.id, user);
    this.idByProvider.set(key, user.id);
    return user;
  }

  findById(id: string): User | undefined {
    return this.usersById.get(id);
  }

  list(): User[] {
    return [...this.usersById.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  setBanned(id: string, banned: boolean): User | undefined {
    const user = this.usersById.get(id);
    if (!user) {
      return undefined;
    }
    const updated: User = { ...user, banned };
    this.usersById.set(id, updated);
    return updated;
  }
}

function providerKey(provider: string, providerUserId: string): string {
  return `${provider}:${providerUserId}`;
}
