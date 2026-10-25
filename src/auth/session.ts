import * as AuthSession from 'expo-auth-session';
import * as Device from 'expo-device';
import { useCallback } from 'react';

import { IS_INTERNAL_BUILD, type TenantConfig } from '@/config';
import { errorMessageFor } from '@/domain';
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
    // prompt=login (Qlik's /oauth/authorize documents it): Android has no ephemeral sheet, so Chrome keeps the Qlik
    // web session after a sign-out and the next sign-in would return the previous account without a login form.
    { clientId: config.clientId, scopes: SCOPES, redirectUri: redirectUri(), prompt: AuthSession.Prompt.Login },
    discovery,
  );

  const signIn = useCallback(async () => {
    // iOS only: without this the sheet shares Safari cookies, so Qlik's web session outlives a sign-out and the next sign-in skips the login form.
    const result = await promptAsync({ preferEphemeralSession: true });
    if (result.type === 'error' && result.params.error_code === 'OAUTH-28') {
      // Named so the sign-in screen can offer to share the request with the Tenant admin.
      throw Object.assign(new Error(errorMessageFor({ kind: 'TenantApprovalRequired' }).message), { name: 'TenantApprovalRequired' });
    }
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
    // Device-validation evidence for ticket 19's scope check: what the tenant actually granted.
    if (IS_INTERNAL_BUILD) console.warn(`[auth] requested scope: ${SCOPES.join(' ')}; granted: ${tokens.scope ?? '(not reported)'}`);
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
            // The enum is exported. eslint-plugin-import cannot read the export from the SDK 58 build output.
            // eslint-disable-next-line import/namespace
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
