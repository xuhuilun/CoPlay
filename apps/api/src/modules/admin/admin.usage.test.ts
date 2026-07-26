import assert from "node:assert/strict";
import test from "node:test";
import type { CacheJob } from "../cache-jobs/cache-job.model.js";
import { computeUsage } from "./admin.usage.js";

function job(overrides: Partial<CacheJob>): CacheJob {
  return {
    id: "job_1",
    sourceUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    status: "queued",
    progress: 5,
    message: "",
    submitter: "ip:1",
    createdAt: "2026-07-19T00:00:00.000Z",
    updatedAt: "2026-07-19T00:00:00.000Z",
    ...overrides
  };
}

test("computeUsage aggregates status counts, library size, and top submitters", () => {
  const jobs = [
    job({ status: "completed", submitter: "user:a" }),
    job({ status: "failed", submitter: "user:a" }),
    job({ status: "completed", submitter: "user:a" }),
    job({ status: "queued", submitter: "ip:2" })
  ];

  const report = computeUsage(jobs, 7);

  assert.equal(report.jobs.total, 4);
  assert.equal(report.jobs.byStatus.completed, 2);
  assert.equal(report.jobs.byStatus.failed, 1);
  assert.equal(report.jobs.byStatus.queued, 1);
  assert.equal(report.jobs.byStatus.cancelled, 0);
  assert.equal(report.librarySize, 7);

  assert.equal(report.topSubmitters[0].submitter, "user:a");
  assert.deepEqual(report.topSubmitters[0], { submitter: "user:a", total: 3, completed: 2, failed: 1 });
  assert.equal(report.topSubmitters[1].submitter, "ip:2");
});

test("computeUsage handles no jobs", () => {
  const report = computeUsage([], 0);
  assert.equal(report.jobs.total, 0);
  assert.deepEqual(report.topSubmitters, []);
});
