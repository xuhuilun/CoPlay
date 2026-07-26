import assert from "node:assert/strict";
import test from "node:test";
import { HttpGithubOAuthClient, type HttpFetch, type HttpResponse } from "./github.oauth-client.js";

const config = {
  clientId: "client_123",
  clientSecret: "secret_456",
  redirectUri: "https://bilisync.top/auth/github/callback"
};

function jsonResponse(status: number, body: unknown): HttpResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

test("exchangeCode returns success when github returns an access token", async () => {
  const fetchImpl: HttpFetch = async (url) => {
    assert.equal(url, "https://github.com/login/oauth/access_token");
    return jsonResponse(200, { access_token: "gho_token", token_type: "bearer" });
  };
  const client = new HttpGithubOAuthClient(config, fetchImpl);

  assert.deepEqual(await client.exchangeCode("good_code"), {
    status: "success",
    accessToken: "gho_token"
  });
});

test("exchangeCode returns rejected when github refuses the code", async () => {
  const fetchImpl: HttpFetch = async () => jsonResponse(200, { error: "bad_verification_code" });
  const client = new HttpGithubOAuthClient(config, fetchImpl);

  assert.deepEqual(await client.exchangeCode("bad_code"), { status: "rejected" });
});

test("exchangeCode returns failed on transport or non-2xx responses", async () => {
  const throwing = new HttpGithubOAuthClient(config, async () => {
    throw new Error("network down");
  });
  assert.deepEqual(await throwing.exchangeCode("x"), { status: "failed" });

  const serverError = new HttpGithubOAuthClient(config, async () => jsonResponse(500, {}));
  assert.deepEqual(await serverError.exchangeCode("x"), { status: "failed" });
});

test("fetchIdentity maps the github user payload", async () => {
  const fetchImpl: HttpFetch = async (url, init) => {
    assert.equal(url, "https://api.github.com/user");
    assert.equal(init.headers.authorization, "Bearer gho_token");
    return jsonResponse(200, { id: 42, login: "octocat", name: "The Octocat", avatar_url: "https://a/1.png" });
  };
  const client = new HttpGithubOAuthClient(config, fetchImpl);

  assert.deepEqual(await client.fetchIdentity("gho_token"), {
    providerUserId: "42",
    login: "octocat",
    displayName: "The Octocat",
    avatarUrl: "https://a/1.png"
  });
});

test("fetchIdentity returns undefined when the user api fails", async () => {
  const client = new HttpGithubOAuthClient(config, async () => jsonResponse(401, {}));
  assert.equal(await client.fetchIdentity("gho_token"), undefined);
});
