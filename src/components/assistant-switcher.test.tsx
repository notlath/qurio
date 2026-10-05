import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
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
