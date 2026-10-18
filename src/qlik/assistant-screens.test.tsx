import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import ChatScreen from '@/app/(drawer)/assistant';
import { AnswersScope } from './context';
import type { AnswersPort } from './port';

// The chat screen's search params. setParams merges into them, as the router does. A test re-renders to apply them.
let mockParams: Record<string, string | undefined> = {};
const mockSetParams = jest.fn((params: Record<string, string | undefined>) => { mockParams = { ...mockParams, ...params }; });
jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
jest.mock('expo-router', () => ({ useNavigation: () => ({ setParams: mockSetParams }), Stack: { Screen: (props: unknown) => jest.requireActual('react').createElement('Header', props as object) }, useLocalSearchParams: () => mockParams }));
jest.mock('@/qlik-embed/agentic-entry', () => ({ useAgenticRows: () => ({ rows: [], noAccess: false }) }));
jest.mock('@/components/assistant-switcher', () => ({ AssistantProblem: () => null }));
jest.mock('@/components/interaction-row', () => ({ InteractionRow: () => null }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/components/composer', () => ({ Composer: (props: unknown) => jest.requireActual('react').createElement('Composer', props as object), PendingAnswer: () => null, ChatScrollView: (props: unknown) => jest.requireActual('react').createElement('Scroll', props as object) }));
jest.setTimeout(30000);

const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const makePort = (id: string) => ({
  listThreads: jest.fn(async () => ({ items: [{ id: id + '-old', name: id + ' history', updatedAt: '2026-10-06T00:00:00Z', createdAt: '2026-10-06T00:00:00Z' }] })),
  createThread: jest.fn(async () => ({ id: `${id}-thread` })),
  listStarters: jest.fn(async () => [{ id, prompt: `${id} starter` }]),
  ask: jest.fn(async (threadId, question) => ({ id: 'interaction', threadId, question, answer: { blocks: [], citations: [] } })),
  getThread: jest.fn(async () => ({ id: 'old-thread', name: 'Old', interactions: [] })),
}) as unknown as AnswersPort;
const composer = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByType('Composer' as never);
// Undefined while there is nothing to start over: then the header has no right item.
const actions = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findByType('Header' as never).props.options.headerRight?.();
const greets = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findAll((node) => node.props.children === 'What can I help with?').length > 0;
beforeEach(() => {
  mockParams = {};
  mockSetParams.mockClear();
});

it('creates a Thread only on the first question and resets for another Assistant', async () => {
  const a = makePort('a');
  const b = makePort('b');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(a.createThread).not.toHaveBeenCalled();
  await act(async () => { composer(renderer).props.setQuestion('Question'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(1);
  useAssistantSelection.mockReturnValue({ selected: { id: 'b' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><ChatScreen /></AnswersScope>); });
  expect(composer(renderer).props.question).toBe('');
  expect(b.createThread).not.toHaveBeenCalled();
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Ask: b starter' }).length).toBeGreaterThan(0);
  await act(async () => { composer(renderer).props.setQuestion('New question'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(b.ask).toHaveBeenCalledWith('b-thread', 'New question', expect.any(Object));
  await act(async () => { renderer.unmount(); });
});

it('names a new Thread after its first question', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('  What were   sales last month?'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  await act(async () => { composer(renderer).props.setQuestion('And the month before?'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(1);
  expect(a.createThread).toHaveBeenCalledWith('What were sales last month?');
  await act(async () => { renderer.unmount(); });
});

it('names a new Thread after a Starter used as the first question', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { await renderer.root.findAllByProps({ accessibilityLabel: 'Ask: a starter' })[0].props.onPress(); });
  expect(a.createThread).toHaveBeenCalledWith('a starter');
  await act(async () => { renderer.unmount(); });
});

it('offers a new conversation once one has started, and the next question starts another Thread', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(actions(renderer)).toBeUndefined();
  await act(async () => { composer(renderer).props.setQuestion('First'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(actions(renderer)).toBeDefined();

  await act(async () => { actions(renderer).props.onNew(); });
  await act(async () => { renderer.update(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(actions(renderer)).toBeUndefined();
  expect(composer(renderer).props.question).toBe('');
  await act(async () => { composer(renderer).props.setQuestion('Second'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(2);
  await act(async () => { renderer.unmount(); });
});

it("starts a new conversation on the side panel's New chat", async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('First'); });
  await act(async () => { await composer(renderer).props.onAsk(); });

  mockParams = { chat: '1' };
  await act(async () => { renderer.update(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('Second'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(2);
  await act(async () => { renderer.unmount(); });
});

it('greets the Qlik User and offers the starters as chips, with the selector left to the header', async () => {
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={makePort('a')}><ChatScreen /></AnswersScope>); });

  expect(renderer.root.findAll((node) => node.props.children === 'What can I help with?').length).toBeGreaterThan(0);
  expect(renderer.root.findAll((node) => node.props.children === 'QURIO')).toHaveLength(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Ask: a starter' }).length).toBeGreaterThan(0);
  await act(async () => { renderer.unmount(); });
});

it('marks the Thread a new chat creates as started, so the side panel can highlight it', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(mockParams.started).toBeUndefined();
  await act(async () => { composer(renderer).props.setQuestion('First'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(mockSetParams).toHaveBeenCalledWith({ started: 'a-thread' });

  // The started Thread stays the current chat: the new param does not reload it.
  await act(async () => { renderer.update(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(actions(renderer)).toBeDefined();
  expect(a.getThread).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});

it('resumes a Thread from History through its own Assistant port', async () => {
  const resumed = makePort('a');
  const selected = makePort('selected');
  const portFor = jest.fn(() => resumed);
  useAssistantSelection.mockReturnValue({ portFor, selected: { id: 'a' } });
  mockParams = { thread: 'old-thread', assistantId: 'a' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={selected}><ChatScreen /></AnswersScope>); });
  expect(portFor).toHaveBeenCalledWith('a');
  expect(resumed.getThread).toHaveBeenCalledWith('old-thread');
  expect(greets(renderer)).toBe(false);
  await act(async () => { composer(renderer).props.setQuestion('Continue'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(resumed.ask).toHaveBeenCalledWith('old-thread', 'Continue', expect.any(Object));
  expect(selected.ask).not.toHaveBeenCalled();
  expect(resumed.createThread).not.toHaveBeenCalled();
  await act(async () => { renderer.unmount(); });
});

it('leaves a resumed Thread for a new chat on New conversation', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ portFor: () => a, selected: { id: 'a' } });
  mockParams = { thread: 'old-thread', assistantId: 'a' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('Continue'); });
  await act(async () => { await composer(renderer).props.onAsk(); });

  await act(async () => { actions(renderer).props.onNew(); });
  await act(async () => { renderer.update(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(mockParams.thread).toBeUndefined();
  expect(greets(renderer)).toBe(true);
  await act(async () => { composer(renderer).props.setQuestion('New'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(1);
  await act(async () => { renderer.unmount(); });
});

it('starts a new chat when another Assistant is selected while a Thread is open', async () => {
  const a = makePort('a');
  const b = makePort('b');
  useAssistantSelection.mockReturnValue({ portFor: () => a, selected: { id: 'a' } });
  mockParams = { thread: 'old-thread', assistantId: 'a' };
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  expect(greets(renderer)).toBe(false);

  useAssistantSelection.mockReturnValue({ portFor: () => b, selected: { id: 'b' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><ChatScreen /></AnswersScope>); });
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Ask: b starter' }).length).toBeGreaterThan(0);
  await act(async () => { renderer.unmount(); });
});

it('aborts a pending question when another Assistant replaces the new Thread screen', async () => {
  const a = makePort('a');
  const b = makePort('b');
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  (a.ask as jest.Mock).mockImplementation(async () => {
    await pending;
    return { id: 'interaction', threadId: 'a-thread', question: 'Pending', answer: { blocks: [], citations: [] } };
  });
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><ChatScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('Pending'); });
  await act(async () => { composer(renderer).props.onAsk(); });
  const signal = (a.ask as jest.Mock).mock.calls[0][2].signal as AbortSignal;
  useAssistantSelection.mockReturnValue({ selected: { id: 'b' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><ChatScreen /></AnswersScope>); });
  try {
    expect(signal.aborted).toBe(true);
  } finally {
    await act(async () => { finish(); renderer.unmount(); });
  }
});
