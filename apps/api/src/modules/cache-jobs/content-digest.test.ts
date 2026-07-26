import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { FileSha256Digest } from "./content-digest.js";

test("FileSha256Digest streams a file to a stable sha256 prefix", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coplay-digest-"));
  try {
    const filePath = join(dir, "artifact.bin");
    const content = Buffer.from("coplay content-addressed artifact");
    await writeFile(filePath, content);

    const expected = createHash("sha256").update(content).digest("hex").slice(0, 16);
    const digest = new FileSha256Digest();

    const first = await digest.compute(filePath);
    const second = await digest.compute(filePath);

    assert.equal(first, expected);
    assert.equal(second, expected); // stable across calls
    assert.equal(first.length, 16);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("FileSha256Digest gives different digests for different content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "coplay-digest-"));
  try {
    const a = join(dir, "a.bin");
    const b = join(dir, "b.bin");
    await writeFile(a, "alpha");
    await writeFile(b, "beta");
    const digest = new FileSha256Digest();

    assert.notEqual(await digest.compute(a), await digest.compute(b));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
