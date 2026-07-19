import assert from "node:assert/strict";
import test from "node:test";
import { validateCacheJobSubscribePayload } from "./cache-job.gateway.js";

test("validateCacheJobSubscribePayload accepts a valid job id", () => {
  assert.deepEqual(validateCacheJobSubscribePayload({ jobId: "job_123" }), { jobId: "job_123" });
});

test("validateCacheJobSubscribePayload rejects malformed payloads", () => {
  assert.equal(validateCacheJobSubscribePayload(undefined), undefined);
  assert.equal(validateCacheJobSubscribePayload({}), undefined);
  assert.equal(validateCacheJobSubscribePayload({ jobId: "" }), undefined);
  assert.equal(validateCacheJobSubscribePayload({ jobId: " " }), undefined);
  assert.equal(validateCacheJobSubscribePayload({ jobId: "x".repeat(129) }), undefined);
});
