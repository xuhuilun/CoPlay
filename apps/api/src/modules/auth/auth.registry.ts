import type { AuthProvider, AuthProviderInfo } from "./auth.provider.js";

/**
 * Holds the configured login providers and exposes lookups for the auth routes. Login is
 * optional, so an empty or all-unavailable registry is a valid guest-only deployment.
 */
export class AuthProviderRegistry {
  constructor(private readonly providers: AuthProvider[]) {}

  list(): AuthProviderInfo[] {
    return this.providers.map((provider) => provider.info());
  }

  find(id: string): AuthProvider | undefined {
    return this.providers.find((provider) => provider.info().id === id);
  }
}
