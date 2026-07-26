import { createId } from "../../shared/id.js";
import { defaultVideoSources, normalizeVideoSources, type Video, type VideoSource } from "./video.model.js";
import type { CacheVideoInput, VideoStore } from "./video.store.js";

// Used when a cache job produces a single rendition without an explicit source list.
const fallbackCdnUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

// Same clip encoded at two resolutions so the quality selector is demonstrable end-to-end.
const demoSources: VideoSource[] = [
  { id: "720p", label: "720P 高清", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4" },
  { id: "360p", label: "360P 流畅", url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4" }
];

type SeedVideo = Pick<CacheVideoInput, "title" | "description" | "posterUrl" | "tags" | "hotScore"> & {
  sources: VideoSource[];
};

export class VideoRepository implements VideoStore {
  private readonly videos = new Map<string, Video>();

  constructor() {
    const seeds: SeedVideo[] = [
      {
        title: "星港夜航",
        description: "适合放映厅测试的城市夜景样片。",
        posterUrl:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        tags: ["city", "night", "demo"],
        hotScore: 96,
        sources: demoSources
      },
      {
        title: "花园短片",
        description: "轻量级同步播放测试视频。",
        posterUrl:
          "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&q=80",
        tags: ["nature", "short", "demo"],
        hotScore: 91,
        sources: demoSources
      },
      {
        title: "海岸慢镜",
        description: "用于情侣房间进度同步验证。",
        posterUrl:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        tags: ["ocean", "sync", "demo"],
        hotScore: 87,
        sources: demoSources
      }
    ];
    seeds.forEach((seed) => this.addFromCache(seed));
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

  addFromCache(input: CacheVideoInput): Video {
    const sources = normalizeVideoSources(input.sources, input.sources?.[0]?.url ?? fallbackCdnUrl);
    const video: Video = {
      id: createId("vid"),
      title: input.title,
      description: input.description,
      source: "bilibili",
      sourceUrl: input.sourceUrl ?? "https://www.bilibili.com",
      cdnUrl: sources[0].url,
      posterUrl: input.posterUrl,
      durationSeconds: 30,
      cachedAt: new Date().toISOString(),
      tags: input.tags,
      hotScore: input.hotScore ?? 70,
      sources
    };
    this.videos.set(video.id, video);
    return video;
  }
}
