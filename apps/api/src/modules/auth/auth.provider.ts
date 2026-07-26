export type AuthProviderKind = "oauth" | "qr";

/**
 * Public description of a login provider, safe to expose to guests so the web can render
 * login options. `available` is false when the provider exists but is not yet configured.
 */
export type AuthProviderInfo = {
  id: string;
  displayName: string;
  kind: AuthProviderKind;
  available: boolean;
};

/**
 * Instructions the client follows to begin a login flow: either a redirect (OAuth) or a
 * scannable QR ticket (WeChat/QQ).
 */
export type AuthStart =
  | { kind: "redirect"; url: string; state: string }
  | { kind: "qr"; ticket: string; imageUrl: string };

/**
 * Thrown by {@link AuthProvider.start} when the provider is known but not configured with
 * the credentials it needs. Routes translate this into a 409 so the client can explain it.
 */
export class AuthProviderNotConfiguredError extends Error {
  constructor(id: string) {
    super(`Auth provider ${id} is not configured`);
    this.name = "AuthProviderNotConfiguredError";
  }
}

/**
 * Port for a login provider. Login is optional (guests are always allowed); providers are
 * a seam so GitHub, WeChat, and QQ sign-in can be added without touching the rest of the
 * app. A production integration implements this interface and its callback handling.
 */
export interface AuthProvider {
  info(): AuthProviderInfo;
  /** Begins a login flow. Throws {@link AuthProviderNotConfiguredError} when unconfigured. */
  start(): Promise<AuthStart>;
}
