import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Platform, View } from 'react-native';

import AgenticAssistantScreen from '@/app/(tabs)/assistant/agentic';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'assistant-1' }) }));
jest.mock('@/qlik-embed/use-agentic-target', () => ({
  useAgenticAvailability: () => ({
    status: 'available',
    config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1' },
    target: { surface: 'ai/agentic-assistant', resourceId: 'assistant-1' },
  }),
}));
jest.mock('@/qlik-embed/qlik-embed-host', () => ({
  QlikEmbedHost: (props: object) => jest.requireActual('react').createElement('QlikEmbedHost', props),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }));
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardAvoidingView: (props: object) => jest.requireActual('react').createElement('KeyboardAvoidingView', props),
}));

it('keeps the Agentic embed above the iOS floating tab bar and moves it with the keyboard', () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<AgenticAssistantScreen />); });
    const keyboardView = renderer.root.findByType('KeyboardAvoidingView' as never);
    expect(keyboardView.props).toMatchObject({ behavior: 'padding', automaticOffset: true });
    expect(keyboardView.props.style).toMatchObject({ flex: 1 });
    expect(keyboardView.findByType(View).props.style).toMatchObject({ flex: 1, paddingBottom: 84 });
    expect(renderer.root.findByType('QlikEmbedHost' as never).props.resourceId).toBe('assistant-1');
  } finally {
    act(() => renderer?.unmount());
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  }
});

it('lets native tabs provide the Android bottom inset', () => {
  const originalOS = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  let renderer!: TestRenderer.ReactTestRenderer;
  try {
    act(() => { renderer = TestRenderer.create(<AgenticAssistantScreen />); });
    expect(renderer.root.findByType('QlikEmbedHost' as never).props.resourceId).toBe('assistant-1');
    expect(renderer.root.findAllByType('KeyboardAvoidingView' as never)).toHaveLength(0);
  } finally {
    act(() => renderer?.unmount());
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  }
});
