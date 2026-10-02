import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AgenticEntry } from './agentic-entry';

jest.mock('@/global.css', () => ({}));
// `Link asChild` renders its child through expo-router's own Slot, which is where the real
// failure is thrown. Mocking Link this way keeps that check in the loop without a navigator.
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactElement }) => {
    const { Slot } = jest.requireActual('expo-router/build/ui/Slot');
    return <Slot>{children}</Slot>;
  },
}));
jest.mock('./use-agentic-target', () => ({
  useAgenticAvailability: () => ({
    status: 'ready',
    config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c', assistantId: 'a', agenticAssistantId: 'g' },
    target: { surface: 'ai/agentic-assistant', resourceId: 'g' },
  }),
}));

it('renders the Agentic Assistant entry once a config with an Agentic Assistant id resolves', () => {
  let renderer!: TestRenderer.ReactTestRenderer;

  expect(() => {
    act(() => {
      renderer = TestRenderer.create(<AgenticEntry />);
    });
  }).not.toThrow();

  expect(JSON.stringify(renderer.toJSON())).toContain('Open the Agentic Assistant');
});
