export type RoomType = "couple" | "screening";

export type RoomMember = {
  guestId: string;
  nickname: string;
  role: "host" | "member";
  joinedAt: string;
};

export type PlayerState = {
  videoId: string;
  currentTime: number;
  paused: boolean;
  playbackRate: number;
  updatedBy: string;
  updatedAt: string;
};

export type Room = {
  id: string;
  type: RoomType;
  videoId: string;
  hostGuestId: string;
  maxMembers: number;
  members: RoomMember[];
  playerState: PlayerState;
  createdAt: string;
};
