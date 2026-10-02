import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TenantConfig } from './types';

const STORAGE_KEY = 'qlik.devTenantConfig';

/** Never true in a release build — see docs/dev-build-runbook.md. */
export const IS_INTERNAL_BUILD = __DEV__;

export async function loadDevConfig(): Promise<Partial<TenantConfig> | undefined> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return undefined;
  return JSON.parse(raw) as Partial<TenantConfig>;
}

export async function saveDevConfig(config: Partial<TenantConfig>): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
