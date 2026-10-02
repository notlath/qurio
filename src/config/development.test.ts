import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadDevConfig, saveDevConfig } from './development';
import { loadManagedConfig } from './load-managed-config';
import { resolveCurrentTenantConfig } from './index';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
}));
jest.mock('./load-managed-config', () => ({ loadManagedConfig: jest.fn() }));

const managedSource = loadManagedConfig as jest.Mock;
const base = { tenantHost: 'dev.eu.qlikcloud.com', clientId: 'client-dev', assistantId: 'assistant-dev' };

beforeEach(async () => {
  await AsyncStorage.clear();
  managedSource.mockResolvedValue(undefined);
});

describe('development configuration round trip', () => {
  it('keeps agenticAssistantId through save and load', async () => {
    await saveDevConfig({ ...base, agenticAssistantId: 'agentic-dev' });

    expect(await loadDevConfig()).toEqual({ ...base, agenticAssistantId: 'agentic-dev' });
  });

  it('clears it when saved without one, since a save replaces the whole entry', async () => {
    await saveDevConfig({ ...base, agenticAssistantId: 'agentic-dev' });
    await saveDevConfig({ ...base, agenticAssistantId: undefined });

    expect(await loadDevConfig()).toEqual(base);
  });

  it('still loads an entry saved before the field existed', async () => {
    await saveDevConfig(base);

    expect(await loadDevConfig()).toEqual(base);
  });
});

describe('resolveCurrentTenantConfig', () => {
  it('hands the resolved agenticAssistantId to callers from the dev entry', async () => {
    await saveDevConfig({ ...base, agenticAssistantId: 'agentic-dev' });

    expect((await resolveCurrentTenantConfig())?.agenticAssistantId).toBe('agentic-dev');
  });

  it('hands it over from managed configuration, which wins over the dev entry', async () => {
    managedSource.mockResolvedValue({
      tenantHost: 'acme.eu.qlikcloud.com',
      clientId: 'client-mdm',
      assistantId: 'assistant-mdm',
      agenticAssistantId: 'agentic-mdm',
    });
    await saveDevConfig({ ...base, agenticAssistantId: 'agentic-dev' });

    expect((await resolveCurrentTenantConfig())?.agenticAssistantId).toBe('agentic-mdm');
  });

  it('does not borrow the dev Assistant when complete managed configuration omits one', async () => {
    managedSource.mockResolvedValue({
      tenantHost: 'acme.eu.qlikcloud.com',
      clientId: 'client-mdm',
      assistantId: 'assistant-mdm',
    });
    await saveDevConfig({ ...base, agenticAssistantId: 'agentic-dev' });

    const config = await resolveCurrentTenantConfig();

    expect(config?.tenantHost).toBe('acme.eu.qlikcloud.com');
    expect(config?.agenticAssistantId).toBeUndefined();
  });
});
