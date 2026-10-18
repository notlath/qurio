import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform } from 'react-native';

import { resolveCurrentTenantConfig, type TenantConfig } from '@/config';
import { createAnswersPort } from './adapter';
import { useAssistantSelection } from './assistant-selection';
import { AnswersPortProvider, useReloadAnswersPort } from './context';

jest.mock('@/config', () => ({ resolveCurrentTenantConfig: jest.fn() }));
jest.mock('./adapter', () => ({ createAnswersPort: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
}));
const resolveConfig = resolveCurrentTenantConfig as jest.Mock;
const buildPort = createAnswersPort as jest.Mock;
const originalOS = Platform.OS;
let renderer: TestRenderer.ReactTestRenderer;

function Probe() {
  const { selected, error } = useAssistantSelection();
  const reload = useReloadAnswersPort();
  return <button onClick={reload}>{error?.kind ?? selected?.name ?? 'Loading'}</button>;
}

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  buildPort.mockImplementation((config: TenantConfig) => ({
    listAssistants: async () => [{ id: config.tenantHost, name: config.tenantHost, description: '', kind: 'classic' }],
  }));
});
afterEach(async () => {
  await act(async () => { renderer?.unmount(); });
  Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
});

it('replaces the Assistant choice only after a delayed Tenant port resolves', async () => {
  resolveConfig.mockResolvedValue(null);
  await act(async () => { renderer = TestRenderer.create(<AnswersPortProvider><Probe /></AnswersPortProvider>); });
  expect(renderer.root.findByType('button').props.children).toBe('ConfigMissing');

  const config = { tenantHost: 'one.sg.qlikcloud.com', clientId: 'c' };
  let finish!: (value: TenantConfig) => void;
  const pending = new Promise<TenantConfig>((resolve) => { finish = resolve; });
  resolveConfig.mockResolvedValue(config).mockImplementationOnce(async () => config).mockImplementationOnce(() => pending);
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  await act(async () => { finish(config); });
  expect(renderer.root.findByType('button').props.children).toBe('one.sg.qlikcloud.com');

  const next = { tenantHost: 'two.sg.qlikcloud.com', clientId: 'c' };
  resolveConfig.mockResolvedValue(next);
  await act(async () => { renderer.root.findByType('button').props.onClick(); });
  expect(renderer.root.findByType('button').props.children).toBe('two.sg.qlikcloud.com');
});
