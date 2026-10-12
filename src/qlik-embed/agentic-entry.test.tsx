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
const clock = { id: 'clock', kind: 'agentic', name: 'ClockSense AI', description: '' };
const configured = { id: 'g', kind: 'agentic', name: 'Configured', description: '' };
const loaded = { assistants: [], agentic: [clock, configured], loading: false, error: null };
let mockSelection: object = loaded;
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: () => mockSelection }));

beforeEach(() => {
  mockAvailability = ready;
  mockSelection = loaded;
});

function shown(): { text: string; renderer: TestRenderer.ReactTestRenderer } {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<AgenticEntry />);
  });
  return { text: JSON.stringify(renderer.toJSON()), renderer };
}

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

describe('a Qlik User who cannot see the configured Agentic Assistant (#16)', () => {
  const NO_ACCESS =
    "You don't have access to the Agentic Assistant that your administrator set up. Ask your Tenant admin to give you access to its space.";

  it('says so instead of offering an embed that shows "No context selected"', () => {
    mockSelection = { ...loaded, agentic: [clock] };

    const { text, renderer } = shown();

    expect(text).toContain(NO_ACCESS);
    expect(text).not.toContain('Open the Agentic Assistant');
    expect(renderer.root.findAll((node) => node.props.href !== undefined)).toHaveLength(0);
  });

  it('does not list the discovered Assistants next to the message', () => {
    mockSelection = { ...loaded, agentic: [clock] };

    expect(shown().text).not.toContain('ClockSense AI');
  });

  it('offers the embed when the configured Assistant is in the list as a classic Assistant', () => {
    mockSelection = { ...loaded, assistants: [{ ...configured, kind: 'classic' }], agentic: [] };

    const { text } = shown();

    expect(text).toContain('Open the Agentic Assistant');
    expect(text).not.toContain(NO_ACCESS);
  });

  it('offers the embed while the list is still loading, because the app cannot tell yet', () => {
    mockSelection = { assistants: [], agentic: [], loading: true, error: null };

    const { text } = shown();

    expect(text).toContain('Open the Agentic Assistant');
    expect(text).not.toContain(NO_ACCESS);
  });

  it('offers the embed when the list failed to load, so a network error does not block the Qlik User', () => {
    mockSelection = { assistants: [], agentic: [], loading: false, error: { kind: 'ServiceUnavailable' } };

    const { text } = shown();

    expect(text).toContain('Open the Agentic Assistant');
    expect(text).not.toContain(NO_ACCESS);
  });

  it('shows nothing when no Agentic Assistant is configured and none is discovered', () => {
    mockAvailability = { status: 'unavailable' };
    mockSelection = { assistants: [{ ...clock, kind: 'classic' }], agentic: [], loading: false, error: null };

    const { renderer } = shown();

    expect(renderer.toJSON()).toBeNull();
  });
});
