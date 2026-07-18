export type Video = {
  id: string;
  title: string;
  description: string;
  sourceUrl: string;
  cdnUrl: string;
  posterUrl: string;
  durationSeconds: number;
  tags: string[];
  hotScore: number;
};

export type CacheJob = {
  id: string;
  sourceUrl: string;
  status: "queued" | "downloading" | "uploading" | "completed" | "failed";
  progress: number;
  message: string;
  videoId?: string;
};

export type RoomType = "couple" | "screening";

export type RoomMember = {
  guestId: string;
  nickname: string;
  role: "host" | "member";
};

export type RoomPresence = {
  members: RoomMember[];
  onlineGuestIds: string[];
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
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  hotVideos: () => request<{ items: Video[] }>("/videos/hot"),
  videos: (query = "") => request<{ items: Video[] }>(`/videos?query=${encodeURIComponent(query)}`),
  video: (id: string) => request<Video>(`/videos/${id}`),
  createCacheJob: (sourceUrl: string) =>
    request<CacheJob>("/cache-jobs", {
      method: "POST",
      body: JSON.stringify({ sourceUrl })
    }),
  cacheJob: (id: string) => request<CacheJob>(`/cache-jobs/${id}`),
  createRoom: (payload: {
    videoId: string;
    type: RoomType;
    ownerGuestId: string;
    ownerNickname: string;
    maxMembers: number;
  }) =>
    request<Room>("/rooms", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  room: (id: string) => request<Room>(`/rooms/${id}`),
  joinRoom: (id: string, payload: { guestId: string; nickname: string }) =>
    request<Room>(`/rooms/${id}/join`, {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

export const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000";
