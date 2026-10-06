import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';

import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ChangeTenant, HostnameEntry, TenantEntryGate } from './tenant-entry';
import { TenantConfigForm } from './tenant-config-form';

jest.mock('@/global.css', () => ({}));
jest.setTimeout(30000);
const mockClearConfig = jest.fn();
const mockSignOut = jest.fn();
let mockConfig: { tenantHost: string; clientId: string } | null = null;
jest.mock('@/config/context', () => ({ useTenantConfig: () => ({ config: mockConfig, reloadConfig: jest.fn(), clearConfig: mockClearConfig }) }));
jest.mock('@/auth/access-token', () => ({ hasSession: jest.fn().mockResolvedValue(false) }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
jest.mock('@/config', () => ({
  normalizeTenantHost: jest.requireActual('@/config/resolver').normalizeTenantHost,
  validateTenantHost: jest.fn().mockResolvedValue({ ok: true }),
  saveDevConfig: jest.fn(),
  loadDevConfig: jest.fn().mockResolvedValue(undefined),
  IS_INTERNAL_BUILD: false,
}));
jest.mock('@/auth/session', () => ({ useQlikAuth: () => ({ signOut: mockSignOut, signIn: jest.fn(), ready: true }) }));

it('explains a custom domain before attempting sign-in', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('qlik.acme.com'); });
  await act(async () => { await renderer.root.findByType(PrimaryButton).props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain('custom domain');
});

it('hides the manual connection form in a release build', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  expect(renderer.root.findAllByType(TenantConfigForm)).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Developer');
});

it('shows the manual override under Developer in an internal build', async () => {
  const configuration = jest.requireMock('@/config');
  configuration.IS_INTERNAL_BUILD = true;
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  await act(async () => {
    renderer.root.findAllByType(AppPressable).find((button) => button.props.accessibilityLabel === 'Developer')!.props.onPress();
  });
  expect(renderer.root.findAllByType(TenantConfigForm)).toHaveLength(1);
  configuration.IS_INTERNAL_BUILD = false;
});

it('requests sign-in directly for a configured Tenant without a session', async () => {
  mockConfig = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<TenantEntryGate><TextInput accessibilityLabel="App content" /></TenantEntryGate>); });
  expect(renderer.root.findAllByType(HostnameEntry)).toHaveLength(0);
  expect(JSON.stringify(renderer.toJSON())).toContain('Sign in');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('App content');
  mockConfig = null;
});

it('explains an unsupported region', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('acme.eu.qlikcloud.com'); });
  await act(async () => { await renderer.root.findByType(PrimaryButton).props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain('not supported');
});

it('shows the existing unreachable Tenant preflight message', async () => {
  const { validateTenantHost } = jest.requireMock('@/config');
  validateTenantHost.mockResolvedValueOnce({ ok: false, field: 'tenantHost', message: 'Could not reach "acme.sg.qlikcloud.com".' });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('acme.sg.qlikcloud.com'); });
  await act(async () => { await renderer.root.findByType(PrimaryButton).props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Could not reach');
});

it('signs out before it clears the old Tenant', async () => {
  const calls: string[] = [];
  mockSignOut.mockImplementation(async () => { calls.push('sign-out'); });
  mockClearConfig.mockImplementation(async () => { calls.push('clear-tenant'); });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<ChangeTenant config={{ tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client' }} />); });
  await act(async () => { await renderer.root.findByType(AppPressable).props.onPress(); });
  expect(calls).toEqual(['sign-out', 'clear-tenant']);
});
