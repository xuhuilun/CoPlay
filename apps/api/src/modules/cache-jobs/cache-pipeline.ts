import type { VideoSource } from "../videos/video.model.js";
import type { BilibiliRef } from "./bilibili.js";

/**
 * Metadata and an artifact handle produced by downloading a Bilibili source into local
 * storage. A production downloader would populate these from real probe/download output.
 */
export type DownloadedVideo = {
  sourceUrl: string;
  ref: BilibiliRef | undefined;
  artifactId: string;
  durationSeconds: number;
  posterUrl: string;
};

/**
 * The playable renditions produced after publishing a downloaded artifact to the CDN.
 * The web server never proxies video, so these URLs point directly at the CDN.
 */
export type UploadedRenditions = {
  posterUrl: string;
  sources: VideoSource[];
};

/**
 * Port for fetching a Bilibili video into local/object storage.
 *
 * The default implementation ({@link ../simulated-cache-pipeline}) is simulated. A
 * production adapter would drive a real downloader (e.g. yt-dlp) and stream bytes to
 * storage, then report the probed duration and poster. Kept as a seam so the cache
 * worker never couples to a specific vendor or tool.
 */
export interface BilibiliDownloader {
  download(sourceUrl: string): Promise<DownloadedVideo>;
}

/**
 * Port for publishing a downloaded artifact to the CDN and returning playable renditions.
 *
 * The default implementation is simulated. A production adapter would upload the artifact
 * to the CDN / object storage (and, eventually, request transcodes) and return one CDN URL
 * per rendition. Kept as a seam so the cache worker never couples to a specific CDN.
 */
export interface CdnUploader {
  upload(video: DownloadedVideo): Promise<UploadedRenditions>;
}
