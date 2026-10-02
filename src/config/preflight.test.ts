import { validateTenantHost } from './preflight';

describe('validateTenantHost', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('accepts a host that serves the OAuth authorization-server metadata document', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 }) as typeof fetch;

    const result = await validateTenantHost('acme.eu.qlikcloud.com');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://acme.eu.qlikcloud.com/.well-known/oauth-authorization-server',
    );
    expect(result).toEqual({ ok: true });
  });

  it('rejects a host that returns a non-ok response, naming the field and the status', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as typeof fetch;

    const result = await validateTenantHost('typo.eu.qlikcloud.com');

    expect(result).toEqual({
      ok: false,
      field: 'tenantHost',
      message: expect.stringContaining('404'),
    });
  });

  it('rejects an unreachable host, naming the field', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as typeof fetch;

    const result = await validateTenantHost('unreachable.example.com');

    expect(result).toMatchObject({ ok: false, field: 'tenantHost' });
  });
});
