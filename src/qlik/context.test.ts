import { Platform } from 'react-native';

import { resolveCurrentTenantConfig } from '@/config';

import { createAnswersPort } from './adapter';
import { resolveAnswersPort } from './context';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

jest.mock('@/config', () => ({ resolveCurrentTenantConfig: jest.fn() }));
jest.mock('./adapter', () => ({
  createAnswersPort: jest.fn(() => ({ capabilities: { streaming: true, analyticsInsights: false } })),
}));

const resolveConfig = resolveCurrentTenantConfig as jest.Mock;

function onPlatform(os: 'web' | 'ios') {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

const originalOS = Platform.OS;
beforeEach(() => jest.clearAllMocks());
afterEach(() => onPlatform(originalOS as 'ios'));

describe('resolveAnswersPort', () => {
  it('builds the real Qlik port once a tenant config resolves — this is what makes questions leave the device', async () => {
    onPlatform('ios');
    resolveConfig.mockResolvedValue({ tenantHost: 'acme.eu.qlikcloud.com', clientId: 'c', assistantId: 'a' });

    await expect(resolveAnswersPort()).resolves.toHaveProperty('capabilities.streaming', true);
  });

  it('builds the real Qlik port from a hostname-only config, before an Assistant is chosen', async () => {
    onPlatform('ios');
    const hostnameOnly = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c' };
    resolveConfig.mockResolvedValue(hostnameOnly);

    await expect(resolveAnswersPort()).resolves.toHaveProperty('capabilities.streaming', true);
    expect(createAnswersPort).toHaveBeenCalledWith(hostnameOnly);
  });

  it('fails every call with ConfigMissing rather than answering from fixtures when nothing is configured', async () => {
    onPlatform('ios');
    resolveConfig.mockResolvedValue(null);

    const port = await resolveAnswersPort();

    await expect(port.listThreads()).rejects.toEqual({ kind: 'ConfigMissing' });
    await expect(port.ask('thread-1', 'What changed?', { onDelta: () => {} })).rejects.toEqual({
      kind: 'ConfigMissing',
    });
    await expect(port.listAnalyticsApps()).rejects.toEqual({ kind: 'ConfigMissing' });
    await expect(port.listAssistants()).rejects.toEqual({ kind: 'ConfigMissing' });
    await expect(port.getCurrentUser()).rejects.toEqual({ kind: 'ConfigMissing' });
  });

  it('keeps the fixture port on web, which has no Qlik transport at all (ADR-0005)', async () => {
    onPlatform('web');
    resolveConfig.mockResolvedValue({ tenantHost: 'acme.eu.qlikcloud.com', clientId: 'c', assistantId: 'a' });

    const port = await resolveAnswersPort();

    expect(port.capabilities.streaming).toBe(false);
    await expect(port.listStarters()).resolves.not.toHaveLength(0);
    expect(resolveConfig).not.toHaveBeenCalled();
  });
});
