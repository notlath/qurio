import React from 'react';
import { Platform } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

// Lives here, not beside the route: every file under src/app becomes a route.
import AgenticAssistantScreen from '@/app/(tabs)/assistant/agentic';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ Redirect: () => null, useLocalSearchParams: () => ({}) }));
const mockKeyboard: Record<string, () => void> = {};
jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: {
    addListener: (name: string, listener: () => void) => {
      mockKeyboard[name] = listener;
      return { remove: jest.fn() };
    },
  },
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
let renderer: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => {
  onPlatform(originalOS);
  act(() => renderer?.unmount());
  renderer = undefined;
});

/** Shows the screen and reads the space it asks the embed to keep below its content. */
function showScreen() {
  act(() => {
    renderer = TestRenderer.create(<AgenticAssistantScreen />);
  });
  const { QlikEmbedHost } = jest.requireMock('@/qlik-embed/qlik-embed-host');
  const embed = () => renderer!.root.findByType(QlikEmbedHost);
  // The embed is the screen's direct child: a wrapper View broke the keyboard handling (#13, #18).
  expect(embed().parent?.type).not.toBe('View');
  return {
    inset: (): number => embed().props.bottomInset ?? 0,
    keyboard: (event: 'keyboardWillShow' | 'keyboardDidShow' | 'keyboardWillHide') => act(() => mockKeyboard[event]?.()),
  };
}

describe('the Agentic Assistant screen', () => {
  it('on iOS, keeps the embed content above the floating tab bar so the composer is not covered', () => {
    onPlatform('ios');
    expect(showScreen().inset()).toBe(83);
  });

  it('on iOS, keeps the space while the keyboard slides in, so the composer does not sink under the tab bar', () => {
    onPlatform('ios');
    const screen = showScreen();

    screen.keyboard('keyboardWillShow');

    expect(screen.inset()).toBe(83);
  });

  it('on iOS, drops the space once the keyboard is up and covers the tab bar', () => {
    onPlatform('ios');
    const screen = showScreen();

    screen.keyboard('keyboardDidShow');

    expect(screen.inset()).toBe(0);
  });

  it('on iOS, brings the space back as soon as the keyboard starts to hide', () => {
    onPlatform('ios');
    const screen = showScreen();
    screen.keyboard('keyboardDidShow');

    screen.keyboard('keyboardWillHide');

    expect(screen.inset()).toBe(83);
  });

  it('on Android, keeps nothing: native tabs already keep screen content above the tab bar', () => {
    onPlatform('android');
    const screen = showScreen();
    expect(screen.inset()).toBe(0);

    screen.keyboard('keyboardDidShow');

    expect(screen.inset()).toBe(0);
  });
});
