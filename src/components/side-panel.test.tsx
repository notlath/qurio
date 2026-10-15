import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { FlatList } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import OpeningScreen from '@/app/index';
import { edgeSwipeEnabled, SidePanelContent } from '@/components/side-panel';
import type { Assistant } from '@/domain';
import { AnswersScope } from '@/qlik/context';
import { createFixtureAnswersPort } from '@/qlik/fixtures/port';
import type { AnswersPort } from '@/qlik/port';

jest.mock('@/global.css', () => ({}));
// The drawer loads Reanimated, whose worklets do not load under Jest, so each library's own mock stands in.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
const mockRouter = { push: jest.fn() };
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), useRouter: () => mockRouter }));

const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const knowledge: Assistant = { kind: 'classic', id: 'assistant-knowledge', name: 'Knowledge', description: '' };

// The drawer hands its content the drawer's navigation and state. The state's history says whether the
// panel is open. `assistantStack` is the Assistant's stack, once it has state.
function drawerProps(open: boolean, assistantStack?: string[]) {
  const navigation = { closeDrawer: jest.fn(), navigate: jest.fn() };
  const state = {
    key: 'drawer',
    index: 0,
    routes: [drawerRoute('assistant', assistantStack), { key: 'apps', name: 'apps' }],
    history: open ? [{ type: 'route', key: 'assistant' }, { type: 'drawer', status: 'open' }] : [{ type: 'route', key: 'assistant' }],
  };
  return { navigation, state, descriptors: {} } as unknown as DrawerContentComponentProps & { navigation: typeof navigation };
}

function panel(port: AnswersPort, props: DrawerContentComponentProps) {
  return (
    <AnswersScope port={port}>
      <SidePanelContent {...props} />
    </AnswersScope>
  );
}

async function renderPanel(port: AnswersPort = createFixtureAnswersPort(), props = drawerProps(true)) {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(panel(port, props));
  });
  mounted.push(renderer);
  return { renderer, props };
}
const mounted: TestRenderer.ReactTestRenderer[] = [];
afterEach(async () => {
  await act(async () => mounted.splice(0).forEach((renderer) => renderer.unmount()));
});

const hasText = (renderer: TestRenderer.ReactTestRenderer, text: string) =>
  renderer.root.findAll((node) => node.props.children === text).length > 0;
const press = async (renderer: TestRenderer.ReactTestRenderer, label: string) => {
  await act(async () => {
    renderer.root.findAllByProps({ accessibilityLabel: label })[0].props.onPress();
  });
};
const threadLabels = (renderer: TestRenderer.ReactTestRenderer) => [
  ...new Set(
    renderer.root
      .findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open '))
      .map((node) => node.props.accessibilityLabel),
  ),
];

beforeEach(() => {
  mockRouter.push.mockReset();
  useAssistantSelection.mockReturnValue({ selected: knowledge, assistants: [knowledge] });
});

describe('SidePanelContent', () => {
  it('shows the Qurio name and closes from its close button', async () => {
    const { renderer, props } = await renderPanel();

    expect(hasText(renderer, 'Qurio')).toBe(true);
    await press(renderer, 'Close side panel');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
  });

  it("lists the selected Assistant's History newest first, and loads the next page at the end", async () => {
    const { renderer } = await renderPanel();

    expect(hasText(renderer, 'History · Knowledge')).toBe(true);
    expect(threadLabels(renderer)).toEqual([
      'Open Q3 policy changes',
      'Open Onboarding checklist',
      'Open Expense report questions',
      'Open Holiday schedule',
      'Open Benefits enrollment',
    ]);
    await act(async () => {
      renderer.root.findByType(FlatList).props.onEndReached();
    });
    expect(threadLabels(renderer)).toHaveLength(10);
  });

  it('opens a Thread with its Assistant and closes the panel', async () => {
    const { renderer, props } = await renderPanel();

    await press(renderer, 'Open Q3 policy changes');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/assistant/thread/[id]',
      params: { id: 'thread-1', assistantId: 'assistant-knowledge', assistantName: 'Knowledge' },
    });
  });

  it('says so when the Assistant has no History', async () => {
    const port = { ...createFixtureAnswersPort(), listThreads: async () => ({ items: [] }) };
    const { renderer } = await renderPanel(port);

    expect(hasText(renderer, 'No conversations yet')).toBe(true);
  });

  it('shows the error when History fails to load, and loads it again on Retry', async () => {
    const fixture = createFixtureAnswersPort();
    const listThreads = jest.fn(fixture.listThreads).mockRejectedValueOnce({ kind: 'ServiceUnavailable' });
    const { renderer } = await renderPanel({ ...fixture, listThreads });

    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' }).length).toBeGreaterThan(0);
    expect(threadLabels(renderer)).toEqual([]);
    await press(renderer, 'Retry');
    expect(threadLabels(renderer)).toHaveLength(5);
  });

  it('loads History again each time the panel opens, so a new Thread is listed', async () => {
    const port = createFixtureAnswersPort();
    const closed = drawerProps(false);
    const { renderer } = await renderPanel(port, closed);

    await act(async () => {
      await port.createThread('Fresh question');
    });
    expect(threadLabels(renderer)).not.toContain('Open Fresh question');
    await act(async () => {
      renderer.update(panel(port, { ...drawerProps(true), navigation: closed.navigation }));
    });
    expect(threadLabels(renderer)[0]).toBe('Open Fresh question');
  });

  it('starts a new chat on the Assistant', async () => {
    const { renderer, props } = await renderPanel();

    await press(renderer, 'New chat');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(props.navigation.navigate).toHaveBeenCalledWith('assistant', {
      screen: 'index',
      params: { chat: expect.any(String) },
      pop: true,
    });
  });

  it('opens Apps', async () => {
    const { renderer, props } = await renderPanel();

    await press(renderer, 'Apps');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(props.navigation.navigate).toHaveBeenCalledWith('apps');
  });

  it('says where Agentic Assistant chats are kept while an Agentic Assistant is in use, and shows History again after a Legacy one', async () => {
    const port = createFixtureAnswersPort();
    const { renderer, props } = await renderPanel(port, drawerProps(true, ['index', 'agentic']));

    expect(hasText(renderer, 'Agentic Assistant chats are kept in the Assistant view.')).toBe(true);
    expect(hasText(renderer, 'History · Knowledge')).toBe(false);
    expect(threadLabels(renderer)).toEqual([]);

    // Back from the Agentic Assistant returns to the Legacy Assistant.
    await act(async () => {
      renderer.update(panel(port, { ...drawerProps(true, ['index']), navigation: props.navigation }));
    });
    expect(hasText(renderer, 'Agentic Assistant chats are kept in the Assistant view.')).toBe(false);
    expect(hasText(renderer, 'History · Knowledge')).toBe(true);
    expect(threadLabels(renderer)).toHaveLength(5);
  });

  it("shows the Qlik User's Profile, and its gear pushes Settings", async () => {
    const { renderer, props } = await renderPanel();

    expect(hasText(renderer, 'Alex Morgan')).toBe(true);
    await press(renderer, 'Settings');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(mockRouter.push).toHaveBeenCalledWith('/settings');
  });
});

// A drawer route as React Navigation hands it to `screenOptions`: the nested stack's state, once it has one.
function drawerRoute(name: string, stack?: string[]) {
  return { key: name, name, state: stack && { index: stack.length - 1, routes: stack.map((screen) => ({ key: screen, name: screen })) } };
}

describe('edgeSwipeEnabled', () => {
  it.each([
    ['the Assistant, before its stack has state', drawerRoute('assistant')],
    ['the Assistant', drawerRoute('assistant', ['index'])],
    ['Apps', drawerRoute('apps', ['index'])],
  ])('opens the side panel from the left edge on %s', (_, route) => {
    expect(edgeSwipeEnabled(route)).toBe(true);
  });

  it.each([
    ['History', drawerRoute('assistant', ['index', 'history'])],
    ['a Thread', drawerRoute('assistant', ['index', 'history', 'thread/[id]'])],
    ['the Agentic Assistant', drawerRoute('assistant', ['index', 'agentic'])],
    ['the Assistant chooser sheet', drawerRoute('assistant', ['index', 'choose'])],
    ['an Analytics App', drawerRoute('apps', ['index', '[id]'])],
    ['Settings beside the docked panel, after the window narrows', drawerRoute('docked-settings', ['index'])],
  ])('leaves the left edge to swipe-to-go-back on %s', (_, route) => {
    expect(edgeSwipeEnabled(route)).toBe(false);
  });
});

it('opens the app on the Assistant', () => {
  expect(OpeningScreen().props.href).toBe('/assistant');
});
