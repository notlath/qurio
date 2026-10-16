import type { DrawerContentComponentProps } from 'expo-router/drawer';
import { Alert, FlatList, TextInput, type AlertButton } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import OpeningScreen from '@/app/index';
import { RowMenu } from '@/components/row-menu';
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
// panel is open. `assistantStack` is the Assistant's stack, once it has state. `params` go to its top screen.
function drawerProps(open: boolean, assistantStack?: string[], params?: object) {
  const navigation = { closeDrawer: jest.fn(), navigate: jest.fn() };
  const state = {
    key: 'drawer',
    index: 0,
    routes: [drawerRoute('assistant', assistantStack, params), { key: 'apps', name: 'apps' }],
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
const selectedRows = (renderer: TestRenderer.ReactTestRenderer) => [
  ...new Set(renderer.root.findAll((node) => node.props.accessibilityState?.selected === true).map((node) => node.props.accessibilityLabel)),
];
const threadLabels = (renderer: TestRenderer.ReactTestRenderer) => [
  ...new Set(
    renderer.root
      .findAll((node) => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open '))
      .map((node) => node.props.accessibilityLabel),
  ),
];

// A long press opens the row's native menu. Jest cannot long-press a native view, so a test picks the
// menu item the way the native menu reports it.
const rowMenu = (renderer: TestRenderer.ReactTestRenderer, name: string) =>
  renderer.root.findAllByType(RowMenu).find((menu) => menu.findAllByProps({ accessibilityLabel: `Open ${name}` }).length > 0)!;
const choose = async (renderer: TestRenderer.ReactTestRenderer, name: string, title: string) => {
  const menu = rowMenu(renderer, name);
  const action = menu.props.actions.find((a: { title: string }) => a.title === title);
  await act(async () => {
    menu.props.onPressAction({ nativeEvent: { event: action.id ?? action.title } });
  });
};

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

  it('opens a Thread with its Assistant as the current chat and closes the panel', async () => {
    const { renderer, props } = await renderPanel();

    await press(renderer, 'Open Q3 policy changes');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(props.navigation.navigate).toHaveBeenCalledWith('assistant', {
      screen: 'index',
      params: { thread: 'thread-1', assistantId: 'assistant-knowledge' },
      pop: true,
    });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it.each([
    ['opened from History', { thread: 'thread-2', assistantId: 'assistant-knowledge' }],
    ['started by a new chat', { chat: '1', started: 'thread-2' }],
  ])('highlights the open Thread %s, and only closes the panel when it is tapped', async (_, chat) => {
    const { renderer, props } = await renderPanel(createFixtureAnswersPort(), drawerProps(true, ['index'], chat));

    expect(selectedRows(renderer)).toEqual(['Open Onboarding checklist']);
    await press(renderer, 'Open Onboarding checklist');
    expect(props.navigation.closeDrawer).toHaveBeenCalled();
    expect(props.navigation.navigate).not.toHaveBeenCalled();
  });

  it('highlights nothing for a new chat with no question yet', async () => {
    const { renderer } = await renderPanel(createFixtureAnswersPort(), drawerProps(true, ['index'], { chat: '1' }));

    expect(threadLabels(renderer)).toHaveLength(5);
    expect(selectedRows(renderer)).toEqual([]);
  });

  // The docked panel never goes from closed to open, so the open Thread is what tells it to reload.
  it('loads History again when the first question starts a Thread, so the open panel lists it', async () => {
    const port = createFixtureAnswersPort();
    const { renderer, props } = await renderPanel(port, drawerProps(true, ['index'], { chat: '1' }));

    let fresh!: { id: string };
    await act(async () => {
      fresh = await port.createThread('Fresh question');
    });
    expect(threadLabels(renderer)).not.toContain('Open Fresh question');
    await act(async () => {
      renderer.update(panel(port, { ...drawerProps(true, ['index'], { chat: '1', started: fresh.id }), navigation: props.navigation }));
    });
    expect(threadLabels(renderer)[0]).toBe('Open Fresh question');
    expect(selectedRows(renderer)).toEqual(['Open Fresh question']);
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

  it('shows the error when the next page fails to load, and loads it on Retry', async () => {
    const fixture = createFixtureAnswersPort();
    const listThreads = jest.fn(fixture.listThreads);
    const { renderer } = await renderPanel({ ...fixture, listThreads });

    listThreads.mockRejectedValueOnce({ kind: 'ServiceUnavailable' });
    await act(async () => {
      renderer.root.findByType(FlatList).props.onEndReached();
    });
    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' }).length).toBeGreaterThan(0);
    expect(threadLabels(renderer)).toHaveLength(5);
    await press(renderer, 'Retry');
    expect(threadLabels(renderer)).toHaveLength(10);
    expect(renderer.root.findAllByProps({ accessibilityRole: 'alert' })).toEqual([]);
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

  describe('deleting a Thread', () => {
    let alert: jest.SpyInstance;
    beforeEach(() => {
      alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });
    afterEach(() => alert.mockRestore());

    const row = (renderer: TestRenderer.ReactTestRenderer) =>
      renderer.root.findAllByProps({ accessibilityLabel: 'Open Q3 policy changes' })[0];
    const chooseDelete = async (renderer: TestRenderer.ReactTestRenderer) => choose(renderer, 'Q3 policy changes', 'Delete');
    const answer = async (text: string) => {
      const buttons = alert.mock.calls.at(-1)[2] as AlertButton[];
      await act(async () => {
        buttons.find((button) => button.text === text)!.onPress?.();
      });
    };
    function deletablePort() {
      const fixture = createFixtureAnswersPort();
      return { ...fixture, deleteThread: jest.fn(fixture.deleteThread) };
    }

    it('asks first from the row menu, and keeps the Thread on Cancel', async () => {
      const port = deletablePort();
      const { renderer } = await renderPanel(port);

      await chooseDelete(renderer);
      expect(alert).toHaveBeenLastCalledWith(
        'Delete conversation?',
        '"Q3 policy changes" and its answers will be permanently removed.',
        expect.any(Array),
        expect.any(Object),
      );
      await answer('Cancel');
      expect(port.deleteThread).not.toHaveBeenCalled();
      expect(threadLabels(renderer)).toContain('Open Q3 policy changes');
    });

    it('deletes the Thread on Delete, and leaves the Assistant view as it is', async () => {
      const port = deletablePort();
      const { renderer, props } = await renderPanel(port);

      await chooseDelete(renderer);
      await answer('Delete');
      expect(port.deleteThread).toHaveBeenCalledWith('thread-1');
      expect(threadLabels(renderer)).not.toContain('Open Q3 policy changes');
      expect(props.navigation.navigate).not.toHaveBeenCalled();
    });

    it("asks the same from the screen reader's Delete action", async () => {
      const port = deletablePort();
      const { renderer } = await renderPanel(port);

      expect(row(renderer).props.accessibilityActions).toContainEqual({ name: 'delete', label: 'Delete' });
      await act(async () => {
        row(renderer).props.onAccessibilityAction({ nativeEvent: { actionName: 'delete' } });
      });
      expect(alert).toHaveBeenLastCalledWith('Delete conversation?', expect.any(String), expect.any(Array), expect.any(Object));
      await answer('Delete');
      expect(port.deleteThread).toHaveBeenCalledWith('thread-1');
    });

    it('returns the Assistant view to a new chat when the deleted Thread is open', async () => {
      const port = deletablePort();
      const { renderer, props } = await renderPanel(port, drawerProps(true, ['index'], { thread: 'thread-1', assistantId: 'assistant-knowledge' }));

      await chooseDelete(renderer);
      await answer('Delete');
      expect(port.deleteThread).toHaveBeenCalledWith('thread-1');
      expect(props.navigation.navigate).toHaveBeenCalledWith('assistant', {
        screen: 'index',
        params: { chat: expect.any(String) },
        pop: true,
      });
    });

    it('keeps the deleted Thread open when the delete fails, and puts its row back', async () => {
      const port = { ...createFixtureAnswersPort(), deleteThread: jest.fn().mockRejectedValue({ kind: 'ServiceUnavailable' }) };
      const { renderer, props } = await renderPanel(port, drawerProps(true, ['index'], { thread: 'thread-1', assistantId: 'assistant-knowledge' }));

      await chooseDelete(renderer);
      await answer('Delete');
      expect(alert).toHaveBeenLastCalledWith('Could not delete conversation', expect.any(String));
      expect(threadLabels(renderer)).toContain('Open Q3 policy changes');
      expect(props.navigation.navigate).not.toHaveBeenCalled();
    });
  });

  describe('renaming a Thread', () => {
    let alert: jest.SpyInstance;
    beforeEach(() => {
      alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });
    afterEach(() => alert.mockRestore());

    const dialogField = (renderer: TestRenderer.ReactTestRenderer) => renderer.root.findAllByType(TextInput)[0];
    async function rename(renderer: TestRenderer.ReactTestRenderer, name: string) {
      await choose(renderer, 'Q3 policy changes', 'Rename');
      await act(async () => dialogField(renderer).props.onChangeText(name));
      await act(async () => renderer.root.findAllByProps({ accessibilityLabel: 'Save' })[0].props.onPress());
    }

    it('offers Rename and Delete on a long press', async () => {
      const { renderer } = await renderPanel();

      const menu = rowMenu(renderer, 'Q3 policy changes');
      expect(menu.props.shouldOpenOnLongPress).toBe(true);
      expect(menu.props.actions.map((a: { title: string }) => a.title)).toEqual(['Rename', 'Delete']);
    });

    it('opens the rename dialog with the current name, from the menu and from the screen reader', async () => {
      const { renderer } = await renderPanel();

      await choose(renderer, 'Q3 policy changes', 'Rename');
      expect(dialogField(renderer).props.value).toBe('Q3 policy changes');
      await act(async () => renderer.root.findAllByProps({ accessibilityLabel: 'Cancel' })[0].props.onPress());
      expect(renderer.root.findAllByType(TextInput)).toEqual([]);

      const row = renderer.root.findAllByProps({ accessibilityLabel: 'Open Q3 policy changes' })[0];
      expect(row.props.accessibilityActions).toContainEqual({ name: 'rename', label: 'Rename' });
      await act(async () => row.props.onAccessibilityAction({ nativeEvent: { actionName: 'rename' } }));
      expect(dialogField(renderer).props.value).toBe('Q3 policy changes');
    });

    it('saves the new name, lists it, and keeps the open Thread open and highlighted', async () => {
      const fixture = createFixtureAnswersPort();
      const port = { ...fixture, renameThread: jest.fn(fixture.renameThread) };
      const { renderer, props } = await renderPanel(port, drawerProps(true, ['index'], { thread: 'thread-1', assistantId: 'assistant-knowledge' }));

      await rename(renderer, 'Travel policy');
      expect(port.renameThread).toHaveBeenCalledWith('thread-1', 'Travel policy');
      expect(threadLabels(renderer)[0]).toBe('Open Travel policy');
      expect(selectedRows(renderer)).toEqual(['Open Travel policy']);
      expect(props.navigation.navigate).not.toHaveBeenCalled();
      expect(renderer.root.findAllByType(TextInput)).toEqual([]);
    });

    it('shows the new name while the save is in progress', async () => {
      let finish!: () => void;
      const port = { ...createFixtureAnswersPort(), renameThread: () => new Promise<void>((resolve) => (finish = resolve)) };
      const { renderer } = await renderPanel(port);

      await rename(renderer, 'Travel policy');
      expect(threadLabels(renderer)[0]).toBe('Open Travel policy');
      await act(async () => finish());
    });

    it('restores the old name and says why when the save fails, and keeps the draft', async () => {
      const port = { ...createFixtureAnswersPort(), renameThread: jest.fn().mockRejectedValue({ kind: 'Offline' }) };
      const { renderer } = await renderPanel(port);

      await rename(renderer, 'Travel policy');
      expect(alert).toHaveBeenLastCalledWith('Could not rename conversation', expect.stringMatching(/connect/i));
      expect(threadLabels(renderer)[0]).toBe('Open Q3 policy changes');
      expect(dialogField(renderer).props.value).toBe('Travel policy');
    });
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

  it('keeps the Agentic Assistant note while the Assistant chooser is open over it', async () => {
    const { renderer } = await renderPanel(createFixtureAnswersPort(), drawerProps(true, ['index', 'agentic', 'choose']));

    expect(hasText(renderer, 'Agentic Assistant chats are kept in the Assistant view.')).toBe(true);
    expect(hasText(renderer, 'History · Knowledge')).toBe(false);
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
function drawerRoute(name: string, stack?: string[], params?: object) {
  const routes = stack?.map((screen, i) => ({ key: screen, name: screen, params: i === stack.length - 1 ? params : undefined }));
  return { key: name, name, state: routes && { index: routes.length - 1, routes } };
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
