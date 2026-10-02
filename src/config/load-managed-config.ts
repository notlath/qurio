import type { TenantConfig } from './types';

// Unreachable at runtime: ios/android/web each ship their own load-managed-config.*.ts,
// and Metro always resolves the platform-specific file first. This bare file exists only
// so tsc — which has no platform resolution — has a module to type-check against.
export async function loadManagedConfig(): Promise<Partial<TenantConfig> | undefined> {
  throw new Error('loadManagedConfig has no platform-specific implementation for this build target.');
}
