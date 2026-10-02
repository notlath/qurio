import * as SecureStore from 'expo-secure-store';

const REFRESH_TOKEN_KEY = 'qlik.refreshToken';
const EXPIRES_AT_KEY = 'qlik.accessTokenExpiresAtMs';
const OPTS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

// The access token itself is never written here — it stays in memory only (ADR / proposal §3.2).
export const saveRefreshToken = (token: string) => SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, OPTS);
export const loadRefreshToken = () => SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTS);

// The expiry timestamp is not a secret, but it must survive a restart alongside the refresh
// token so a resumed session knows whether the access token it's about to fetch is fresh.
export const saveExpiresAtMs = (ms: number) => SecureStore.setItemAsync(EXPIRES_AT_KEY, String(ms), OPTS);
export const loadExpiresAtMs = async (): Promise<number | null> => {
  const raw = await SecureStore.getItemAsync(EXPIRES_AT_KEY, OPTS);
  return raw ? Number(raw) : null;
};

export const clearTokens = () =>
  Promise.all([
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTS),
    SecureStore.deleteItemAsync(EXPIRES_AT_KEY, OPTS),
  ]);
