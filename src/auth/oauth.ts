import type * as AuthSession from 'expo-auth-session';

import type { TenantConfig } from '@/config';

/**
 * Fixed, not `makeRedirectUri`: in Expo Go that returns an `exp://` URI the Qlik OAuth
 * client rejects. iOS's auth session catches the `qlikanswers://` callback itself, so
 * this also signs in from Expo Go on iOS.
 */
export const redirectUri = (): string => 'qlikanswers://auth';

/** Endpoints derive from the tenant host. The tenant's `/.well-known/oauth-authorization-server` lists the same paths. */
export const discoveryFor = (config: TenantConfig): AuthSession.DiscoveryDocument => ({
  authorizationEndpoint: `https://${config.tenantHost}/oauth/authorize`,
  tokenEndpoint: `https://${config.tenantHost}/oauth/token`,
  revocationEndpoint: `https://${config.tenantHost}/oauth/revoke`,
});

export const SCOPES = ['user_default', 'offline_access'];
