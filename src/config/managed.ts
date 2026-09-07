import type { TenantConfig } from './types';

function stringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function positiveIntField(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export function normalizeManagedConfig(raw: unknown): Partial<TenantConfig> | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const record = raw as Record<string, unknown>;

  const config: Partial<TenantConfig> = {};
  const tenantHost = stringField(record, 'tenantHost');
  const clientId = stringField(record, 'clientId');
  const assistantId = stringField(record, 'assistantId');
  if (tenantHost) config.tenantHost = tenantHost;
  if (clientId) config.clientId = clientId;
  if (assistantId) config.assistantId = assistantId;
  const biometricTimeoutMs = positiveIntField(record, 'biometricTimeoutMs');
  if (biometricTimeoutMs !== undefined) config.biometricTimeoutMs = biometricTimeoutMs;

  return config;
}
