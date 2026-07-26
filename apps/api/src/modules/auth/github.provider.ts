import { randomUUID } from "node:crypto";
import type { GithubOAuthConfig } from "../../config.js";
import {
  AuthProviderNotConfiguredError,
  type AuthProvider,
  type AuthProviderInfo,
  type AuthStart
} from "./auth.provider.js";

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const SCOPE = "read:user user:email";

/**
 * GitHub OAuth login. When configured with a client id and redirect URI, {@link start}
 * produces a real GitHub authorize URL; the callback/token exchange is the remaining
 * production step. When unconfigured, the provider reports itself unavailable.
 */
export class GithubAuthProvider implements AuthProvider {
  static readonly id = "github";

  constructor(
    private readonly config?: GithubOAuthConfig,
    private readonly generateState: () => string = randomUUID
  ) {}

  info(): AuthProviderInfo {
    return {
      id: GithubAuthProvider.id,
      displayName: "GitHub",
      kind: "oauth",
      available: Boolean(this.config)
    };
  }

  async start(): Promise<AuthStart> {
    if (!this.config) {
      throw new AuthProviderNotConfiguredError(GithubAuthProvider.id);
    }
    const state = this.generateState();
    const url = new URL(AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    return { kind: "redirect", url: url.toString(), state };
  }
}
