import assert from "node:assert/strict";
import test from "node:test";
import type { CommandResult, CommandRunner } from "./command-runner.js";
import { buildDownloadArgs, buildProbeArgs, parseProbe, YtDlpBilibiliDownloader } from "./ytdlp.downloader.js";

test("buildProbeArgs and buildDownloadArgs construct the expected yt-dlp args", () => {
  const url = "https://www.bilibili.com/video/BV1xx411c7mD";
  assert.deepEqual(buildProbeArgs(url), ["--dump-single-json", "--no-playlist", url]);
  assert.deepEqual(buildDownloadArgs(url, { outputTemplate: "%(id)s.%(ext)s", format: "best" }), [
    "--no-playlist",
    "-f",
    "best",
    "-o",
    "%(id)s.%(ext)s",
    url
  ]);
  assert.deepEqual(
    buildDownloadArgs(url, { outputTemplate: "out/%(id)s.%(ext)s", format: "best", remuxFormat: "mp4" }),
    ["--no-playlist", "-f", "best", "-o", "out/%(id)s.%(ext)s", "--remux-video", "mp4", url]
  );
});

test("parseProbe reads the yt-dlp json payload", () => {
  const probe = parseProbe(JSON.stringify({ id: "BV1xx411c7mD", title: "Demo", duration: 128.4, thumbnail: "https://t/1.jpg" }));
  assert.equal(probe.id, "BV1xx411c7mD");
  assert.equal(probe.duration, 128.4);
});

test("download probes then downloads and maps metadata", async () => {
  const runner = new RecordingRunner([
    { stdout: JSON.stringify({ id: "BV1xx411c7mD", title: "Demo", duration: 128.4, thumbnail: "https://t/1.jpg" }), stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 }
  ]);
  const downloader = new YtDlpBilibiliDownloader(runner, { binaryPath: "yt-dlp", outputDir: "downloads" });

  const result = await downloader.download("https://www.bilibili.com/video/BV1xx411c7mD");

  assert.equal(runner.calls.length, 2);
  assert.deepEqual(runner.calls[0].args, ["--dump-single-json", "--no-playlist", "https://www.bilibili.com/video/BV1xx411c7mD"]);
  assert.equal(runner.calls[1].args[0], "--no-playlist");
  assert.ok(runner.calls[1].args.includes("--remux-video"));
  assert.equal(result.artifactId, "BV1xx411c7mD");
  assert.equal(result.durationSeconds, 128); // rounded
  assert.equal(result.posterUrl, "https://t/1.jpg");
  assert.equal(result.ref?.kind, "bv");
  assert.match(result.filePath ?? "", /downloads[\\/]BV1xx411c7mD\.mp4$/);
});

test("download falls back to a default duration and poster when the probe omits them", async () => {
  const runner = new RecordingRunner([
    { stdout: JSON.stringify({ id: "BV1xx411c7mD" }), stderr: "", code: 0 },
    { stdout: "", stderr: "", code: 0 }
  ]);
  const downloader = new YtDlpBilibiliDownloader(runner);

  const result = await downloader.download("https://www.bilibili.com/video/BV1xx411c7mD");
  assert.equal(result.durationSeconds, 30);
  assert.ok(result.posterUrl.startsWith("https://"));
});

test("download throws when the probe step fails", async () => {
  const runner = new RecordingRunner([{ stdout: "", stderr: "unsupported url", code: 1 }]);
  const downloader = new YtDlpBilibiliDownloader(runner);

  await assert.rejects(
    downloader.download("https://www.bilibili.com/video/BV1xx411c7mD"),
    /yt-dlp probe failed/
  );
});

test("download throws when the download step fails", async () => {
  const runner = new RecordingRunner([
    { stdout: JSON.stringify({ id: "BV1xx411c7mD", duration: 10 }), stderr: "", code: 0 },
    { stdout: "", stderr: "network error", code: 1 }
  ]);
  const downloader = new YtDlpBilibiliDownloader(runner);

  await assert.rejects(
    downloader.download("https://www.bilibili.com/video/BV1xx411c7mD"),
    /yt-dlp download failed/
  );
});

class RecordingRunner implements CommandRunner {
  readonly calls: Array<{ command: string; args: string[] }> = [];
  private index = 0;

  constructor(private readonly results: CommandResult[]) {}

  async run(command: string, args: string[]): Promise<CommandResult> {
    this.calls.push({ command, args });
    const result = this.results[this.index];
    this.index += 1;
    if (!result) {
      throw new Error("unexpected command invocation");
    }
    return result;
  }
}
