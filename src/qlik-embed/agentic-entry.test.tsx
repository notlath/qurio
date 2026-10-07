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
const ready = {
  status: 'ready',
  config: { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'c', assistantId: 'a', agenticAssistantId: 'g' },
  target: { surface: 'ai/agentic-assistant', resourceId: 'g' },
};
let mockAvailability: object = ready;
jest.mock('./use-agentic-target', () => ({ useAgenticAvailability: () => mockAvailability }));
const discovered = [{ id: 'clock', kind: 'agentic', name: 'ClockSense AI', description: '' }];
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: () => ({ agentic: discovered }) }));

it('renders the Agentic Assistant entry once a config with an Agentic Assistant id resolves', () => {
  let renderer!: TestRenderer.ReactTestRenderer;

  expect(() => {
    act(() => {
      renderer = TestRenderer.create(<AgenticEntry />);
    });
  }).not.toThrow();

  expect(JSON.stringify(renderer.toJSON())).toContain('Open the Agentic Assistant');
});

it('lists discovered Agentic Assistants and opens each by its id when none is configured', () => {
  mockAvailability = { status: 'unavailable' };
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AgenticEntry />);
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('ClockSense AI');
  expect(JSON.stringify(renderer.toJSON())).toContain('Agentic Assistants');
  expect(renderer.root.findAll((node) => node.props.href !== undefined)[0].props.href).toEqual({ pathname: '/assistant/agentic', params: { id: 'clock' } });
  mockAvailability = ready;
});

it('shows only the configured Agentic Assistant when one is configured', () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AgenticEntry />);
  });
  expect(JSON.stringify(renderer.toJSON())).not.toContain('ClockSense AI');
});
