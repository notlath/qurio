import * as AuthSession from 'expo-auth-session';
import * as Device from 'expo-device';
import { useCallback } from 'react';

import type { TenantConfig } from '@/config';
import { adoptTokens, forgetAccessToken, getAccessToken, peekAccessToken } from './access-token';
import { discoveryFor, redirectUri, SCOPES } from './oauth';
import { clearTokens, loadRefreshToken } from './tokens';

/** Qlik wants "Phone" / "Tablet" on the token request so an admin can tell tokens apart (proposal §3.1). */
function deviceTypeLabel(type: Device.DeviceType): 'Phone' | 'Tablet' | undefined {
  switch (type) {
    case Device.DeviceType.PHONE:
      return 'Phone';
    case Device.DeviceType.TABLET:
      return 'Tablet';
    default:
      return undefined;
  }
}

export function useQlikAuth(config: TenantConfig) {
  const discovery = discoveryFor(config);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: config.clientId, scopes: SCOPES, redirectUri: redirectUri() },
    discovery,
  );

  const signIn = useCallback(async () => {
    const result = await promptAsync();
    if (result.type !== 'success') return null;

    const deviceType = deviceTypeLabel(await Device.getDeviceTypeAsync());
    const tokens = await AuthSession.exchangeCodeAsync(
      {
        clientId: config.clientId,
        code: result.params.code,
        redirectUri: redirectUri(),
        extraParams: {
          code_verifier: request!.codeVerifier!,
          description: 'QlikAnswersApp',
          ...(deviceType ? { deviceType } : {}),
        },
      },
      discovery,
    );

    await adoptTokens(tokens);
    return tokens;
  }, [config.clientId, discovery, promptAsync, request]);

  /** Called before every authenticated request — refreshes silently, never assumes the token is still good. */
  const refreshIfNeeded = useCallback(() => getAccessToken(config), [config]);

  const signOut = useCallback(async () => {
    const accessToken = peekAccessToken();
    const refreshToken = await loadRefreshToken();
    // Revoke server-side first — clearing local storage alone is not logging out.
    await Promise.allSettled([
      accessToken
        ? AuthSession.revokeAsync({ token: accessToken, clientId: config.clientId }, discovery)
        : Promise.resolve(),
      refreshToken
        ? AuthSession.revokeAsync(
            { token: refreshToken, clientId: config.clientId, tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken },
            discovery,
          )
        : Promise.resolve(),
    ]);
    forgetAccessToken();
    await clearTokens();
  }, [config.clientId, discovery]);

  return { signIn, signOut, refreshIfNeeded, ready: !!request };
}
