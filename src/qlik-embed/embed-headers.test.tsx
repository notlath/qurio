import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import AppsLayout from '@/app/(drawer)/apps/_layout';
import AssistantLayout from '@/app/(drawer)/assistant/_layout';

jest.mock('@/global.css', () => ({}));
jest.mock('@/components/side-panel', () => ({ SidePanelButton: () => null }));
jest.mock('@/components/assistant-switcher', () => ({ AssistantSwitcher: () => null }));
jest.mock('expo-router', () => {
  const { createElement } = jest.requireActual('react');
  const Stack = ({ children }: { children: unknown }) => createElement('Stack', null, children);
  Stack.Screen = (props: object) => createElement('Screen', props);
  return { Stack };
});

function screenOptions(Layout: () => React.ReactElement, name: string) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<Layout />);
  });
  return renderer.root.findByProps({ name }).props.options;
}

// iOS 26 draws a transparent header as glass over the screen. A WebView cannot move the Qlik page below
// it, and the page stays light in both themes, so the title faded into the page.
it.each([
  ['the Analytics App', AppsLayout, '[id]'],
  ['the Agentic Assistant', AssistantLayout, 'agentic'],
])('gives %s, a Qlik page in a WebView, an opaque header', (_, Layout, name) => {
  expect(screenOptions(Layout, name)).toMatchObject({ headerTransparent: false });
});
