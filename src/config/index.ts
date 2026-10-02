import { IS_INTERNAL_BUILD, loadDevConfig } from './development';
import { loadManagedConfig } from './load-managed-config';
import { resolveTenantConfig } from './resolver';
import type { TenantConfig } from './types';

export async function resolveCurrentTenantConfig(): Promise<TenantConfig | null> {
  const managed = await loadManagedConfig();
  const dev = IS_INTERNAL_BUILD ? await loadDevConfig() : undefined;
  return resolveTenantConfig({ managed, dev });
}

export { IS_INTERNAL_BUILD, loadDevConfig, saveDevConfig } from './development';
export { validateTenantHost } from './preflight';
export { resolveTenantConfig } from './resolver';
export type { TenantConfig } from './types';
