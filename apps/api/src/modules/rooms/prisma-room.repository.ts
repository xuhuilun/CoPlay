import type { PrismaClient, Room as PrismaRoom, RoomMember as PrismaRoomMember } from "@prisma/client";
import type { PlayerState, Room, RoomMember } from "./room.model.js";
import type { CreateRoomInput, RoomStore, UpdatePlayerStateInput } from "./room.store.js";

type RoomRecord = PrismaRoom & { members: PrismaRoomMember[] };

export class PrismaRoomRepository implements RoomStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateRoomInput): Promise<Room> {
    const maxMembers = input.type === "couple" ? 2 : Math.max(2, Math.min(input.maxMembers, 100));
    const room = await this.prisma.room.create({
      data: {
        type: input.type,
        videoId: input.videoId,
        hostGuestId: input.ownerGuestId,
        maxMembers,
        stateUpdatedBy: input.ownerGuestId,
        members: {
          create: {
            guestId: input.ownerGuestId,
            nickname: input.ownerNickname,
            role: "host"
          }
        }
      },
      include: { members: true }
    });
    return toRoom(room);
  }

  async findById(id: string): Promise<Room | undefined> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: { members: true }
    });
    return room ? toRoom(room) : undefined;
  }

  async join(roomId: string, guestId: string, nickname: string): Promise<Room | undefined> {
    const room = await this.findById(roomId);
    if (!room) {
      return undefined;
    }
    const existingMember = room.members.find((member) => member.guestId === guestId);
    if (existingMember) {
      await this.prisma.roomMember.update({
        where: {
          roomId_guestId: {
            roomId,
            guestId
          }
        },
        data: { nickname }
      });
    } else {
      if (room.members.length >= room.maxMembers) {
        throw new Error("ROOM_FULL");
      }
      await this.prisma.roomMember.create({
        data: {
          roomId,
          guestId,
          nickname,
          role: "member"
        }
      });
    }
    return this.findById(roomId);
  }

  async updatePlayerState(roomId: string, input: UpdatePlayerStateInput): Promise<Room | undefined> {
    const room = await this.findById(roomId);
    if (!room) {
      return undefined;
    }
    const isHost = room.hostGuestId === input.guestId;
    if (room.type !== "couple" && !isHost) {
      return room;
    }
    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        currentTime: input.currentTime,
        paused: input.paused,
        playbackRate: input.playbackRate,
        stateUpdatedBy: input.guestId,
        stateUpdatedAt: new Date()
      },
      include: { members: true }
    });
    return toRoom(updated);
  }

  async switchVideo(roomId: string, guestId: string, videoId: string): Promise<Room | undefined> {
    const room = await this.findById(roomId);
    if (!room || room.hostGuestId !== guestId) {
      return room;
    }
    const updated = await this.prisma.room.update({
      where: { id: roomId },
      data: {
        videoId,
        currentTime: 0,
        paused: true,
        playbackRate: 1,
        stateUpdatedBy: guestId,
        stateUpdatedAt: new Date()
      },
      include: { members: true }
    });
    return toRoom(updated);
  }
}

function toRoom(room: RoomRecord): Room {
  return {
    id: room.id,
    type: room.type,
    videoId: room.videoId,
    hostGuestId: room.hostGuestId,
    maxMembers: room.maxMembers,
    members: room.members.map(toMember),
    playerState: toPlayerState(room),
    createdAt: room.createdAt.toISOString()
  };
}

function toMember(member: PrismaRoomMember): RoomMember {
  return {
    guestId: member.guestId,
    nickname: member.nickname,
    role: member.role,
    joinedAt: member.joinedAt.toISOString()
  };
}

function toPlayerState(room: PrismaRoom): PlayerState {
  return {
    videoId: room.videoId,
    currentTime: room.currentTime,
    paused: room.paused,
    playbackRate: room.playbackRate,
    updatedBy: room.stateUpdatedBy,
    updatedAt: room.stateUpdatedAt.toISOString()
  };
}
