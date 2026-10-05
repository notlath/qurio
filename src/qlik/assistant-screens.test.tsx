import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import HistoryScreen from '@/app/(tabs)/assistant/history';
import NewThreadScreen from '@/app/(tabs)/assistant';
import ThreadDetailScreen from '@/app/(tabs)/assistant/thread/[id]';
import { AnswersScope } from './context';
import type { AnswersPort } from './port';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
jest.mock('expo-router', () => ({ Link: (props: unknown) => jest.requireActual('react').createElement('Link', props as object), Stack: { Screen: (props: unknown) => jest.requireActual('react').createElement('Header', props as object) }, useLocalSearchParams: () => ({ id: 'old-thread', assistantId: 'a', assistantName: 'Knowledge' }) }));
jest.mock('@/qlik-embed/agentic-entry', () => ({ AgenticEntry: () => null }));
jest.mock('@/components/assistant-switcher', () => ({ AssistantSwitcher: () => null }));
jest.mock('@/components/interaction-row', () => ({ InteractionRow: () => null }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/composer', () => ({ Composer: (props: unknown) => jest.requireActual('react').createElement('Composer', props as object), PendingAnswer: () => null, ChatScrollView: (props: unknown) => jest.requireActual('react').createElement('Scroll', props as object) }));
const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const makePort = (id: string) => ({
  listThreads: jest.fn(async () => ({ items: [{ id: id + '-old', name: id + ' history', updatedAt: '2026-10-06T00:00:00Z', createdAt: '2026-10-06T00:00:00Z' }] })),
  createThread: jest.fn(async () => ({ id: `${id}-thread` })),
  listStarters: jest.fn(async () => [{ id, prompt: `${id} starter` }]),
  ask: jest.fn(async (threadId, question) => ({ id: 'interaction', threadId, question, answer: { blocks: [], citations: [] } })),
  getThread: jest.fn(async () => ({ id: 'old-thread', name: 'Old', interactions: [] })),
}) as unknown as AnswersPort;
const composer = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByType('Composer' as never);

it('creates a Thread only on the first question and resets for another Assistant', async () => {
  const a = makePort('a');
  const b = makePort('b');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><NewThreadScreen /></AnswersScope>); });
  expect(a.createThread).not.toHaveBeenCalled();
  await act(async () => { composer(renderer).props.setQuestion('Question'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(1);
  useAssistantSelection.mockReturnValue({ selected: { id: 'b' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><NewThreadScreen /></AnswersScope>); });
  expect(composer(renderer).props.question).toBe('');
  expect(b.createThread).not.toHaveBeenCalled();
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Ask: b starter' }).length).toBeGreaterThan(0);
  await act(async () => { composer(renderer).props.setQuestion('New question'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(b.ask).toHaveBeenCalledWith('b-thread', 'New question', expect.any(Object));
  await act(async () => { renderer.unmount(); });
});

it('resumes through its own Assistant port and names it in the header', async () => {
  const resumed = makePort('a');
  const selected = makePort('b');
  useAssistantSelection.mockReturnValue({ portFor: () => resumed, selected: { id: 'b' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={selected}><ThreadDetailScreen /></AnswersScope>); });
  expect(renderer.root.findByType('Header' as never).props.options.title).toBe('Knowledge');
  await act(async () => { composer(renderer).props.setQuestion('Continue'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(resumed.ask).toHaveBeenCalledWith('old-thread', 'Continue', expect.any(Object));
  expect(selected.ask).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});


it('History lists Threads for the selected Assistant and switches without creating Threads', async () => {
  const a = makePort('a');
  const b = makePort('b');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a', name: 'Knowledge' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><HistoryScreen /></AnswersScope>); });
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Open a history' }).length).toBeGreaterThan(0);
  expect(renderer.root.findByType('Link' as never).props.href.params.assistantId).toBe('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'b', name: 'Operations' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><HistoryScreen /></AnswersScope>); });
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Open b history' }).length).toBeGreaterThan(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Open a history' }).length).toBe(0);
  expect(a.createThread).not.toHaveBeenCalled();
  expect(b.createThread).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});
