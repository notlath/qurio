import type { TenantConfig } from './types';

// No managed-configuration source exists on web — the dev entry screen is the only
// configuration path there (ADR-0005 already treats web as development-only).
export async function loadManagedConfig(): Promise<Partial<TenantConfig> | undefined> {
  return undefined;
}
