import { classifyFetchFailure, toDomainError } from './errors';

function fakeResponse(status: number, headers: Record<string, string> = {}) {
  return {
    status,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  };
}

describe('toDomainError', () => {
  it('maps 401 to SessionExpired', () => {
    expect(toDomainError(fakeResponse(401))).toEqual({ kind: 'SessionExpired' });
  });

  it('maps 403 to NotEntitled (cannot disambiguate from AssistantForbidden without a second call — ticket 13)', () => {
    expect(toDomainError(fakeResponse(403))).toEqual({ kind: 'NotEntitled' });
  });

  it('maps 404 to AssistantNotFound', () => {
    expect(toDomainError(fakeResponse(404))).toEqual({ kind: 'AssistantNotFound' });
  });

  it('maps 500 (and other 5xx) to ServiceUnavailable', () => {
    expect(toDomainError(fakeResponse(500))).toEqual({ kind: 'ServiceUnavailable' });
    expect(toDomainError(fakeResponse(503))).toEqual({ kind: 'ServiceUnavailable' });
  });

  it('maps 429 to RateLimited defaulting to 60s — the real tenant sends no Retry-After header at all (verified live, ticket 11)', () => {
    expect(toDomainError(fakeResponse(429))).toEqual({ kind: 'RateLimited', retryAfterMs: 60_000 });
  });

  it('honours a Retry-After header in seconds, if the API ever adds one', () => {
    expect(toDomainError(fakeResponse(429, { 'retry-after': '15' }))).toEqual({
      kind: 'RateLimited',
      retryAfterMs: 15_000,
    });
  });
});

describe('classifyFetchFailure', () => {
  it('classifies a network failure (fetch itself throwing) as Offline', () => {
    const result = classifyFetchFailure(new TypeError('Failed to fetch'));

    expect(result).toEqual({ kind: 'Offline' });
  });

  it('returns null for a user-initiated abort — not an error state, ticket 7 already handles it', () => {
    const abortError = new DOMException('The user aborted a request.', 'AbortError');

    const result = classifyFetchFailure(abortError);

    expect(result).toBeNull();
  });
});

describe('classifyFetchFailure — abort shapes', () => {
  it('recognises an abort that is a plain Error, not a DOMException — what React Native actually throws', () => {
    const abortError = Object.assign(new Error('Aborted'), { name: 'AbortError' });

    expect(classifyFetchFailure(abortError)).toBeNull();
  });
});

describe('toDomainError for tenant-level resources', () => {
  it('maps 403 to AccessDenied — the Qlik User may not list this resource; it says nothing about Answers', () => {
    expect(toDomainError(fakeResponse(403), 'tenant')).toEqual({ kind: 'AccessDenied' });
  });

  it('maps 404 to ServiceUnavailable — there is no misconfigured Assistant to blame', () => {
    expect(toDomainError(fakeResponse(404), 'tenant')).toEqual({ kind: 'ServiceUnavailable' });
  });

  it('shares 401, 429 and 5xx with Assistant requests', () => {
    expect(toDomainError(fakeResponse(401), 'tenant')).toEqual({ kind: 'SessionExpired' });
    expect(toDomainError(fakeResponse(429), 'tenant')).toEqual({ kind: 'RateLimited', retryAfterMs: 60_000 });
    expect(toDomainError(fakeResponse(503), 'tenant')).toEqual({ kind: 'ServiceUnavailable' });
  });
});
