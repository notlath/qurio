import { assistantUrl, qlikFetch, qlikJson, type HttpResponse } from './http';

const config = { tenantHost: 'acme.eu.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

function response(status: number, body: unknown = {}, headers: Record<string, string> = {}): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    json: async () => body,
  };
}

function deps(fetch: jest.Mock, token: string | null = 'access-1') {
  return { fetch, getToken: async () => token };
}

describe('assistantUrl', () => {
  it('roots a relative path at the configured tenant and assistant', () => {
    expect(assistantUrl(config, '/threads')).toBe(
      'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1/threads',
    );
  });

  it('passes an absolute url through — Qlik returns whole hrefs in links.next, not bare cursors', () => {
    const href = 'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1/threads?next=abc';

    expect(assistantUrl(config, href)).toBe(href);
  });
});

describe('qlikFetch', () => {
  it('sends the bearer token and JSON headers', async () => {
    const fetch = jest.fn().mockResolvedValue(response(200));

    await qlikFetch(deps(fetch), config, '/threads');

    expect(fetch).toHaveBeenCalledWith(
      'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1/threads',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1', Accept: 'application/json' }),
      }),
    );
  });

  it('never reaches the network without a token — an expired session is not a request to send', async () => {
    const fetch = jest.fn();

    await expect(qlikFetch(deps(fetch, null), config, '/threads')).rejects.toEqual({ kind: 'SessionExpired' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [401, { kind: 'SessionExpired' }],
    [403, { kind: 'NotEntitled' }],
    [404, { kind: 'AssistantNotFound' }],
    [429, { kind: 'RateLimited', retryAfterMs: 60_000 }],
    // fixture 07: malformed request bodies come back as a bare 500 with no `errors` array at all
    [500, { kind: 'ServiceUnavailable' }],
  ])('maps HTTP %i to a curated domain error', async (status, expected) => {
    const fetch = jest.fn().mockResolvedValue(response(status));

    await expect(qlikFetch(deps(fetch), config, '/threads')).rejects.toEqual(expected);
  });

  it('maps a network failure to Offline', async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(qlikFetch(deps(fetch), config, '/threads')).rejects.toEqual({ kind: 'Offline' });
  });

  it('rethrows an abort untouched — a Stop tap is the caller\u2019s business, not an error to display', async () => {
    const abort = Object.assign(new Error('Aborted'), { name: 'AbortError' });
    const fetch = jest.fn().mockRejectedValue(abort);

    await expect(qlikFetch(deps(fetch), config, '/threads')).rejects.toBe(abort);
  });
});

describe('qlikJson', () => {
  it('returns the parsed body', async () => {
    const fetch = jest.fn().mockResolvedValue(response(200, { data: [{ id: 'thread-1' }] }));

    await expect(qlikJson(deps(fetch), config, '/threads')).resolves.toEqual({ data: [{ id: 'thread-1' }] });
  });

  it('serialises a body and sets the method', async () => {
    const fetch = jest.fn().mockResolvedValue(response(201, { id: 'thread-1' }));

    await qlikJson(deps(fetch), config, '/threads', { method: 'POST', body: { name: 'New thread' } });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST', body: '{"name":"New thread"}' }),
    );
  });
});
