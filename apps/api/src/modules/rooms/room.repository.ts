import { createId } from "../../shared/id.js";
import type { Room, RoomMember, RoomType } from "./room.model.js";

export class RoomRepository {
  private readonly rooms = new Map<string, Room>();

  create(input: {
    type: RoomType;
    videoId: string;
    ownerGuestId: string;
    ownerNickname: string;
    maxMembers: number;
  }): Room {
    const now = new Date().toISOString();
    const maxMembers = input.type === "couple" ? 2 : Math.max(2, Math.min(input.maxMembers, 100));
    const host: RoomMember = {
      guestId: input.ownerGuestId,
      nickname: input.ownerNickname,
      role: "host",
      joinedAt: now
    };
    const room: Room = {
      id: createId("room"),
      type: input.type,
      videoId: input.videoId,
      hostGuestId: input.ownerGuestId,
      maxMembers,
      members: [host],
      playerState: {
        videoId: input.videoId,
        currentTime: 0,
        paused: true,
        playbackRate: 1,
        updatedBy: input.ownerGuestId,
        updatedAt: now
      },
      createdAt: now
    };
    this.rooms.set(room.id, room);
    return room;
  }

  findById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  join(roomId: string, guestId: string, nickname: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }
    if (!room.members.some((member) => member.guestId === guestId)) {
      if (room.members.length >= room.maxMembers) {
        throw new Error("ROOM_FULL");
      }
      room.members.push({
        guestId,
        nickname,
        role: "member",
        joinedAt: new Date().toISOString()
      });
    }
    return room;
  }

  updatePlayerState(
    roomId: string,
    input: { guestId: string; currentTime: number; paused: boolean; playbackRate: number }
  ): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room) {
      return undefined;
    }
    const isHost = room.hostGuestId === input.guestId;
    if (room.type === "couple" || isHost) {
      room.playerState = {
        videoId: room.videoId,
        currentTime: input.currentTime,
        paused: input.paused,
        playbackRate: input.playbackRate,
        updatedBy: input.guestId,
        updatedAt: new Date().toISOString()
      };
    }
    return room;
  }

  switchVideo(roomId: string, guestId: string, videoId: string): Room | undefined {
    const room = this.rooms.get(roomId);
    if (!room || room.hostGuestId !== guestId) {
      return room;
    }
    room.videoId = videoId;
    room.playerState = {
      videoId,
      currentTime: 0,
      paused: true,
      playbackRate: 1,
      updatedBy: guestId,
      updatedAt: new Date().toISOString()
    };
    return room;
  }
}
