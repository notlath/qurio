import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { BackHandler, ScrollView, StyleSheet, TextInput } from 'react-native';

import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ChangeTenant, HostnameEntry, TenantEntryGate } from './tenant-entry';
import { TenantConfigForm } from './tenant-config-form';
import { Colors } from '@/constants/theme';

jest.mock('@/global.css', () => ({}));
jest.setTimeout(30000);
const mockSignOut = jest.fn();
let mockConfig: { tenantHost: string; clientId: string } | null = null;
jest.mock('@/config/context', () => ({ useTenantConfig: () => ({ config: mockConfig, reloadConfig: jest.fn() }) }));
jest.mock('@/auth/access-token', () => ({ hasSession: jest.fn().mockResolvedValue(false) }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
jest.mock('@/config', () => ({
  normalizeTenantHost: jest.requireActual('@/config/resolver').normalizeTenantHost,
  validateTenantHost: jest.fn().mockResolvedValue({ ok: true }),
  saveDevConfig: jest.fn(),
  loadDevConfig: jest.fn().mockResolvedValue(undefined),
  IS_INTERNAL_BUILD: false,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
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

it('shows the existing unreachable Tenant preflight message', async () => {
  const { validateTenantHost } = jest.requireMock('@/config');
  validateTenantHost.mockResolvedValueOnce({ ok: false, field: 'tenantHost', message: 'Could not reach "acme.sg.qlikcloud.com".' });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });
  await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('acme.sg.qlikcloud.com'); });
  await act(async () => { await renderer.root.findByType(PrimaryButton).props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Could not reach');
});

describe('Change tenant', () => {
  const current = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client' };
  async function openChangeTenant() {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<ChangeTenant config={current} />); });
    await act(async () => { renderer.root.findByType(AppPressable).props.onPress(); });
    return renderer;
  }
  const pressable = (renderer: TestRenderer.ReactTestRenderer, label: string) =>
    renderer.root.findAllByType(AppPressable).find((button) => button.props.accessibilityLabel === label);

  beforeEach(() => {
    mockSignOut.mockReset();
  });

  it('keeps the session and the Tenant while the user is choosing a new Tenant', async () => {
    const renderer = await openChangeTenant();

    expect(JSON.stringify(renderer.toJSON())).toContain('Connect to your Tenant');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('returns to the current Tenant, unchanged, when the user selects Back', async () => {
    const renderer = await openChangeTenant();

    await act(async () => { pressable(renderer, 'Back')!.props.onPress(); });

    expect(JSON.stringify(renderer.toJSON())).toContain('Change tenant');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Connect to your Tenant');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('treats the Android system Back like the Back button', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener');
    const renderer = await openChangeTenant();
    const onHardwareBack = listen.mock.calls.at(-1)![1];

    let handled: boolean | null | undefined;
    await act(async () => { handled = (onHardwareBack as () => boolean)(); });

    expect(handled).toBe(true);
    expect(JSON.stringify(renderer.toJSON())).not.toContain('Connect to your Tenant');
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('puts Back above the title', async () => {
    const renderer = await openChangeTenant();
    const text = JSON.stringify(renderer.toJSON());

    expect(text.indexOf('Back')).toBeLessThan(text.indexOf('Connect to your Tenant'));
  });

  it('signs out of the old Tenant only when the user connects to a new one', async () => {
    const { saveDevConfig } = jest.requireMock('@/config');
    const calls: string[] = [];
    mockSignOut.mockImplementation(async () => { calls.push('sign-out'); });
    saveDevConfig.mockImplementation(async () => { calls.push('save-tenant'); });
    const renderer = await openChangeTenant();

    await act(async () => { renderer.root.findByType(TextInput).props.onChangeText('other.sg.qlikcloud.com'); });
    await act(async () => { await renderer.root.findByType(PrimaryButton).props.onPress(); });

    expect(calls).toEqual(['sign-out', 'save-tenant']);
  });

  it('leaves Back to the navigator when no onBack is given', async () => {
    const listen = jest.spyOn(BackHandler, 'addEventListener');
    listen.mockClear();
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HostnameEntry replacing={{ signOut: mockSignOut }} />); });

    expect(pressable(renderer, 'Back')).toBeUndefined();
    expect(listen).not.toHaveBeenCalled();
  });

  it('does not show Back on the first-run Tenant entry', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<HostnameEntry />); });

    expect(pressable(renderer, 'Back')).toBeUndefined();
  });
});

it('paints the theme background behind the sign-in gate', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<TenantEntryGate><TextInput /></TenantEntryGate>); });
  expect(StyleSheet.flatten(renderer.root.findByType(ScrollView).props.style)).toMatchObject({ backgroundColor: Colors.light.background });
});

it('shows only the Tenant form after Change tenant on the sign-in gate', async () => {
  mockConfig = { tenantHost: 'acme.ap.qlikcloud.com', clientId: 'client' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<TenantEntryGate><TextInput /></TenantEntryGate>); });
  await act(async () => {
    renderer.root.findAllByType(AppPressable).find((button) => button.props.accessibilityLabel === 'Change tenant')!.props.onPress();
  });
  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('Connect to your Tenant');
  expect(text).not.toContain('Not signed in');
  mockConfig = null;
});

it('leaves the Tenant form once the gate connects to a new Tenant', async () => {
  mockConfig = { tenantHost: 'acme.ap.qlikcloud.com', clientId: 'client' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<TenantEntryGate><TextInput /></TenantEntryGate>); });
  await act(async () => {
    renderer.root.findAllByType(AppPressable).find((button) => button.props.accessibilityLabel === 'Change tenant')!.props.onPress();
  });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Tenant hostname' }).props.onChangeText('other.sg.qlikcloud.com'); });
  await act(async () => { await renderer.root.findAllByType(PrimaryButton).find((button) => button.props.label === 'Continue')!.props.onPress(); });
  mockConfig = { tenantHost: 'other.sg.qlikcloud.com', clientId: 'client' };
  await act(async () => { renderer.update(<TenantEntryGate><TextInput /></TenantEntryGate>); });

  const text = JSON.stringify(renderer.toJSON());
  expect(text).toContain('other.sg.qlikcloud.com');
  expect(text).not.toContain('Connect to your Tenant');
  mockConfig = null;
});
