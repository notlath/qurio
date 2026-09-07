export type TokenLifetimeInput = {
  expiresAt?: string; // ISO 8601 — the field Qlik's oauth-token-response schema actually declares
  expiresIn?: number; // seconds — undeclared, but the live endpoint may return it anyway (proposal §3.1)
};

/**
 * Qlik's schema has no `expires_in`, so expo-auth-session's own freshness
 * check treats the token as permanently valid — this is what makes it
 * load-bearing to derive expiry ourselves rather than trust the library.
 * Prefer `expires_at` (what the schema guarantees); fall back to
 * `expires_in` only if it's ever actually present.
 */
export function computeExpiresAtMs(input: TokenLifetimeInput, now: number = Date.now()): number | null {
  if (input.expiresAt) {
    const parsed = Date.parse(input.expiresAt);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof input.expiresIn === 'number') {
    return now + input.expiresIn * 1000;
  }
  return null;
}

const REFRESH_MARGIN_MS = 60_000;

/**
 * `null` means we have no evidence of when — or whether — the token expires.
 * That is never treated as "never expires": that exact assumption is the bug
 * expo-auth-session's own freshness check makes when `expires_in` is absent.
 */
export function needsRefresh(expiresAtMs: number | null, now: number = Date.now()): boolean {
  if (expiresAtMs === null) return true;
  return now > expiresAtMs - REFRESH_MARGIN_MS;
}
