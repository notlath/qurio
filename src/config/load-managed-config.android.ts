import { getManagedConfigAsync } from '../../modules/managed-config';

import { normalizeManagedConfig } from './managed';
import type { TenantConfig } from './types';

// modules/managed-config wraps RestrictionsManager — the only Android API for reading
// managed app configuration, with no first-party Expo module (technical-proposal.md §4).
export async function loadManagedConfig(): Promise<Partial<TenantConfig> | undefined> {
  return normalizeManagedConfig(await getManagedConfigAsync());
}
