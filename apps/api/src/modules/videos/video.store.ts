import type { Awaitable } from "../../shared/awaitable.js";
import type { Video } from "./video.model.js";

export type CacheVideoInput = {
  title: string;
  description: string;
  posterUrl: string;
  tags: string[];
  hotScore?: number;
  sourceUrl?: string;
};

export type VideoStore = {
  list(query?: string): Awaitable<Video[]>;
  hot(): Awaitable<Video[]>;
  findById(id: string): Awaitable<Video | undefined>;
  addFromCache(input: CacheVideoInput): Awaitable<Video>;
};
