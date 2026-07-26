import {
  AuthProviderNotConfiguredError,
  type AuthProvider,
  type AuthProviderInfo,
  type AuthStart
} from "./auth.provider.js";

/**
 * QR scan login (WeChat / QQ). These flows need vendor SDKs, an app id/secret, and a
 * ticket-polling callback that are not yet integrated, so the provider reports itself
 * unavailable and {@link start} throws. A production integration replaces this class.
 */
export class QrAuthProvider implements AuthProvider {
  constructor(
    private readonly providerId: string,
    private readonly displayName: string
  ) {}

  info(): AuthProviderInfo {
    return {
      id: this.providerId,
      displayName: this.displayName,
      kind: "qr",
      available: false
    };
  }

  async start(): Promise<AuthStart> {
    throw new AuthProviderNotConfiguredError(this.providerId);
  }
}
