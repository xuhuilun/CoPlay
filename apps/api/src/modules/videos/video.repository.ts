import { createId } from "../../shared/id.js";
import type { Video } from "./video.model.js";

const sampleVideoUrl =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export class VideoRepository {
  private readonly videos = new Map<string, Video>();

  constructor() {
    [
      {
        title: "星港夜航",
        description: "适合放映厅测试的城市夜景样片。",
        posterUrl:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        tags: ["city", "night", "demo"],
        hotScore: 96
      },
      {
        title: "花园短片",
        description: "轻量级同步播放测试视频。",
        posterUrl:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80",
        tags: ["nature", "short", "demo"],
        hotScore: 91
      },
      {
        title: "海岸慢镜",
        description: "用于情侣房间进度同步验证。",
        posterUrl:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        tags: ["ocean", "sync", "demo"],
        hotScore: 87
      }
    ].forEach((video) => this.addFromCache(video));
  }

  list(query?: string): Video[] {
    const normalized = query?.trim().toLowerCase();
    const videos = [...this.videos.values()];
    if (!normalized) {
      return videos;
    }
    return videos.filter((video) => {
      const haystack = `${video.title} ${video.description} ${video.tags.join(" ")}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }

  hot(): Video[] {
    return [...this.videos.values()].sort((a, b) => b.hotScore - a.hotScore).slice(0, 8);
  }

  findById(id: string): Video | undefined {
    return this.videos.get(id);
  }

  addFromCache(input: {
    title: string;
    description: string;
    posterUrl: string;
    tags: string[];
    hotScore?: number;
    sourceUrl?: string;
  }): Video {
    const video: Video = {
      id: createId("vid"),
      title: input.title,
      description: input.description,
      source: "bilibili",
      sourceUrl: input.sourceUrl ?? "https://www.bilibili.com",
      cdnUrl: sampleVideoUrl,
      posterUrl: input.posterUrl,
      durationSeconds: 30,
      cachedAt: new Date().toISOString(),
      tags: input.tags,
      hotScore: input.hotScore ?? 70
    };
    this.videos.set(video.id, video);
    return video;
  }
}
