import assert from "node:assert/strict";
import test from "node:test";
import { AuthProviderNotConfiguredError } from "./auth.provider.js";
import { GithubAuthProvider } from "./github.provider.js";

test("github provider is unavailable without configuration", async () => {
  const provider = new GithubAuthProvider();
  assert.deepEqual(provider.info(), {
    id: "github",
    displayName: "GitHub",
    kind: "oauth",
    available: false
  });
  await assert.rejects(provider.start(), AuthProviderNotConfiguredError);
});

test("github provider builds an authorize url when configured", async () => {
  const provider = new GithubAuthProvider(
    { clientId: "client_123", redirectUri: "https://bilisync.top/auth/github/callback" },
    () => "state_fixed"
  );

  assert.equal(provider.info().available, true);

  const start = await provider.start();
  assert.equal(start.kind, "redirect");
  if (start.kind !== "redirect") {
    return;
  }
  const url = new URL(start.url);
  assert.equal(url.origin + url.pathname, "https://github.com/login/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "client_123");
  assert.equal(url.searchParams.get("redirect_uri"), "https://bilisync.top/auth/github/callback");
  assert.equal(url.searchParams.get("scope"), "read:user user:email");
  assert.equal(url.searchParams.get("state"), "state_fixed");
  assert.equal(start.state, "state_fixed");
});
