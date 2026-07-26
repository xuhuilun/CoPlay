#!/usr/bin/env node
// End-to-end smoke test against a RUNNING CoPlay API. Start the API with your real
// environment first (OSS + GitHub + CACHE_DOWNLOADER=ytdlp for the full chain), then:
//   node scripts/smoke.mjs
// It reads env, drives the cache state machine to completion, validates the returned
// CDN/OSS URL serves bytes, and exercises GitHub OAuth (real token exchange).
// Exits non-zero if any check fails.

const API = (process.env.SMOKE_API_BASE ?? "http://localhost:4000/api").replace(/\/$/, "");
const BILIBILI_URL = process.env.SMOKE_BILIBILI_URL ?? "https://www.bilibili.com/video/BV1GJ411x7h7";
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 120000);

let failures = 0;
const pass = (step, detail) => console.log(`  ✓ ${step}${detail ? ` — ${detail}` : ""}`);
const fail = (step, detail) => {
  failures += 1;
  console.log(`  ✗ ${step}${detail ? ` — ${detail}` : ""}`);
};
const section = (title) => console.log(`\n▸ ${title}`);

async function api(path, init) {
  const hasBody = init?.body !== undefined && init?.body !== null;
  const res = await fetch(`${API}${path}`, {
    headers: { ...(hasBody ? { "content-type": "application/json" } : {}), ...(init?.headers ?? {}) },
    ...init
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkReadiness() {
  section("Readiness");
  try {
    const { status, body } = await api("/health/ready");
    if (status === 200) pass("API ready", JSON.stringify(body));
    else fail("API ready", `status ${status} — is the server running at ${API}?`);
  } catch (error) {
    fail("API reachable", `${error.message} (start the API first)`);
  }
}

async function checkCacheChain() {
  section("Cache chain: submit → poll → validate bytes");
  const created = await api("/cache-jobs", {
    method: "POST",
    body: JSON.stringify({ sourceUrl: BILIBILI_URL })
  });
  if (created.status !== 201) {
    fail("submit cache job", `status ${created.status}: ${JSON.stringify(created.body)}`);
    return;
  }
  const jobId = created.body.id;
  pass("submit cache job", `jobId=${jobId}`);

  const deadline = Date.now() + TIMEOUT_MS;
  let job = created.body;
  while (job.status !== "completed" && job.status !== "failed" && Date.now() < deadline) {
    await sleep(1500);
    const polled = await api(`/cache-jobs/${jobId}`);
    if (polled.status !== 200) {
      fail("poll cache job", `status ${polled.status}`);
      return;
    }
    job = polled.body;
    process.stdout.write(`    … ${job.status} ${job.progress}%\r`);
  }
  console.log("");

  if (job.status !== "completed") {
    fail("cache job completed", `ended as "${job.status}": ${job.message ?? ""}`);
    return;
  }
  pass("cache job completed", `videoId=${job.videoId}`);

  const video = await api(`/videos/${job.videoId}`);
  if (video.status !== 200) {
    fail("fetch cached video", `status ${video.status}`);
    return;
  }
  const url = video.body.sources?.[0]?.url;
  if (!url) {
    fail("resolve playback URL", "no sources on the cached video");
    return;
  }
  pass("resolve playback URL", url);

  try {
    const res = await fetch(url, { headers: { Range: "bytes=0-65535" } });
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    if ((res.status === 200 || res.status === 206) && buf.byteLength > 0) {
      pass("playback URL serves bytes", `${res.status}, ${buf.byteLength} bytes, ${type || "no content-type"}`);
      if (!type.startsWith("video/")) {
        console.log(`    ! content-type is "${type}" (expected video/*) — check the uploader's mime handling`);
      }
    } else {
      fail("playback URL serves bytes", `status ${res.status}, ${buf.byteLength} bytes`);
    }
  } catch (error) {
    fail("fetch playback URL", error.message);
  }
}

async function checkGithubOauth() {
  section("GitHub OAuth: authorize URL → callback (real token exchange)");
  const providers = await api("/auth/providers");
  const github = Array.isArray(providers.body?.items)
    ? providers.body.items.find((p) => p.id === "github")
    : undefined;
  if (!github?.available) {
    console.log("    ! GitHub not configured (set GITHUB_CLIENT_ID/SECRET/REDIRECT_URI) — skipping");
    return;
  }

  const start = await api("/auth/providers/github/start", { method: "POST" });
  if (start.status !== 200 || start.body?.kind !== "redirect") {
    fail("generate authorize URL", `status ${start.status}: ${JSON.stringify(start.body)}`);
    return;
  }
  let authorize;
  try {
    authorize = new URL(start.body.url);
  } catch {
    fail("authorize URL well-formed", start.body.url);
    return;
  }
  const hasClient = authorize.searchParams.get("client_id");
  const state = authorize.searchParams.get("state");
  if (authorize.host === "github.com" && hasClient && state) {
    pass("generate authorize URL", `client_id set, state=${state.slice(0, 8)}…`);
  } else {
    fail("authorize URL well-formed", start.body.url);
    return;
  }

  // Drive the callback with the issued state and a dummy code. The token exchange really
  // calls github.com: a 401 (code_rejected) proves we reached GitHub and it rejected the
  // dummy code; a 502 (exchange_failed) means GitHub was unreachable/unparseable.
  const callback = await api(`/auth/github/callback?code=smoke_dummy_code&state=${encodeURIComponent(state)}`);
  if (callback.status === 401) {
    pass("callback reached GitHub and rejected the dummy code", "401 code_rejected (exchange path OK)");
  } else if (callback.status === 502) {
    fail("callback token exchange", "502 — GitHub unreachable or response unparseable");
  } else if (callback.status === 302) {
    pass("callback established a session", "302 (GitHub unexpectedly accepted the code)");
  } else {
    fail("callback token exchange", `unexpected status ${callback.status}: ${JSON.stringify(callback.body)}`);
  }
}

async function main() {
  console.log(`CoPlay smoke test → ${API}`);
  await checkReadiness();
  await checkCacheChain();
  await checkGithubOauth();

  console.log("");
  if (failures === 0) {
    console.log("✅ smoke test passed");
    process.exit(0);
  } else {
    console.log(`❌ smoke test failed (${failures} check${failures === 1 ? "" : "s"})`);
    process.exit(1);
  }
}

await main();
