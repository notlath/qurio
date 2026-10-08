import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// Lives here, not beside the route: every file under src/app becomes a route.
import AgenticAssistantScreen from '@/app/(tabs)/assistant/agentic';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ Redirect: () => null, useLocalSearchParams: () => ({}) }));
let mockKeyboardVisible = false;
jest.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (select: (state: { isVisible: boolean }) => unknown) => select({ isVisible: mockKeyboardVisible }),
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 83, left: 0, right: 0 }) }));
jest.mock('@/qlik-embed/use-agentic-target', () => ({
  useAgenticAvailability: () => ({
    status: 'ready',
    config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c' },
    target: { surface: 'ai/agentic-assistant', resourceId: 'g' },
  }),
}));
jest.mock('@/qlik-embed/qlik-embed-host', () => ({ QlikEmbedHost: () => null }));

function onPlatform(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}
const originalOS = Platform.OS;
afterEach(() => {
  onPlatform(originalOS);
  mockKeyboardVisible = false;
});

/** The bottom padding around the embed: the space Qlik's bottom-pinned composer is lifted by. */
function embedBottomPadding(): number {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AgenticAssistantScreen />);
  });
  const { QlikEmbedHost } = jest.requireMock('@/qlik-embed/qlik-embed-host');
  const wrapper = renderer.root.findByType(QlikEmbedHost).parent!;
  const padding = StyleSheet.flatten(wrapper.props.style)?.paddingBottom ?? 0;
  act(() => renderer.unmount());
  return padding;
}

describe('the Agentic Assistant screen', () => {
  it('on iOS, lifts the embed above the floating tab bar so the composer is not covered', () => {
    onPlatform('ios');
    expect(embedBottomPadding()).toBe(83);
  });

  it('on Android, adds nothing: native tabs already keep screen content above the tab bar', () => {
    onPlatform('android');
    expect(embedBottomPadding()).toBe(0);
  });

  it('on iOS with the keyboard open, adds nothing so the composer sits on the keyboard', () => {
    onPlatform('ios');
    mockKeyboardVisible = true;
    expect(embedBottomPadding()).toBe(0);
  });
});
