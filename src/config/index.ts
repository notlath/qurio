import { loadDevConfig } from './development';
import { loadManagedConfig } from './load-managed-config';
import { resolveTenantConfig } from './resolver';
import type { TenantConfig } from './types';

export async function resolveCurrentTenantConfig(): Promise<TenantConfig | null> {
  const managed = await loadManagedConfig();
  const dev = await loadDevConfig();
  return resolveTenantConfig({ managed, dev });
}

export { IS_INTERNAL_BUILD, loadDevConfig, saveDevConfig } from './development';
export { validateTenantHost } from './preflight';
export { normalizeTenantHost, resolveTenantConfig } from './resolver';
export type { TenantConfig } from './types';
