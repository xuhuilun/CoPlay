import { EventEmitter } from "node:events";
import type { CacheJob } from "./cache-job.model.js";

type CacheJobEvents = {
  update: [CacheJob];
};

export class CacheJobNotifier {
  private readonly emitter = new EventEmitter<CacheJobEvents>();

  publish(job: CacheJob): void {
    this.emitter.emit("update", job);
  }

  onUpdate(listener: (job: CacheJob) => void): () => void {
    this.emitter.on("update", listener);
    return () => this.emitter.off("update", listener);
  }
}
