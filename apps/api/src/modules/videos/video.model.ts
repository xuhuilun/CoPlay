export type VideoSource = {
  id: string;
  label: string;
  url: string;
};

export type Video = {
  id: string;
  title: string;
  description: string;
  source: "bilibili" | "library";
  sourceUrl: string;
  cdnUrl: string;
  posterUrl: string;
  durationSeconds: number;
  cachedAt: string;
  tags: string[];
  hotScore: number;
  sources: VideoSource[];
};

/**
 * Returns a single "原画" rendition derived from the primary CDN URL. Freshly cached
 * videos start with one rendition; a transcode pipeline can attach more later.
 */
export function defaultVideoSources(cdnUrl: string): VideoSource[] {
  return [{ id: "auto", label: "原画", url: cdnUrl }];
}

/**
 * Normalizes a possibly-empty rendition list into a non-empty one, falling back to the
 * primary CDN URL so callers can always rely on at least one playable source.
 */
export function normalizeVideoSources(sources: VideoSource[] | undefined, cdnUrl: string): VideoSource[] {
  const valid = (sources ?? []).filter(
    (source): source is VideoSource =>
      typeof source?.id === "string" &&
      source.id.length > 0 &&
      typeof source.label === "string" &&
      source.label.length > 0 &&
      typeof source.url === "string" &&
      source.url.length > 0
  );
  return valid.length > 0 ? valid : defaultVideoSources(cdnUrl);
}
