import { Settings } from 'react-native';

import { normalizeManagedConfig } from './managed';
import type { TenantConfig } from './types';

// Settings.get is react-native's own bridge to NSUserDefaults — zero new dependency, per
// technical-proposal.md §4. Declaring the privacy-manifest reason (AC6B.1) for this read
// is already in place (app.json, ticket 12).
export async function loadManagedConfig(): Promise<Partial<TenantConfig> | undefined> {
  return normalizeManagedConfig(Settings.get('com.apple.configuration.managed'));
}
