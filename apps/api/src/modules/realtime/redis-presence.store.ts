import type { PresenceStore } from "./presence.store.js";

const ttlSeconds = 60 * 60 * 12;

type RedisPresenceTransaction = {
  hSet(key: string, value: Record<string, string>): RedisPresenceTransaction;
  expire(key: string, seconds: number): RedisPresenceTransaction;
  sAdd(key: string, value: string): RedisPresenceTransaction;
  sRem(key: string, value: string): RedisPresenceTransaction;
  del(key: string): RedisPresenceTransaction;
  exec(): Promise<unknown>;
};

export type RedisPresenceClient = {
  multi(): RedisPresenceTransaction;
  hGetAll(key: string): Promise<Record<string, string>>;
  sRem(key: string, value: string): Promise<number>;
  sCard(key: string): Promise<number>;
  sMembers(key: string): Promise<string[]>;
};

export class RedisPresenceStore implements PresenceStore {
  constructor(private readonly redis: RedisPresenceClient) {}

  async markOnline(roomId: string, guestId: string, socketId: string): Promise<void> {
    const socketKey = socketPresenceKey(socketId);
    const guestSocketsKey = guestSocketsPresenceKey(roomId, guestId);
    await this.redis
      .multi()
      .hSet(socketKey, { roomId, guestId })
      .expire(socketKey, ttlSeconds)
      .sAdd(roomGuestsPresenceKey(roomId), guestId)
      .expire(roomGuestsPresenceKey(roomId), ttlSeconds)
      .sAdd(guestSocketsKey, socketId)
      .expire(guestSocketsKey, ttlSeconds)
      .exec();
  }

  async markOffline(socketId: string): Promise<{ roomId: string } | undefined> {
    const socket = await this.redis.hGetAll(socketPresenceKey(socketId));
    if (!socket.roomId || !socket.guestId) {
      return undefined;
    }
    const guestSocketsKey = guestSocketsPresenceKey(socket.roomId, socket.guestId);
    await this.redis.sRem(guestSocketsKey, socketId);
    const remainingSockets = await this.redis.sCard(guestSocketsKey);
    const transaction = this.redis.multi().del(socketPresenceKey(socketId));
    if (remainingSockets === 0) {
      transaction.del(guestSocketsKey).sRem(roomGuestsPresenceKey(socket.roomId), socket.guestId);
    }
    await transaction.exec();
    return { roomId: socket.roomId };
  }

  async onlineGuestIds(roomId: string): Promise<string[]> {
    return this.redis.sMembers(roomGuestsPresenceKey(roomId));
  }
}

function socketPresenceKey(socketId: string): string {
  return `presence:socket:${socketId}`;
}

function roomGuestsPresenceKey(roomId: string): string {
  return `presence:room:${roomId}:guests`;
}

function guestSocketsPresenceKey(roomId: string, guestId: string): string {
  return `presence:room:${roomId}:guest:${guestId}:sockets`;
}
