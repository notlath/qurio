import type { TenantConfig, TenantResolution } from './types';

type PartialTenantConfig = Partial<TenantConfig>;
/** `managed` is the MDM payload. `dev` is the typed entry on the Settings screen. */
type TenantSources = { managed?: PartialTenantConfig; dev?: PartialTenantConfig };

/** MTC's published Native OAuth client in each Qlik Cloud region (ADR-0010). Add a region by adding its client ID. */
const PUBLISHED_CLIENT_IDS: Record<string, string> = {
  ap: '01a10a79d20b4352bf7e0596e383407e',
  sg: '01a107a4b62d66ffc82d0ffc7e6b1098',
};
/** "<name>.<region>.qlikcloud.com". A custom domain, or a hostname with no region, does not match. */
const REGIONAL_HOST =/^[^.]+\.([^.]+)\.qlikcloud\.com$/;

const IDENTIFIER_FIELDS = ['tenantHost', 'clientId', 'assistantId', 'agenticAssistantId'] as const;
/** Whitespace and every Unicode control/format character, anywhere in the value. */
const NOT_IDENTIFIER = /[\p{C}\s]/gu;

/** A pasted browser URL ("https://acme.eu.qlikcloud.com/") reduced to the bare host the config stores. */
export function normalizeTenantHost(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '').toLowerCase();
}

/**
 * None of these can legitimately contain whitespace or a control character, and both
 * sources are pastes: an MDM payload, or a hand-entered value on the dev screen. A trailing
 * NUL survived `.trim()` (U+0000 is not whitespace) and reached the tenant as
 * `client_id=...%00`, which Qlik rejected as an invalid client — a failure with no visible
 * cause at the point of entry. Cleaned once here, where every source converges.
 */
function clean(config?: PartialTenantConfig): PartialTenantConfig | undefined {
  if (!config) return config;
  const cleaned = { ...config };
  for (const field of IDENTIFIER_FIELDS) {
    const value = cleaned[field];
    if (value) cleaned[field] = value.replace(NOT_IDENTIFIER, '');
  }
  if (cleaned.tenantHost) cleaned.tenantHost = normalizeTenantHost(cleaned.tenantHost);
  // Optional: nothing left after cleaning means "not configured", never an empty-string id.
  if (!cleaned.assistantId) delete cleaned.assistantId;
  if (!cleaned.agenticAssistantId) delete cleaned.agenticAssistantId;
  return cleaned;
}

/** One source on its own: a client ID it supplies wins over the built-in one for its region. */
function resolveSource(source?: PartialTenantConfig): TenantResolution {
  const config = clean(source);
  if (!config?.tenantHost) return { kind: 'not-configured' };
  const { tenantHost } = config;
  const region = REGIONAL_HOST.exec(tenantHost)?.[1];
  const clientId = config.clientId || (region ? PUBLISHED_CLIENT_IDS[region] : undefined);
  if (clientId) return { kind: 'resolved', config: { ...config, tenantHost, clientId } };
  if (!region) return { kind: 'custom-domain', tenantHost };
  return { kind: 'unsupported-region', tenantHost, region };
}

/**
 * One tenant configuration regardless of source. Each source resolves on its own, so a
 * value from one source never fills a gap in the other. Precedence: managed (MDM) wins when
 * it resolves, otherwise the typed entry (`dev`). When neither resolves, this function
 * reports the managed failure if MDM sent a hostname, because the device must reach that Tenant.
 */
export function resolveTenant(sources: TenantSources): TenantResolution {
  const managed = resolveSource(sources.managed);
  if (managed.kind === 'resolved') return managed;
  const dev = resolveSource(sources.dev);
  return dev.kind === 'resolved' || managed.kind === 'not-configured' ? dev : managed;
}

/**
 * The first source that resolves with an assistantId, or null (ConfigMissing). Callers still
 * need an assistantId, so this keeps the old precedence until the Assistant is chosen after
 * sign-in (#3, #4).
 */
export function resolveTenantConfig(sources: TenantSources): TenantConfig | null {
  for (const source of [sources.managed, sources.dev]) {
    const resolution = resolveSource(source);
    if (resolution.kind === 'resolved' && resolution.config.assistantId) {
      return { ...resolution.config, assistantId: resolution.config.assistantId };
    }
  }
  return null;
}
