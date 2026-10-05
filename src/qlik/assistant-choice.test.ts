import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Assistant } from '@/domain';
import type { AnswersPort } from './port';
import { loadAssistantChoice, rememberAssistantChoice } from './assistant-choice';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
const a = { id: 'a', name: 'A', description: '', kind: 'classic' as const };
const b = { id: 'b', name: 'B', description: '', kind: 'classic' as const };
const list = (assistants: Assistant[]) => ({ listAssistants: async () => assistants }) as AnswersPort;

it('defaults to the remembered Assistant and remembers it per Tenant across restart', async () => {
  const stored = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key) => stored.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => { stored.set(key, value); });
  await rememberAssistantChoice('one', 'b');
  expect((await loadAssistantChoice(list([a, b]), 'one')).selected).toEqual(b);
  expect((await loadAssistantChoice(list([a, b]), 'two')).selected).toBeNull();
});

it.each([
  [[a], null, 'a'],
  [[a, b], null, undefined],
  [[], 'a', undefined],
  [[a], 'gone', 'a'],
  [[a, b], 'gone', undefined],
])('applies the choice rules for available Assistants %j and remembered %s', async (assistants, remembered, expected) => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(remembered);
  expect((await loadAssistantChoice(list(assistants as Assistant[]), 'tenant')).selected?.id).toBe(expected);
});

it('excludes Agentic Assistants before applying the classic choice rules', async () => {
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  const agentic = { id: 'agent', name: 'Agentic', description: '', kind: 'agentic' as const };
  const result = await loadAssistantChoice(list([a, agentic]), 'tenant');
  expect(result.assistants).toEqual([a]);
  expect(result.selected).toEqual(a);
});
