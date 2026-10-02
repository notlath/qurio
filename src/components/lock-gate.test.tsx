import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AppState, Switch, Text, type AppStateStatus } from 'react-native';

import { LockGate, usePrivacyLock } from './lock-gate';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-local-authentication', () => ({
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));
jest.mock('@/config', () => ({ resolveCurrentTenantConfig: jest.fn().mockResolvedValue(null) }));

let renderer: TestRenderer.ReactTestRenderer;

function Workspace() {
  const privacyLock = usePrivacyLock();
  return <><Text>Workspace content</Text><Switch value={privacyLock.enabled} onValueChange={privacyLock.setEnabled} /></>;
}

async function renderGate() {
  await act(async () => {
    renderer = TestRenderer.create(<LockGate><Workspace /></LockGate>);
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('locks by default without exposing workspace content', async () => {
  await renderGate();

  expect(JSON.stringify(renderer.toJSON())).toContain('Your workspace is locked.');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Workspace content');
});

it('turns privacy lock back on for the next startup without interrupting Settings', async () => {
  await AsyncStorage.setItem('qlik.privacyLockEnabled', 'false');
  await renderGate();
  await act(async () => renderer.root.findByType(Switch).props.onValueChange(true));
  expect(JSON.stringify(renderer.toJSON())).toContain('Workspace content');

  act(() => renderer.unmount());
  await renderGate();
  expect(JSON.stringify(renderer.toJSON())).toContain('Your workspace is locked.');
});

afterEach(() => {
  if (renderer) act(() => renderer.unmount());
});

it('bypasses the startup lock when privacy lock is saved off', async () => {
  await AsyncStorage.setItem('qlik.privacyLockEnabled', 'false');
  await renderGate();

  expect(JSON.stringify(renderer.toJSON())).toContain('Workspace content');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Your workspace is locked.');
});

it('keeps the workspace unlocked after the timeout when off, and locks after re-enabling', async () => {
  let onChange: ((state: AppStateStatus) => void) | undefined;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_, handler) => {
    onChange = handler;
    return { remove: () => { onChange = undefined; } };
  });
  const now = jest.spyOn(Date, 'now');
  try {
    await renderGate();
    await act(async () => renderer.root.findByProps({ label: 'Unlock' }).props.onPress());
    await act(async () => renderer.root.findByType(Switch).props.onValueChange(false));
    act(() => {
      now.mockReturnValue(0);
      onChange?.('background');
      now.mockReturnValue(600_000);
      onChange?.('active');
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Workspace content');

    act(() => renderer.unmount());
    await renderGate();
    expect(JSON.stringify(renderer.toJSON())).toContain('Workspace content');
    await act(async () => renderer.root.findByType(Switch).props.onValueChange(true));
    act(() => {
      now.mockReturnValue(0);
      onChange?.('background');
      now.mockReturnValue(600_000);
      onChange?.('active');
    });
    expect(JSON.stringify(renderer.toJSON())).toContain('Your workspace is locked.');
  } finally {
    listener.mockRestore();
    now.mockRestore();
  }
});
