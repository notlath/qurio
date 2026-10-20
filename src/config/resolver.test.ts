import { normalizeTenantHost, resolveTenant, resolveTenantConfig } from './resolver';

const NUL = String.fromCharCode(0);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const SG_CLIENT_ID = '01a107a4b62d66ffc82d0ffc7e6b1098';
const METADATA_CLIENT_ID = 'https://notlath.github.io/qurio-oauth/client.json';

describe('resolveTenant', () => {
  it('resolves a hostname alone with the published client ID for its region', () => {
    expect(resolveTenant({ dev: { tenantHost: 'acme.sg.qlikcloud.com' } })).toEqual({
      kind: 'resolved',
      config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID },
    });
  });

  it('resolves an ap hostname with the ap published client ID', () => {
    expect(resolveTenant({ dev: { tenantHost: 'acme.ap.qlikcloud.com' } })).toEqual({
      kind: 'resolved',
      config: { tenantHost: 'acme.ap.qlikcloud.com', clientId: '01a10a79d20b4352bf7e0596e383407e' },
    });
  });

  it('resolves a us hostname with the us published client ID', () => {
    expect(resolveTenant({ dev: { tenantHost: 'acme.us.qlikcloud.com' } })).toEqual({
      kind: 'resolved',
      config: { tenantHost: 'acme.us.qlikcloud.com', clientId: '01a15572dafb71aabe306ae5e87c3f95' },
    });
  });

  it('resolves a pasted browser URL', () => {
    const result = resolveTenant({ dev: { tenantHost: 'https://Acme.SG.qlikcloud.com/' } });

    expect(result).toEqual({
      kind: 'resolved',
      config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID },
    });
  });

  it('uses the managed hostname over the typed one', () => {
    const result = resolveTenant({
      managed: { tenantHost: 'mdm.sg.qlikcloud.com' },
      dev: { tenantHost: 'typed.sg.qlikcloud.com' },
    });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'mdm.sg.qlikcloud.com', clientId: SG_CLIENT_ID } });
  });

  it('uses a supplied client ID over the built-in one', () => {
    const result = resolveTenant({ managed: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'own-client' } });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'own-client' } });
  });

  it('never applies one source’s client ID to the other source’s hostname', () => {
    const result = resolveTenant({
      managed: { tenantHost: 'mdm.sg.qlikcloud.com' },
      dev: { tenantHost: 'typed.sg.qlikcloud.com', clientId: 'typed-client' },
    });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'mdm.sg.qlikcloud.com', clientId: SG_CLIENT_ID } });
  });

  it('passes the assistant IDs through when the source has them', () => {
    const result = resolveTenant({
      managed: { tenantHost: 'acme.sg.qlikcloud.com', assistantId: 'a', agenticAssistantId: 'g' },
    });

    expect(result).toEqual({
      kind: 'resolved',
      config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID, assistantId: 'a', agenticAssistantId: 'g' },
    });
  });

  it('leaves out an assistant ID that is empty after cleaning', () => {
    const result = resolveTenant({ dev: { tenantHost: 'acme.sg.qlikcloud.com', assistantId: `${NUL} ` } });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID } });
  });

  it.each(['qlik.acme.com', 'acme.qlikcloud.com'])('reports %s as a custom domain: it names no region', (host) => {
    expect(resolveTenant({ dev: { tenantHost: host } })).toEqual({ kind: 'custom-domain', tenantHost: host });
  });

  it('resolves a custom domain when a client ID is supplied', () => {
    const result = resolveTenant({ managed: { tenantHost: 'qlik.acme.com', clientId: 'own-client' } });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'qlik.acme.com', clientId: 'own-client' } });
  });

  it.each(['acme.eu.qlikcloud.com', 'acme.jp.qlikcloud.com', 'alias.de.qlikcloud.com'])(
    'resolves %s with the metadata client: no published client exists in its region',
    (host) => {
      expect(resolveTenant({ dev: { tenantHost: host } })).toEqual({
        kind: 'resolved',
        config: { tenantHost: host, clientId: METADATA_CLIENT_ID },
      });
    },
  );

  it.each([{}, { managed: {}, dev: {} }, { dev: { tenantHost: ` ${NUL}` } }])('is not configured without a hostname', (sources) => {
    expect(resolveTenant(sources)).toEqual({ kind: 'not-configured' });
  });

  it('falls back to the typed hostname when the managed one does not resolve', () => {
    const result = resolveTenant({
      managed: { tenantHost: 'qlik.acme.com' },
      dev: { tenantHost: 'typed.sg.qlikcloud.com' },
    });

    expect(result).toEqual({ kind: 'resolved', config: { tenantHost: 'typed.sg.qlikcloud.com', clientId: SG_CLIENT_ID } });
  });

  it('reports the managed failure when neither source resolves', () => {
    const result = resolveTenant({ managed: { tenantHost: 'qlik.acme.com' }, dev: { tenantHost: 'other.acme.com' } });

    expect(result).toEqual({ kind: 'custom-domain', tenantHost: 'qlik.acme.com' });
  });

  it('reports the typed failure when there is no managed hostname', () => {
    expect(resolveTenant({ managed: {}, dev: { tenantHost: 'qlik.acme.com' } })).toEqual({
      kind: 'custom-domain',
      tenantHost: 'qlik.acme.com',
    });
  });
});

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

    const result = resolveTenantConfig({ managed: { tenantHost: 'qlik.acme.com' }, dev });

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

  it('fills in the published client ID when the source has a hostname and an assistant ID', () => {
    const result = resolveTenantConfig({ dev: { tenantHost: 'acme.sg.qlikcloud.com', assistantId: 'a' } });

    expect(result).toEqual({ tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID, assistantId: 'a' });
  });

  it('uses a managed hostname without an assistant ID over a complete dev config — MDM decides the Tenant', () => {
    const dev = { tenantHost: 'dev.eu.qlikcloud.com', clientId: 'client-2', assistantId: 'assistant-2' };

    const result = resolveTenantConfig({ managed: { tenantHost: 'acme.sg.qlikcloud.com' }, dev });

    expect(result).toEqual({ tenantHost: 'acme.sg.qlikcloud.com', clientId: SG_CLIENT_ID });
  });

  it('resolves a hostname alone — the Assistant is chosen after sign-in', () => {
    expect(resolveTenantConfig({ dev: { tenantHost: 'acme.sg.qlikcloud.com' } })).toEqual({
      tenantHost: 'acme.sg.qlikcloud.com',
      clientId: SG_CLIENT_ID,
    });
  });

  it('returns null when neither source is complete', () => {
    const result = resolveTenantConfig({ managed: undefined, dev: { tenantHost: 'qlik.acme.com' } });

    expect(result).toBeNull();
  });
});

describe('normalizeTenantHost', () => {
  it.each([
    ['https://acme.eu.qlikcloud.com/', 'acme.eu.qlikcloud.com'],
    ['HTTP://Acme.eu.qlikcloud.com', 'acme.eu.qlikcloud.com'],
    ['https://acme.eu.qlikcloud.com/console/home?x=1', 'acme.eu.qlikcloud.com'],
    ['acme.eu.qlikcloud.com/', 'acme.eu.qlikcloud.com'],
  ])('turns the pasted %s into a bare hostname', (pasted, host) => {
    expect(normalizeTenantHost(pasted)).toBe(host);
  });

  it('is applied to a pasted URL in the resolved config', () => {
    const dev = { tenantHost: 'https://dev.eu.qlikcloud.com/', clientId: 'c', assistantId: 'a' };

    expect(resolveTenantConfig({ managed: undefined, dev })?.tenantHost).toBe('dev.eu.qlikcloud.com');
  });
});
