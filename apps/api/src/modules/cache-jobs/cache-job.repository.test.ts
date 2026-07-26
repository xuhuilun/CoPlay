import assert from "node:assert/strict";
import test from "node:test";
import type { PipelineLogger } from "../../shared/logger.js";
import type { Video } from "../videos/video.model.js";
import type { CacheVideoInput, VideoStore } from "../videos/video.store.js";
import type { CacheJob } from "./cache-job.model.js";
import { CacheJobRepository } from "./cache-job.repository.js";
import type { BilibiliDownloader } from "./cache-pipeline.js";

test("resubmitting the same source reuses the in-flight job", () => {
  const jobs = new CacheJobRepository(new StubVideoStore());
  const sourceUrl = "https://www.bilibili.com/video/BV1xx411c7mD";

  const first = jobs.create(sourceUrl);
  const second = jobs.create(sourceUrl);

  assert.equal(second.id, first.id);
});

test("distinct sources create distinct jobs", () => {
  const jobs = new CacheJobRepository(new StubVideoStore());

  const first = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD");
  const second = jobs.create("https://www.bilibili.com/video/BV1yy411c7mE");

  assert.notEqual(second.id, first.id);
});

test("a failing download marks the job as failed and logs the failed stage", async () => {
  const failingDownloader: BilibiliDownloader = {
    download: async () => {
      throw new Error("boom");
    }
  };
  const logger = new RecordingLogger();
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, {
    downloader: failingDownloader,
    stepDelayMs: 1,
    logger
  });

  const job = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD");
  const terminal = await waitForTerminal(jobs, job.id);

  assert.equal(terminal.status, "failed");
  assert.match(terminal.message, /boom/);

  const failed = logger.errors.find((entry) => entry.fields.stage === "failed");
  assert.ok(failed, "expected a failed-stage error log");
  assert.equal(failed.fields.jobId, job.id);
  assert.match(String(failed.fields.err), /boom/);
});

test("a successful job logs download, upload, and completed stages with the task id", async () => {
  const logger = new RecordingLogger();
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, { stepDelayMs: 1, logger });

  const job = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD");
  const terminal = await waitForTerminal(jobs, job.id);

  assert.equal(terminal.status, "completed");
  const stages = logger.infos.filter((e) => e.fields.jobId === job.id).map((e) => e.fields.stage);
  assert.deepEqual(stages, ["download", "upload", "completed"]);
  const completed = logger.infos.find((e) => e.fields.stage === "completed");
  assert.ok(String(completed?.fields.url ?? "").startsWith("http"));
});

async function waitForTerminal(jobs: CacheJobRepository, id: string): Promise<CacheJob> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const job = jobs.findById(id);
    if (job && (job.status === "completed" || job.status === "failed")) {
      return job;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("cache job did not reach a terminal state");
}

type LogEntry = { fields: Record<string, unknown>; message: string };

class RecordingLogger implements PipelineLogger {
  readonly infos: LogEntry[] = [];
  readonly errors: LogEntry[] = [];
  info(fields: Record<string, unknown>, message: string): void {
    this.infos.push({ fields, message });
  }
  error(fields: Record<string, unknown>, message: string): void {
    this.errors.push({ fields, message });
  }
}

class StubVideoStore implements VideoStore {
  list(): Video[] {
    return [];
  }

  hot(): Video[] {
    return [];
  }

  findById(): Video | undefined {
    return undefined;
  }

  addFromCache(input: CacheVideoInput): Video {
    return {
      id: "vid_stub",
      title: input.title,
      description: input.description,
      source: "bilibili",
      sourceUrl: input.sourceUrl ?? "https://www.bilibili.com",
      cdnUrl: "https://cdn.example/video.mp4",
      posterUrl: input.posterUrl,
      durationSeconds: 30,
      cachedAt: "2026-07-19T00:00:00.000Z",
      tags: input.tags,
      hotScore: input.hotScore ?? 70,
      sources: [{ id: "auto", label: "原画", url: "https://cdn.example/video.mp4" }]
    };
  }
}
