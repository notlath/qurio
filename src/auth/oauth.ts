import type * as AuthSession from 'expo-auth-session';

import type { TenantConfig } from '@/config';

/**
 * Fixed, not `makeRedirectUri`: in Expo Go that returns an `exp://` URI the Qlik OAuth
 * client rejects. iOS's auth session catches the `qlikanswers://` callback itself, so
 * this also signs in from Expo Go on iOS.
 */
export const redirectUri = (): string => 'qlikanswers://auth';

/** Qlik publishes no discovery document; endpoints derive from the tenant host. */
export const discoveryFor = (config: TenantConfig): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: `https://${config.tenantHost}/oauth/authorize`,
  tokenEndpoint: `https://${config.tenantHost}/oauth/token`,
  revocationEndpoint: `https://${config.tenantHost}/oauth/revoke`,
});

export const SCOPES = ['user_default', 'offline_access'];
