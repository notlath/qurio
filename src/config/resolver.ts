import type { TenantConfig } from './types';

type PartialTenantConfig = Partial<TenantConfig>;

const IDENTIFIER_FIELDS = ['tenantHost', 'clientId', 'assistantId', 'agenticAssistantId'] as const;
/** Whitespace and every Unicode control/format character, anywhere in the value. */
const NOT_IDENTIFIER = /[\p{C}\s]/gu;

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
  // Optional: nothing left after cleaning means "not configured", never an empty-string id.
  if (!cleaned.agenticAssistantId) delete cleaned.agenticAssistantId;
  return cleaned;
}

function isComplete(config?: PartialTenantConfig): config is TenantConfig {
  return !!config?.tenantHost && !!config.clientId && !!config.assistantId;
}

/**
 * One tenant configuration value regardless of source. Precedence: managed
 * (MDM, ticket 14) wins when complete, otherwise the development entry
 * screen's value, otherwise null (ConfigMissing) — this is the slot ticket
 * 14 fills in without a second configuration architecture.
 */
export function resolveTenantConfig(sources: {
  managed?: PartialTenantConfig;
  dev?: PartialTenantConfig;
}): TenantConfig | null {
  const managed = clean(sources.managed);
  const dev = clean(sources.dev);
  if (isComplete(managed)) return managed;
  if (isComplete(dev)) return dev;
  return null;
}
