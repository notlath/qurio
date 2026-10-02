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

  describe('agenticAssistantId', () => {
    const base = { tenantHost: 'acme.eu.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

    it('is passed through from a complete managed config', () => {
      const result = resolveTenantConfig({ managed: { ...base, agenticAssistantId: 'agentic-1' } });

      expect(result?.agenticAssistantId).toBe('agentic-1');
    });

    it('is cleaned like every other identifier', () => {
      const result = resolveTenantConfig({ managed: { ...base, agenticAssistantId: `\tagentic${NUL}-1\n` } });

      expect(result?.agenticAssistantId).toBe('agentic-1');
    });

    it('is absent, not an empty string, when it is empty after cleaning', () => {
      const result = resolveTenantConfig({ managed: { ...base, agenticAssistantId: `${NUL} ${ZERO_WIDTH_SPACE}` } });

      expect(result).toEqual(base);
      expect(result).not.toHaveProperty('agenticAssistantId');
    });

    it('is not filled in from a dev config when complete managed config omits it', () => {
      // The dev entry may name a different Tenant, so its Assistant must never leak into MDM's.
      const result = resolveTenantConfig({
        managed: base,
        dev: { ...base, tenantHost: 'dev.eu.qlikcloud.com', agenticAssistantId: 'dev-agentic' },
      });

      expect(result).toEqual(base);
    });

    it('comes from the dev config when it is the source used', () => {
      const result = resolveTenantConfig({ managed: undefined, dev: { ...base, agenticAssistantId: 'dev-agentic' } });

      expect(result?.agenticAssistantId).toBe('dev-agentic');
    });

    it('does not make an otherwise complete config incomplete when absent', () => {
      expect(resolveTenantConfig({ managed: base })).toEqual(base);
    });
  });

  it('returns null when neither source is complete', () => {
    const result = resolveTenantConfig({ managed: undefined, dev: { tenantHost: 'dev.eu.qlikcloud.com' } });

    expect(result).toBeNull();
  });
});
