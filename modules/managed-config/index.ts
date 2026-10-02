import { requireNativeModule } from 'expo-modules-core';

type ManagedConfigModule = {
  getManagedConfigAsync(): Promise<Record<string, unknown>>;
};

// Android only — modules/managed-config has no iOS implementation (see
// expo-module.config.json). src/config/load-managed-config.ios.ts uses react-native's
// Settings API instead, per technical-proposal.md §4.
const nativeModule = requireNativeModule<ManagedConfigModule>('ManagedConfig');

export async function getManagedConfigAsync(): Promise<Record<string, unknown>> {
  return nativeModule.getManagedConfigAsync();
}
