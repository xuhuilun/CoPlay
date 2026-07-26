import { parseBilibiliRef } from "./bilibili.js";
import type {
  BilibiliDownloader,
  CdnUploader,
  DownloadedVideo,
  UploadedRenditions
} from "./cache-pipeline.js";

const defaultPosterUrl =
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1200&q=80";

// A real, playable sample stands in for the CDN artifact until a transcode pipeline exists.
const sampleCdnUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

/**
 * Simulated downloader: resolves a stable artifact id from the Bilibili reference without
 * performing any network I/O. Swap for a real yt-dlp-backed adapter in production.
 */
export class SimulatedBilibiliDownloader implements BilibiliDownloader {
  async download(sourceUrl: string): Promise<DownloadedVideo> {
    const ref = parseBilibiliRef(sourceUrl);
    return {
      sourceUrl,
      ref,
      artifactId: ref?.id ?? sourceUrl,
      durationSeconds: 30,
      posterUrl: defaultPosterUrl
    };
  }
}

/**
 * Simulated uploader: returns a single playable rendition instead of pushing bytes to a
 * CDN. A production adapter would upload the artifact and return one CDN URL per rendition.
 */
export class SimulatedCdnUploader implements CdnUploader {
  async upload(video: DownloadedVideo): Promise<UploadedRenditions> {
    return {
      posterUrl: video.posterUrl,
      sources: [{ id: "auto", label: "原画", url: sampleCdnUrl }]
    };
  }
}
