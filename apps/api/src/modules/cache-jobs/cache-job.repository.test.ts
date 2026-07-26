import assert from "node:assert/strict";
import test from "node:test";
import type { PipelineLogger } from "../../shared/logger.js";
import type { Video } from "../videos/video.model.js";
import type { CacheVideoInput, VideoStore } from "../videos/video.store.js";
import type { CacheJob } from "./cache-job.model.js";
import { CacheJobRepository } from "./cache-job.repository.js";
import { CacheJobQuotaExceededError } from "./cache-job.store.js";
import type { BilibiliDownloader } from "./cache-pipeline.js";

const SUBMITTER = "ip:203.0.113.7";

test("resubmitting the same source reuses the in-flight job", () => {
  const jobs = new CacheJobRepository(new StubVideoStore());
  const sourceUrl = "https://www.bilibili.com/video/BV1xx411c7mD";

  const first = jobs.create(sourceUrl, SUBMITTER);
  const second = jobs.create(sourceUrl, SUBMITTER);

  assert.equal(second.id, first.id);
});

test("distinct sources create distinct jobs", () => {
  const jobs = new CacheJobRepository(new StubVideoStore());

  const first = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD", SUBMITTER);
  const second = jobs.create("https://www.bilibili.com/video/BV1yy411c7mE", SUBMITTER);

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

  const job = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD", SUBMITTER);
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

  const job = jobs.create("https://www.bilibili.com/video/BV1xx411c7mD", SUBMITTER);
  const terminal = await waitForTerminal(jobs, job.id);

  assert.equal(terminal.status, "completed");
  const stages = logger.infos.filter((e) => e.fields.jobId === job.id).map((e) => e.fields.stage);
  assert.deepEqual(stages, ["download", "upload", "completed"]);
  const completed = logger.infos.find((e) => e.fields.stage === "completed");
  assert.ok(String(completed?.fields.url ?? "").startsWith("http"));
});

test("daily quota rejects a submitter past the limit but not others", () => {
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, { dailyQuota: 2, stepDelayMs: 1 });

  jobs.create("https://www.bilibili.com/video/BV1aa411c7m1", SUBMITTER);
  jobs.create("https://www.bilibili.com/video/BV1aa411c7m2", SUBMITTER);
  assert.throws(
    () => jobs.create("https://www.bilibili.com/video/BV1aa411c7m3", SUBMITTER),
    CacheJobQuotaExceededError
  );

  // A different submitter has its own budget.
  const other = jobs.create("https://www.bilibili.com/video/BV1aa411c7m4", "ip:198.51.100.9");
  assert.equal(other.status, "queued");
});

test("idempotent reuse does not consume quota", () => {
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, { dailyQuota: 1, stepDelayMs: 1 });
  const url = "https://www.bilibili.com/video/BV1aa411c7m1";

  jobs.create(url, SUBMITTER);
  // Same URL again reuses the job rather than counting a second time against the limit of 1.
  assert.doesNotThrow(() => jobs.create(url, SUBMITTER));
});

test("quota only counts jobs inside the rolling 24h window", () => {
  let now = 1_000_000_000_000;
  const jobs = new CacheJobRepository(new StubVideoStore(), undefined, {
    dailyQuota: 1,
    stepDelayMs: 1,
    now: () => now
  });

  jobs.create("https://www.bilibili.com/video/BV1aa411c7m1", SUBMITTER);
  assert.throws(
    () => jobs.create("https://www.bilibili.com/video/BV1aa411c7m2", SUBMITTER),
    CacheJobQuotaExceededError
  );

  // Advance past the 24h window: the earlier job no longer counts.
  now += 24 * 60 * 60 * 1000 + 1;
  assert.doesNotThrow(() => jobs.create("https://www.bilibili.com/video/BV1aa411c7m3", SUBMITTER));
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
