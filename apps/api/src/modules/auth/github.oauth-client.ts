/** Minimal HTTP surface so the client can be unit-tested with a fake fetch. */
export type HttpResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type HttpRequest = {
  method: string;
  headers: Record<string, string>;
  body?: string;
};

export type HttpFetch = (url: string, init: HttpRequest) => Promise<HttpResponse>;

/** Identity resolved from the GitHub user API. */
export type GithubIdentity = {
  providerUserId: string;
  login: string;
  displayName: string;
  avatarUrl: string;
};

/**
 * Outcome of exchanging an authorization code for an access token.
 * - `success`: a token was returned.
 * - `rejected`: GitHub answered but refused the code (e.g. bad/expired code) — a client error.
 * - `failed`: the exchange could not complete (transport/HTTP/parse error) — an upstream error.
 */
export type ExchangeResult =
  | { status: "success"; accessToken: string }
  | { status: "rejected" }
  | { status: "failed" };

export interface GithubOAuthClient {
  exchangeCode(code: string): Promise<ExchangeResult>;
  /** Returns the identity, or `undefined` when the user API call fails. */
  fetchIdentity(accessToken: string): Promise<GithubIdentity | undefined>;
}

export type GithubOAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const ACCESS_TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token";
const USER_ENDPOINT = "https://api.github.com/user";

const defaultFetch: HttpFetch = async (url, init) => {
  const response = await fetch(url, init);
  return {
    ok: response.ok,
    status: response.status,
    json: () => response.json()
  };
};

/**
 * Production GitHub OAuth client. The `fetch` layer is injectable so the three exchange
 * paths (success / rejected / failed) and identity resolution can be tested without network.
 */
export class HttpGithubOAuthClient implements GithubOAuthClient {
  constructor(
    private readonly config: GithubOAuthClientConfig,
    private readonly fetchImpl: HttpFetch = defaultFetch
  ) {}

  async exchangeCode(code: string): Promise<ExchangeResult> {
    let response: HttpResponse;
    try {
      response = await this.fetchImpl(ACCESS_TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: this.config.redirectUri
        })
      });
    } catch {
      return { status: "failed" };
    }
    if (!response.ok) {
      return { status: "failed" };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { status: "failed" };
    }
    const token = readString(body, "access_token");
    // GitHub answers 200 with an `error` field when the code is bad, so absence of a token
    // is a rejection, not a transport failure.
    return token ? { status: "success", accessToken: token } : { status: "rejected" };
  }

  async fetchIdentity(accessToken: string): Promise<GithubIdentity | undefined> {
    let response: HttpResponse;
    try {
      response = await this.fetchImpl(USER_ENDPOINT, {
        method: "GET",
        headers: {
          authorization: `Bearer ${accessToken}`,
          accept: "application/vnd.github+json",
          "user-agent": "CoPlay"
        }
      });
    } catch {
      return undefined;
    }
    if (!response.ok) {
      return undefined;
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return undefined;
    }
    const id = readIdentifier(body, "id");
    if (!id) {
      return undefined;
    }
    const login = readString(body, "login") ?? "";
    return {
      providerUserId: id,
      login,
      displayName: readString(body, "name") || login || `github-${id}`,
      avatarUrl: readString(body, "avatar_url") ?? ""
    };
  }
}

function readString(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readIdentifier(body: unknown, key: string): string | undefined {
  if (typeof body !== "object" || body === null) {
    return undefined;
  }
  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}
