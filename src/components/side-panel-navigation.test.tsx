import { Stack, useLocalSearchParams } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { act, fireEvent, renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { SidePanelContent } from '@/components/side-panel';
import type { Assistant } from '@/domain';
import { AnswersScope } from '@/qlik/context';
import { createFixtureAnswersPort } from '@/qlik/fixtures/port';

jest.mock('@/global.css', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));

const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const knowledge: Assistant = { kind: 'classic', id: 'assistant-knowledge', name: 'Knowledge', description: '' };

// The chat screen shows the params it got, so a test reads where the side panel sent it.
function ChatScreen() {
  return <Text testID="chat-params">{JSON.stringify(useLocalSearchParams())}</Text>;
}

// The app's shape: the side panel's drawer over Apps and the Assistant's stack, which pushes the Agentic
// screen over the chat. The Agentic screen hides History, so a History test starts on Apps.
function renderApp(initialUrl: string) {
  const port = createFixtureAnswersPort();
  return renderRouter(
    {
      '(drawer)/_layout': () => (
        <AnswersScope port={port}>
          <Drawer drawerContent={SidePanelContent} screenOptions={{ headerShown: false }}>
            <Drawer.Screen name="assistant" />
            <Drawer.Screen name="apps/index" />
          </Drawer>
        </AnswersScope>
      ),
      '(drawer)/assistant/_layout': () => <Stack />,
      '(drawer)/assistant/index': ChatScreen,
      '(drawer)/assistant/agentic': () => <Text>Agentic</Text>,
      '(drawer)/apps/index': () => <Text>Apps</Text>,
    },
    { initialUrl },
  );
}

const chatParams = () => JSON.parse(String(screen.getByTestId('chat-params').props.children));

type State = { routes: { name: string; state?: State }[] } | undefined;
// The screens of the Assistant's stack, bottom first. The root stack holds the drawer, which holds the Assistant.
function assistantStack(state: State): string[] {
  const drawer = state?.routes[0]?.state?.routes.find(({ name }) => name === '(drawer)')?.state;
  return drawer?.routes.find(({ name }) => name === 'assistant')?.state?.routes.map(({ name }) => name) ?? [];
}

beforeEach(() => {
  useAssistantSelection.mockReturnValue({ selected: knowledge, assistants: [knowledge] });
});

describe('side panel navigation', () => {
  it('New chat goes back to the chat screen under the Agentic screen, with a new chat key', async () => {
    const app = await renderApp('/assistant');
    await testRouter.push('/assistant/agentic');

    await act(async () => fireEvent.press(screen.getByLabelText('New chat')));

    expect(screen).toHavePathname('/assistant');
    expect(chatParams()).toEqual({ chat: expect.any(String) });
    expect(assistantStack(app.getRouterState())).toEqual(['index']);
  });

  it('a History row opens its Thread in the chat screen', async () => {
    // The app opens on the Assistant, so its stack exists before Apps is opened.
    const app = await renderApp('/assistant');
    await testRouter.navigate('/apps');

    await act(async () => fireEvent.press(await screen.findByLabelText('Open Q3 policy changes')));

    expect(screen).toHavePathname('/assistant');
    expect(chatParams()).toEqual({ thread: 'thread-1', assistantId: 'assistant-knowledge' });
    expect(assistantStack(app.getRouterState())).toEqual(['index']);
  });
});
