import { qlikFetch, qlikJson, qlikUrl, type HttpResponse } from './http';

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

describe('qlikUrl', () => {
  it('roots a relative path at the configured tenant and assistant', () => {
    expect(qlikUrl(config, '/threads')).toBe(
      'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1/threads',
    );
  });

  it('roots an /api/ path at the tenant, not the assistant — Items live outside the Assistant', () => {
    expect(qlikUrl(config, '/api/v1/items?resourceType=app')).toBe(
      'https://acme.eu.qlikcloud.com/api/v1/items?resourceType=app',
    );
  });

  it('passes an absolute url on the configured tenant through — Qlik returns whole hrefs in links.next, not bare cursors', () => {
    const href = 'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1/threads?next=abc';

    expect(qlikUrl(config, href)).toBe(href);
  });

  it('refuses an Assistant path before an Assistant is chosen', () => {
    const { assistantId: _, ...hostnameOnly } = config;

    expect(() => qlikUrl(hostnameOnly, '/threads')).toThrow(expect.objectContaining({ kind: 'AssistantNotChosen' }));
  });

  it('still roots an /api/ path at the tenant before an Assistant is chosen', () => {
    const { assistantId: _, ...hostnameOnly } = config;

    expect(qlikUrl(hostnameOnly, '/api/v1/items')).toBe('https://acme.eu.qlikcloud.com/api/v1/items');
  });

  it.each([
    ['another host', 'https://evil.example.com/api/v1/items?next=abc'],
    ['a look-alike prefix', 'https://acme.eu.qlikcloud.com.evil.example.com/api/v1/items'],
    ['credentials in the authority', 'https://acme.eu.qlikcloud.com@evil.example.com/api/v1/items'],
    ['plain http', 'http://acme.eu.qlikcloud.com/api/v1/items'],
  ])('refuses an absolute url on %s, so the bearer token cannot be sent off the tenant', (_label, href) => {
    expect(() => qlikUrl(config, href)).toThrow(expect.objectContaining({ kind: 'ServiceUnavailable' }));
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

  it('never reaches the network for an Assistant call before an Assistant is chosen', async () => {
    const fetch = jest.fn();
    const { assistantId: _, ...hostnameOnly } = config;

    await expect(qlikFetch(deps(fetch), hostnameOnly, '/threads')).rejects.toEqual({ kind: 'AssistantNotChosen' });
    expect(fetch).not.toHaveBeenCalled();
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

describe('qlikFetch off-tenant protection', () => {
  it('does not call the network, nor spend a token, for an off-tenant url', async () => {
    const fetch = jest.fn();
    const getToken = jest.fn(async () => 'access-1');

    await expect(
      qlikFetch({ fetch, getToken }, config, 'https://evil.example.com/api/v1/items?next=abc'),
    ).rejects.toEqual({ kind: 'ServiceUnavailable' });

    expect(fetch).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });
});

describe('qlikFetch error scope', () => {
  it('maps a tenant-level 403 to AccessDenied, not to missing Answers entitlement', async () => {
    const fetch = jest.fn().mockResolvedValue(response(403));

    await expect(qlikFetch(deps(fetch), config, '/api/v1/items')).rejects.toEqual({ kind: 'AccessDenied' });
  });

  it('keeps the Assistant 403 as NotEntitled', async () => {
    const fetch = jest.fn().mockResolvedValue(response(403));

    await expect(qlikFetch(deps(fetch), config, '/threads')).rejects.toEqual({ kind: 'NotEntitled' });
  });

  it('scopes a followed absolute next link by what it points at', async () => {
    const fetch = jest.fn().mockResolvedValue(response(403));
    const nextItems = 'https://acme.eu.qlikcloud.com/api/v1/items?next=abc';

    await expect(qlikFetch(deps(fetch), config, nextItems)).rejects.toEqual({ kind: 'AccessDenied' });
  });
});
