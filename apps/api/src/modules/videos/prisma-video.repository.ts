import type { PrismaClient, Video as PrismaVideo } from "@prisma/client";
import type { Video } from "./video.model.js";
import type { CacheVideoInput, VideoStore } from "./video.store.js";

const sampleVideoUrl =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export class PrismaVideoRepository implements VideoStore {
  constructor(private readonly prisma: PrismaClient) {}

  async list(query?: string): Promise<Video[]> {
    const normalized = query?.trim();
    const videos = await this.prisma.video.findMany({
      where: normalized
        ? {
            OR: [
              { title: { contains: normalized } },
              { description: { contains: normalized } }
            ]
          }
        : undefined,
      orderBy: { cachedAt: "desc" }
    });
    return videos.map(toVideo);
  }

  async hot(): Promise<Video[]> {
    const videos = await this.prisma.video.findMany({
      orderBy: { hotScore: "desc" },
      take: 8
    });
    return videos.map(toVideo);
  }

  async findById(id: string): Promise<Video | undefined> {
    const video = await this.prisma.video.findUnique({ where: { id } });
    return video ? toVideo(video) : undefined;
  }

  async addFromCache(input: CacheVideoInput): Promise<Video> {
    const video = await this.prisma.video.create({
      data: {
        title: input.title,
        description: input.description,
        source: "bilibili",
        sourceUrl: input.sourceUrl ?? "https://www.bilibili.com",
        cdnUrl: sampleVideoUrl,
        posterUrl: input.posterUrl,
        durationSeconds: 30,
        tagsJson: input.tags,
        hotScore: input.hotScore ?? 70
      }
    });
    return toVideo(video);
  }
}

function toVideo(video: PrismaVideo): Video {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    source: video.source,
    sourceUrl: video.sourceUrl,
    cdnUrl: video.cdnUrl,
    posterUrl: video.posterUrl,
    durationSeconds: video.durationSeconds,
    cachedAt: video.cachedAt.toISOString(),
    tags: Array.isArray(video.tagsJson) ? video.tagsJson.map(String) : [],
    hotScore: video.hotScore
  };
}
