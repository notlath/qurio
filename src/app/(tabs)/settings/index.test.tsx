import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

import SettingsScreen from './index';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
jest.mock('@/components/lock-gate', () => ({
  usePrivacyLock: () => ({ enabled: false, saving: false, setEnabled: jest.fn(), saveError: null }),
}));
jest.mock('@/config/screen-capture', () => ({
  loadAllowScreenshots: jest.fn().mockResolvedValue(false),
  setAllowScreenshots: jest.fn(),
}));
jest.mock('@/config/context', () => ({
  useTenantConfig: () => ({
    config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1' },
    managed: false,
    reloadConfig: jest.fn(),
    clearConfig: jest.fn(),
  }),
}));
jest.mock('@/auth/session', () => ({
  useQlikAuth: () => {
    if (jest.requireActual<typeof import('react-native')>('react-native').Platform.OS === 'web') {
      throw new Error('Qlik authentication is native-only');
    }
    return { signIn: jest.fn(), signOut: jest.fn(), ready: true };
  },
}));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));

const originalPlatform = Platform.OS;

afterEach(() => {
  Platform.OS = originalPlatform;
});

it('renders Settings for an unmanaged Tenant on web without invoking native authentication', async () => {
  Platform.OS = 'web';
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(<SettingsScreen />);
  });

  const output = JSON.stringify(renderer.toJSON());
  expect(output).toContain('Sign-in unavailable');
  expect(output).toContain('acme.sg.qlikcloud.com');
});

it.each(['ios', 'android'] as const)('keeps Change tenant available on %s', async (platform) => {
  Platform.OS = platform;
  let renderer!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    renderer = TestRenderer.create(<SettingsScreen />);
  });

  expect(JSON.stringify(renderer.toJSON())).toContain('Change tenant');
});
