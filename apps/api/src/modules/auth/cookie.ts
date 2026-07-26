export type CookieOptions = {
  maxAgeSeconds?: number;
};

/**
 * Serializes a session cookie. HttpOnly keeps it out of JS, SameSite=Lax lets it ride the
 * top-level OAuth redirect back to the app. Behind HTTPS a deployment should also add Secure.
 */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${value}`, "HttpOnly", "SameSite=Lax", "Path=/"];
  if (options.maxAgeSeconds !== undefined) {
    parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`);
  }
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return `${name}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }
  for (const segment of cookieHeader.split(";")) {
    const separator = segment.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = segment.slice(0, separator).trim();
    if (key === name) {
      return segment.slice(separator + 1).trim();
    }
  }
  return undefined;
}
