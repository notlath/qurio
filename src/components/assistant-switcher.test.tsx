import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { errorMessageFor } from '@/domain';
import { AssistantSwitcher } from './assistant-switcher';

jest.mock('@/global.css', () => ({}));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const assistants = [{ id: 'a', name: 'Knowledge', description: '' }, { id: 'b', name: 'Operations', description: '' }];

it('shows the selected Assistant and opens a list without creating a Thread', async () => {
  const choose = jest.fn().mockResolvedValue(undefined);
  useAssistantSelection.mockReturnValue({ assistants, selected: assistants[0], choose });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher />); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Knowledge');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Operations');
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Choose Assistant' }).props.onPress(); });
  expect(JSON.stringify(renderer.toJSON())).toContain('Operations');
  const row = renderer.root.findAll((node) => node.props.accessibilityState?.selected === false && typeof node.props.onPress === 'function')[0];
  await act(async () => { await row.props.onPress(); });
  expect(choose).toHaveBeenCalledWith(assistants[1]);
});

describe('a Qlik User with no classic Assistant (#22)', () => {
  const base = { assistants: [], agentic: [], selected: null, loading: false, error: null, choose: jest.fn() };
  const render = (selection: object) => {
    useAssistantSelection.mockReturnValue({ ...base, ...selection });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AssistantSwitcher />);
    });
    return { renderer, text: JSON.stringify(renderer.toJSON()) };
  };

  it('is not told that the license is missing when an Agentic Assistant is available', () => {
    const { renderer, text } = render({ agentic: [{ id: 'g', name: 'ClockSense AI', description: '', kind: 'agentic' }] });

    expect(text).not.toContain('license');
    expect(renderer.toJSON()).toBeNull();
  });

  it('is told that no Assistant is available, and to ask the Tenant admin, without a license claim', () => {
    const { text } = render({});

    expect(text).toContain('No Assistants available');
    expect(text).toContain('Tenant admin');
    expect(text).not.toContain('license');
    expect(text).not.toContain('No Answers access');
  });

  it('still sees the message for an error from the Assistants request', () => {
    const { text } = render({ error: { kind: 'ServiceUnavailable' } });

    expect(text).toContain(errorMessageFor({ kind: 'ServiceUnavailable' }).title);
    expect(text).not.toContain('No Assistants available');
  });

  it('sees a spinner while the Assistants load, not a message', () => {
    const { text } = render({ loading: true });

    expect(text).not.toContain('No Assistants available');
    expect(text).not.toContain('license');
  });
});
