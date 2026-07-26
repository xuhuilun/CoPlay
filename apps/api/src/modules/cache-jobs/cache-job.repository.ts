import { createId } from "../../shared/id.js";
import type { VideoStore } from "../videos/video.store.js";
import { describeCachedVideo } from "./bilibili.js";
import type { BilibiliDownloader, CdnUploader } from "./cache-pipeline.js";
import type { CacheJob } from "./cache-job.model.js";
import type { CacheJobNotifier } from "./cache-job.notifier.js";
import type { CacheJobStore } from "./cache-job.store.js";
import { SimulatedBilibiliDownloader, SimulatedCdnUploader } from "./simulated-cache-pipeline.js";

export class CacheJobRepository implements CacheJobStore {
  private readonly jobs = new Map<string, CacheJob>();
  private readonly downloader: BilibiliDownloader;
  private readonly uploader: CdnUploader;

  constructor(
    private readonly videos: VideoStore,
    private readonly notifier?: CacheJobNotifier,
    pipeline?: { downloader?: BilibiliDownloader; uploader?: CdnUploader }
  ) {
    this.downloader = pipeline?.downloader ?? new SimulatedBilibiliDownloader();
    this.uploader = pipeline?.uploader ?? new SimulatedCdnUploader();
  }

  create(sourceUrl: string): CacheJob {
    const reusable = this.findReusableJob(sourceUrl);
    if (reusable) {
      return reusable;
    }
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
    this.notifier?.publish(job);
    this.simulate(job.id);
    return job;
  }

  findById(id: string): CacheJob | undefined {
    return this.jobs.get(id);
  }

  // Reuse an existing in-flight or completed job for the same source so resubmitting a
  // link never triggers a duplicate download or a duplicate library entry. Failed jobs
  // are not reused, allowing a genuine retry.
  private findReusableJob(sourceUrl: string): CacheJob | undefined {
    for (const job of this.jobs.values()) {
      if (job.sourceUrl === sourceUrl && job.status !== "failed") {
        return job;
      }
    }
    return undefined;
  }

  private simulate(id: string) {
    const steps: Array<Pick<CacheJob, "status" | "progress" | "message">> = [
      { status: "downloading", progress: 28, message: "正在从 B 站拉取视频元数据。" },
      { status: "downloading", progress: 62, message: "正在缓存视频文件。" },
      { status: "uploading", progress: 86, message: "正在上传到 CDN。" },
      { status: "completed", progress: 100, message: "缓存完成，已加入视频库。" }
    ];

    steps.forEach((step, index) => {
      const timer = setTimeout(async () => {
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
          const downloaded = await this.downloader.download(job.sourceUrl);
          const uploaded = await this.uploader.upload(downloaded);
          const meta = describeCachedVideo(job.sourceUrl, id);
          const video = await this.videos.addFromCache({
            title: meta.title,
            description: meta.description,
            posterUrl: uploaded.posterUrl,
            tags: ["bilibili", "cached"],
            sourceUrl: job.sourceUrl,
            hotScore: 78,
            durationSeconds: downloaded.durationSeconds,
            sources: uploaded.sources
          });
          next.videoId = video.id;
        }
        this.jobs.set(id, next);
        this.notifier?.publish(next);
      }, (index + 1) * 1300);
      timer.unref?.();
    });
  }
}
