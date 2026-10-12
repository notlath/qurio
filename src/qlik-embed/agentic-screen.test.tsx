import React from 'react';
import { Platform } from 'react-native';
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

/** The space the screen asks the embed to keep below its content: how far Qlik's composer is lifted. */
function embedBottomInset(): number {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AgenticAssistantScreen />);
  });
  const { QlikEmbedHost } = jest.requireMock('@/qlik-embed/qlik-embed-host');
  const embed = renderer.root.findByType(QlikEmbedHost);
  const { bottomInset } = embed.props;
  // The embed is the screen's direct child: a wrapper View broke the keyboard handling (#13, #18).
  const wrapperType = embed.parent?.type;
  act(() => renderer.unmount());
  expect(wrapperType).not.toBe('View');
  return bottomInset ?? 0;
}

describe('the Agentic Assistant screen', () => {
  it('on iOS, keeps the embed content above the floating tab bar so the composer is not covered', () => {
    onPlatform('ios');
    expect(embedBottomInset()).toBe(83);
  });

  it('on iOS with the keyboard open, keeps nothing: the keyboard covers the tab bar', () => {
    onPlatform('ios');
    mockKeyboardVisible = true;
    expect(embedBottomInset()).toBe(0);
  });

  it('on Android, keeps nothing: native tabs already keep screen content above the tab bar', () => {
    onPlatform('android');
    expect(embedBottomInset()).toBe(0);
  });
});
