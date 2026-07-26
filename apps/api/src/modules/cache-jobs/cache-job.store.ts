import type { Awaitable } from "../../shared/awaitable.js";
import type { CacheJob } from "./cache-job.model.js";

export type CacheJobStore = {
  create(sourceUrl: string, submitter: string): Awaitable<CacheJob>;
  findById(id: string): Awaitable<CacheJob | undefined>;
};

/**
 * Thrown by `create` when a submitter has reached the rolling 24h cache-job limit. Routes
 * translate it into a 429 so an abusive client cannot run up OSS storage and CDN egress.
 */
export class CacheJobQuotaExceededError extends Error {
  constructor(
    readonly submitter: string,
    readonly limit: number
  ) {
    super(`Cache job quota exceeded for ${submitter} (limit ${limit})`);
    this.name = "CacheJobQuotaExceededError";
  }
}
