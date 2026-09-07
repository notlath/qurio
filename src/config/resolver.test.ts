import { resolveTenantConfig } from './resolver';

const NUL = String.fromCharCode(0);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

describe('resolveTenantConfig', () => {
  it('returns the managed config when it is complete', () => {
    const managed = { tenantHost: 'acme.eu.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

    const result = resolveTenantConfig({ managed, dev: undefined });

    expect(result).toEqual(managed);
  });

  it('falls back to the dev config when managed is missing', () => {
    const dev = { tenantHost: 'dev.eu.qlikcloud.com', clientId: 'client-2', assistantId: 'assistant-2' };

    const result = resolveTenantConfig({ managed: undefined, dev });

    expect(result).toEqual(dev);
  });

  it('falls back to the dev config when managed is incomplete', () => {
    const dev = { tenantHost: 'dev.eu.qlikcloud.com', clientId: 'client-2', assistantId: 'assistant-2' };

    const result = resolveTenantConfig({ managed: { tenantHost: 'acme.eu.qlikcloud.com' }, dev });

    expect(result).toEqual(dev);
  });

  it('strips a NUL that survived .trim() — it reached the tenant as client_id=...%00 and was rejected', () => {
    const dev = {
      tenantHost: 'dev.eu.qlikcloud.com',
      clientId: `client-2${NUL}`,
      assistantId: 'assistant-2',
    };

    const result = resolveTenantConfig({ managed: undefined, dev });

    expect(result?.clientId).toBe('client-2');
  });

  it('strips stray whitespace and control characters from every identifier, whatever the source', () => {
    const managed = {
      tenantHost: ' acme.eu.qlikcloud.com\n',
      clientId: `\tclient-1${ZERO_WIDTH_SPACE}`,
      assistantId: 'assistant\r\n-1',
    };

    const result = resolveTenantConfig({ managed, dev: undefined });

    expect(result).toEqual({
      tenantHost: 'acme.eu.qlikcloud.com',
      clientId: 'client-1',
      assistantId: 'assistant-1',
    });
  });

  it('returns null when neither source is complete', () => {
    const result = resolveTenantConfig({ managed: undefined, dev: { tenantHost: 'dev.eu.qlikcloud.com' } });

    expect(result).toBeNull();
  });
});
