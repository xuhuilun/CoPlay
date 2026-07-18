import type { PresenceStore } from "./presence.store.js";

export class MemoryPresenceStore implements PresenceStore {
  private readonly sockets = new Map<string, { roomId: string; guestId: string }>();
  private readonly guestsByRoom = new Map<string, Map<string, number>>();

  async markOnline(roomId: string, guestId: string, socketId: string): Promise<void> {
    this.sockets.set(socketId, { roomId, guestId });
    const guests = this.guestsByRoom.get(roomId) ?? new Map<string, number>();
    guests.set(guestId, (guests.get(guestId) ?? 0) + 1);
    this.guestsByRoom.set(roomId, guests);
  }

  async markOffline(socketId: string): Promise<{ roomId: string } | undefined> {
    const socket = this.sockets.get(socketId);
    if (!socket) {
      return undefined;
    }
    this.sockets.delete(socketId);
    const guests = this.guestsByRoom.get(socket.roomId);
    if (!guests) {
      return { roomId: socket.roomId };
    }
    const nextCount = (guests.get(socket.guestId) ?? 1) - 1;
    if (nextCount <= 0) {
      guests.delete(socket.guestId);
    } else {
      guests.set(socket.guestId, nextCount);
    }
    if (guests.size === 0) {
      this.guestsByRoom.delete(socket.roomId);
    }
    return { roomId: socket.roomId };
  }

  async onlineGuestIds(roomId: string): Promise<string[]> {
    return [...(this.guestsByRoom.get(roomId)?.keys() ?? [])];
  }
}
