import type { Awaitable } from "../../shared/awaitable.js";
import type { Room, RoomType } from "./room.model.js";

export type CreateRoomInput = {
  type: RoomType;
  videoId: string;
  ownerGuestId: string;
  ownerNickname: string;
  maxMembers: number;
};

export type UpdatePlayerStateInput = {
  guestId: string;
  currentTime: number;
  paused: boolean;
  playbackRate: number;
};

export type RoomStore = {
  create(input: CreateRoomInput): Awaitable<Room>;
  findById(id: string): Awaitable<Room | undefined>;
  join(roomId: string, guestId: string, nickname: string): Awaitable<Room | undefined>;
  updatePlayerState(roomId: string, input: UpdatePlayerStateInput): Awaitable<Room | undefined>;
  switchVideo(roomId: string, guestId: string, videoId: string): Awaitable<Room | undefined>;
};
