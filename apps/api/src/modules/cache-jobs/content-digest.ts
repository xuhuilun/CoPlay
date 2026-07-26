import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import type { ContentDigest } from "./oss-cdn.uploader.js";

const DIGEST_LENGTH = 16;

/**
 * Streams a file through SHA-256 and returns a short hex digest. Used to build immutable,
 * content-addressed object keys so a published URL always maps to identical bytes.
 */
export class FileSha256Digest implements ContentDigest {
  compute(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex").slice(0, DIGEST_LENGTH)));
    });
  }
}
