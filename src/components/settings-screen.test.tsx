import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

import SettingsScreen from '@/app/settings';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/config/context', () => ({
  useTenantConfig: () => ({ config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client' }, managed: false, reloadConfig: jest.fn() }),
}));
jest.mock('@/auth/access-token', () => ({ expireAccessTokenNow: jest.fn() }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
// The web build resolves session.web.ts, which throws by design (ADR-0005).
jest.mock('@/auth/session', () => jest.requireActual('@/auth/session.web'));
jest.setTimeout(30000);

const originalOS = Platform.OS;
afterEach(() => Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true }));

it('renders on web with a resolved, unmanaged Tenant Configuration', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<SettingsScreen />); });
  const tree = JSON.stringify(renderer.toJSON());
  expect(tree).toContain('acme.sg.qlikcloud.com');
  expect(tree).not.toContain('Change tenant');
});
