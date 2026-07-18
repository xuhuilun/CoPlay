export type RoomPresence = {
  members: Array<{
    guestId: string;
    nickname: string;
    role: "host" | "member";
  }>;
  onlineGuestIds: string[];
};

export type PresenceStore = {
  markOnline(roomId: string, guestId: string, socketId: string): Promise<void>;
  markOffline(socketId: string): Promise<{ roomId: string } | undefined>;
  onlineGuestIds(roomId: string): Promise<string[]>;
};
