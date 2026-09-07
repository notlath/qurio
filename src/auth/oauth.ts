import * as AuthSession from 'expo-auth-session';

import type { TenantConfig } from '@/config';

let cached: string | undefined;

/**
 * Resolved on first use, not at import: `makeRedirectUri` reads the expo-constants
 * manifest and throws without one, which would otherwise make every module that
 * transitively imports this one — the Qlik adapter included — unloadable off-device.
 */
export const redirectUri = (): string =>
  (cached ??= AuthSession.makeRedirectUri({ scheme: 'qlikanswers', path: 'auth' }));

/** Qlik publishes no discovery document; endpoints derive from the tenant host. */
export const discoveryFor = (config: TenantConfig): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: `https://${config.tenantHost}/oauth/authorize`,
  tokenEndpoint: `https://${config.tenantHost}/oauth/token`,
  revocationEndpoint: `https://${config.tenantHost}/oauth/revoke`,
});

export const SCOPES = ['user_default', 'offline_access'];
