import { randomUUID } from "node:crypto";
import type { GithubOAuthConfig } from "../../config.js";
import type { AuthStateStore } from "./auth-state.store.js";
import {
  AuthProviderNotConfiguredError,
  type AuthProvider,
  type AuthProviderInfo,
  type AuthStart
} from "./auth.provider.js";

const AUTHORIZE_ENDPOINT = "https://github.com/login/oauth/authorize";
const SCOPE = "read:user user:email";

export type GithubAuthProviderOptions = {
  stateStore?: AuthStateStore;
  generateState?: () => string;
};

/**
 * GitHub OAuth login. When configured with a client id and redirect URI, {@link start}
 * produces a real GitHub authorize URL and records the `state` in the state store so the
 * callback can validate it. When unconfigured, the provider reports itself unavailable.
 */
export class GithubAuthProvider implements AuthProvider {
  static readonly id = "github";

  private readonly stateStore?: AuthStateStore;
  private readonly generateState: () => string;

  constructor(
    private readonly config?: GithubOAuthConfig,
    options: GithubAuthProviderOptions = {}
  ) {
    this.stateStore = options.stateStore;
    this.generateState = options.generateState ?? randomUUID;
  }

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
    await this.stateStore?.issue(state);
    const url = new URL(AUTHORIZE_ENDPOINT);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", SCOPE);
    url.searchParams.set("state", state);
    return { kind: "redirect", url: url.toString(), state };
  }
}
