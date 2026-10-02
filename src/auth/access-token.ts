import * as AuthSession from 'expo-auth-session';

import type { TenantConfig } from '@/config';
import { discoveryFor } from './oauth';
import { computeExpiresAtMs, needsRefresh } from './token-expiry';
import { loadExpiresAtMs, loadRefreshToken, saveExpiresAtMs, saveRefreshToken } from './tokens';

/**
 * The access token lives here rather than in a component ref so the Qlik adapter
 * — which is not a React tree — can reach it, and so it survives the Settings
 * screen unmounting. Memory only, never SecureStore (ADR / proposal §3.2).
 */
let accessToken: string | null = null;

/**
 * Qlik rotates refresh tokens, so two requests refreshing at once would spend the same
 * one twice and the loser's rotation would invalidate the chain — signing the user out
 * mid-session. Concurrent callers share the one in-flight refresh instead.
 */
let refreshing: Promise<string | null> | null = null;

function rawTokenLifetime(tokens: AuthSession.TokenResponse) {
  const raw = tokens.rawResponse as { expires_at?: string; expires_in?: number } | undefined;
  return { expiresAt: raw?.expires_at, expiresIn: raw?.expires_in ?? tokens.expiresIn ?? undefined };
}

/** Takes ownership of a freshly issued token pair, from either sign-in or a refresh. */
export async function adoptTokens(tokens: AuthSession.TokenResponse): Promise<string> {
  accessToken = tokens.accessToken;
  const expiresAtMs = computeExpiresAtMs(rawTokenLifetime(tokens));
  if (expiresAtMs !== null) await saveExpiresAtMs(expiresAtMs);
  if (tokens.refreshToken) await saveRefreshToken(tokens.refreshToken);
  return tokens.accessToken;
}

/**
 * Called before every authenticated request — refreshes silently, never assumes
 * the token is still good. `null` means there is no way back to a valid token
 * without an interactive sign-in.
 */
export async function getAccessToken(config: TenantConfig): Promise<string | null> {
  if (accessToken && !needsRefresh(await loadExpiresAtMs())) return accessToken;
  refreshing ??= refresh(config).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * A fresh token together with its actual expiry, for a consumer that must tell someone else how
 * long the token lives. `null` when there is no valid token, or no evidence of when it expires —
 * an unknown expiry is never reported as a made-up lifetime.
 */
export async function getAccessTokenWithExpiry(
  config: TenantConfig,
): Promise<{ token: string; expiresAtMs: number } | null> {
  const token = await getAccessToken(config);
  if (!token) return null;
  const expiresAtMs = await loadExpiresAtMs();
  return expiresAtMs === null ? null : { token, expiresAtMs };
}

async function refresh(config: TenantConfig): Promise<string | null> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return null;

  const tokens = await AuthSession.refreshAsync({ clientId: config.clientId, refreshToken }, discoveryFor(config));
  return adoptTokens(tokens);
}

/** The current in-memory token without refreshing — only for revocation on sign-out. */
export const peekAccessToken = (): string | null => accessToken;

export function forgetAccessToken(): void {
  accessToken = null;
}
