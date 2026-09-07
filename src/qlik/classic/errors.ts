import type { AppError } from '@/domain';

export type MinimalResponse = {
  status: number;
  headers: { get(name: string): string | null };
};

// The real tenant's 429 carries no Retry-After header at all (verified live, ticket 11) — only a
// human-readable detail string mentioning "20 per 60s". Default to that window when no header exists.
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;

export function toDomainError(response: MinimalResponse): AppError {
  switch (response.status) {
    case 401:
      return { kind: 'SessionExpired' };
    // 403 can also mean AssistantForbidden (entitled, but no access to this Assistant) — disambiguating
    // needs a second call (technical-proposal.md:486) and needs a real under-permissioned test user to
    // verify against, which this ticket doesn't have. Ticket 13 owns that; NotEntitled is the default.
    case 403:
      return { kind: 'NotEntitled' };
    case 404:
      return { kind: 'AssistantNotFound' };
    case 429: {
      const header = response.headers.get('Retry-After');
      const retryAfterMs = header ? Number(header) * 1000 : DEFAULT_RATE_LIMIT_RETRY_MS;
      return { kind: 'RateLimited', retryAfterMs };
    }
    default:
      return { kind: 'ServiceUnavailable' };
  }
}

/**
 * For when `fetch` itself throws rather than resolving with a response — a real network failure
 * (Offline), or a deliberate `AbortSignal` abort (Stop / backgrounding, already handled by ticket 7's
 * `consumeStream` — not an error state, so this returns null rather than a display-worthy AppError).
 */
export function classifyFetchFailure(error: unknown): AppError | null {
  // Matched by name, not by `instanceof DOMException`: React Native and `expo/fetch` both
  // reject with a plain Error named AbortError, so an instanceof check misses the real abort.
  if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError') return null;
  return { kind: 'Offline' };
}
