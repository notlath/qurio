import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import HistoryScreen from '@/app/(tabs)/assistant/history';
import NewThreadScreen from '@/app/(tabs)/assistant';
import ThreadDetailScreen from '@/app/(tabs)/assistant/thread/[id]';
import { AnswersScope } from './context';
import type { AnswersPort } from './port';

const mockDismissTo = jest.fn();
jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
jest.mock('expo-router', () => ({ useRouter: () => ({ dismissTo: mockDismissTo }), Link: (props: unknown) => jest.requireActual('react').createElement('Link', props as object), Stack: { Screen: (props: unknown) => jest.requireActual('react').createElement('Header', props as object) }, useLocalSearchParams: () => ({ id: 'old-thread', assistantId: 'a', assistantName: 'Knowledge' }) }));
jest.mock('@/qlik-embed/agentic-entry', () => ({ useAgenticRows: () => ({ rows: [], noAccess: false }) }));
jest.mock('@/components/assistant-switcher', () => ({ AssistantSwitcher: () => null, AssistantProblem: () => null }));
jest.mock('@/components/interaction-row', () => ({ InteractionRow: () => null }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
// Reanimated's worklets do not load under Jest. The swipe itself needs a device, so the row passes through.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({ __esModule: true, default: ({ children }: { children: unknown }) => children }));
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

it('offers a new conversation once one has started, and the next question starts another Thread', async () => {
  const a = makePort('a');
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><NewThreadScreen /></AnswersScope>); });
  const actions = () => renderer.root.findByType('Header' as never).props.options.headerRight();

  expect(actions().props.canStartNew).toBe(false);
  await act(async () => { composer(renderer).props.setQuestion('First'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(actions().props.canStartNew).toBe(true);

  await act(async () => { actions().props.onNew(); });
  expect(actions().props.canStartNew).toBe(false);
  expect(composer(renderer).props.question).toBe('');
  await act(async () => { composer(renderer).props.setQuestion('Second'); });
  await act(async () => { await composer(renderer).props.onAsk(); });
  expect(a.createThread).toHaveBeenCalledTimes(2);
  await act(async () => { renderer.unmount(); });
});

it('greets the Qlik User and offers the starters as chips, with the selector left to the header', async () => {
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' } });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={makePort('a')}><NewThreadScreen /></AnswersScope>); });

  expect(renderer.root.findAll((node) => node.props.children === 'What can I help with?').length).toBeGreaterThan(0);
  expect(renderer.root.findAll((node) => node.props.children === 'QURIO')).toHaveLength(0);
  expect(renderer.root.findAllByProps({ accessibilityLabel: 'Ask: a starter' }).length).toBeGreaterThan(0);
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
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={a}><NewThreadScreen /></AnswersScope>); });
  await act(async () => { composer(renderer).props.setQuestion('Pending'); });
  await act(async () => { composer(renderer).props.onAsk(); });
  const signal = (a.ask as jest.Mock).mock.calls[0][2].signal as AbortSignal;
  useAssistantSelection.mockReturnValue({ selected: { id: 'b' } });
  await act(async () => { renderer.update(<AnswersScope port={b}><NewThreadScreen /></AnswersScope>); });
  try {
    expect(signal.aborted).toBe(true);
  } finally {
    await act(async () => { finish(); renderer.unmount(); });
  }
});

describe('History when no Assistant is selected (#22)', () => {
  const notChosen = () =>
    ({ listThreads: jest.fn(async () => { throw { kind: 'AssistantNotChosen' }; }) }) as unknown as AnswersPort & { listThreads: jest.Mock };
  const show = async (port: AnswersPort) => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(<AnswersScope port={port}><HistoryScreen /></AnswersScope>); });
    // Some props are objects with cycles, so keep each one once instead of using plain stringify.
    const seen = new WeakSet();
    const text = JSON.stringify(renderer.toJSON(), (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
    await act(async () => { renderer.unmount(); });
    return text;
  };

  it('does not ask the Qlik User to choose an Assistant when there is none to choose', async () => {
    const port = notChosen();
    useAssistantSelection.mockReturnValue({ selected: null, assistants: [] });

    const text = await show(port);

    expect(text).not.toContain('No Assistant chosen');
    expect(port.listThreads).not.toHaveBeenCalled();
  });

  it('still asks the Qlik User to choose when there are Assistants and none is chosen', async () => {
    const port = notChosen();
    useAssistantSelection.mockReturnValue({ selected: null, assistants: [{ id: 'a' }, { id: 'b' }] });

    expect(await show(port)).toContain('No Assistant chosen');
  });
});

it('History with no conversations offers one action: ask a question', async () => {
  const port = { ...makePort('a'), listThreads: jest.fn(async () => ({ items: [] })) } as unknown as AnswersPort;
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' }, assistants: [{ id: 'a' }] });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={port}><HistoryScreen /></AnswersScope>); });

  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Ask a question' }).props.onPress(); });

  expect(mockDismissTo).toHaveBeenCalledWith('/assistant');
  await act(async () => { renderer.unmount(); });
});

it('History deletes a conversation only after confirmation, from a long press or the Delete action', async () => {
  const port = { ...makePort('a'), deleteThread: jest.fn(async () => undefined) } as unknown as AnswersPort & { deleteThread: jest.Mock };
  useAssistantSelection.mockReturnValue({ selected: { id: 'a' }, assistants: [{ id: 'a' }] });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AnswersScope port={port}><HistoryScreen /></AnswersScope>); });
  const row = () => renderer.root.findByProps({ accessibilityLabel: 'Open a history' });
  try {
    expect(row().props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete' }]);
    await act(async () => { row().props.onLongPress(); });
    expect(alert).toHaveBeenLastCalledWith('Delete conversation?', expect.any(String), expect.any(Array), expect.any(Object));
    expect(port.deleteThread).not.toHaveBeenCalled();

    await act(async () => { row().props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } }); });
    const buttons = alert.mock.calls[1][2] as AlertButton[];
    await act(async () => { buttons.find((button) => button.style === 'destructive')!.onPress!(); });

    expect(port.deleteThread).toHaveBeenCalledWith('a-old');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Open a history' }).length).toBe(0);
  } finally {
    alert.mockRestore();
    await act(async () => { renderer.unmount(); });
  }
});
