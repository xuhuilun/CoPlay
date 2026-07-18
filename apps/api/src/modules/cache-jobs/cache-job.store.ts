import type { Awaitable } from "../../shared/awaitable.js";
import type { CacheJob } from "./cache-job.model.js";

export type CacheJobStore = {
  create(sourceUrl: string): Awaitable<CacheJob>;
  findById(id: string): Awaitable<CacheJob | undefined>;
};
