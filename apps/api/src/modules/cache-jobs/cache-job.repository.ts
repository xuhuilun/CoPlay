import { createId } from "../../shared/id.js";
import type { VideoStore } from "../videos/video.store.js";
import type { CacheJob } from "./cache-job.model.js";
import type { CacheJobStore } from "./cache-job.store.js";

const posterUrl =
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80";

export class CacheJobRepository implements CacheJobStore {
  private readonly jobs = new Map<string, CacheJob>();

  constructor(private readonly videos: VideoStore) {}

  create(sourceUrl: string): CacheJob {
    const now = new Date().toISOString();
    const job: CacheJob = {
      id: createId("job"),
      sourceUrl,
      status: "queued",
      progress: 5,
      message: "缓存任务已创建，等待下载。",
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    this.simulate(job.id);
    return job;
  }

  findById(id: string): CacheJob | undefined {
    return this.jobs.get(id);
  }

  private simulate(id: string) {
    const steps: Array<Pick<CacheJob, "status" | "progress" | "message">> = [
      { status: "downloading", progress: 28, message: "正在从 B 站拉取视频元数据。" },
      { status: "downloading", progress: 62, message: "正在缓存视频文件。" },
      { status: "uploading", progress: 86, message: "正在上传到 CDN。" },
      { status: "completed", progress: 100, message: "缓存完成，已加入视频库。" }
    ];

    steps.forEach((step, index) => {
      setTimeout(async () => {
        const job = this.jobs.get(id);
        if (!job || job.status === "completed") {
          return;
        }
        const next: CacheJob = {
          ...job,
          ...step,
          updatedAt: new Date().toISOString()
        };
        if (step.status === "completed") {
          const video = await this.videos.addFromCache({
            title: `B站缓存视频 ${id.slice(-6)}`,
            description: "由用户提交链接后缓存到 CDN 的视频。",
            posterUrl,
            tags: ["bilibili", "cached"],
            sourceUrl: job.sourceUrl,
            hotScore: 78
          });
          next.videoId = video.id;
        }
        this.jobs.set(id, next);
      }, (index + 1) * 1300);
    });
  }
}
