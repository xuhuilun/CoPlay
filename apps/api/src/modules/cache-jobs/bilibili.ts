export type BilibiliRefKind = "bv" | "av" | "short";

export type BilibiliRef = {
  kind: BilibiliRefKind;
  id: string;
};

const BV_PATTERN = /BV[0-9A-Za-z]{10}/;
const AV_PATTERN = /av(\d+)/i;

/**
 * Extracts the Bilibili video reference from a submitted URL.
 *
 * - `bilibili.com` (and subdomains) links must carry a real `BV`/`av` video id,
 *   which rules out homepage or listing links that cannot be cached.
 * - `b23.tv` short links cannot be resolved without a network hop, so the first
 *   path segment is accepted as an opaque reference.
 *
 * Returns `undefined` for unsupported hosts or links without an identifiable video.
 */
export function parseBilibiliRef(rawUrl: string): BilibiliRef | undefined {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase();
  const target = `${url.pathname}${url.search}`;

  if (hostname === "b23.tv") {
    const segment = url.pathname.split("/").find((part) => part.length > 0);
    return segment ? { kind: "short", id: segment } : undefined;
  }

  if (hostname === "bilibili.com" || hostname.endsWith(".bilibili.com")) {
    const bv = target.match(BV_PATTERN);
    if (bv) {
      return { kind: "bv", id: bv[0] };
    }
    const av = target.match(AV_PATTERN);
    if (av) {
      return { kind: "av", id: `av${av[1]}` };
    }
  }

  return undefined;
}

/**
 * True when the URL points at a cacheable Bilibili video.
 */
export function isSupportedBilibiliUrl(rawUrl: string): boolean {
  return parseBilibiliRef(rawUrl) !== undefined;
}

/**
 * Builds display metadata for a video produced by a completed cache job. The job id
 * suffix keeps titles unique even when the same video is submitted more than once,
 * while the readable Bilibili id (when known) makes library entries identifiable.
 */
export function describeCachedVideo(sourceUrl: string, jobId: string): { title: string; description: string } {
  const ref = parseBilibiliRef(sourceUrl);
  const suffix = jobId.slice(-6);
  if (ref && (ref.kind === "bv" || ref.kind === "av")) {
    return {
      title: `B站视频 ${ref.id} #${suffix}`,
      description: `来源 ${ref.id}，由用户提交 B 站链接缓存到 CDN。`
    };
  }
  return {
    title: `B站缓存视频 #${suffix}`,
    description: "由用户提交 B 站链接缓存到 CDN。"
  };
}
