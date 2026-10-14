import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { errorMessageFor } from '@/domain';
import { AssistantChooser, AssistantProblem, AssistantSwitcher } from './assistant-switcher';

jest.mock('@/global.css', () => ({}));
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/qlik/assistant-selection', () => ({ useAssistantSelection: jest.fn() }));
let mockAgentic: { rows: object[]; noAccess: boolean } = { rows: [], noAccess: false };
jest.mock('@/qlik-embed/agentic-entry', () => ({ useAgenticRows: () => mockAgentic, AGENTIC_NO_ACCESS: "You don't have access to the Agentic Assistant" }));
const { useAssistantSelection } = jest.requireMock('@/qlik/assistant-selection');
const assistants = [{ id: 'a', name: 'Knowledge', description: '' }, { id: 'b', name: 'Operations', description: '' }];
const clockRow = { key: 'clock', title: 'ClockSense AI', href: { pathname: '/assistant/agentic', params: { id: 'clock' } } };

beforeEach(() => {
  mockPush.mockReset();
  mockBack.mockReset();
  mockReplace.mockReset();
  mockAgentic = { rows: [], noAccess: false };
});

/** The sheet's content, as the `assistant/choose` route renders it. */
async function open(props: { includeAgentic?: boolean } = {}) {
  const choose = jest.fn().mockResolvedValue(undefined);
  useAssistantSelection.mockReturnValue({ assistants, agentic: [], selected: assistants[0], loading: false, error: null, choose });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantChooser includeAgentic={!!props.includeAgentic} />); });
  return { renderer, choose, text: () => JSON.stringify(renderer.toJSON()) };
}
const row = (renderer: TestRenderer.ReactTestRenderer, label: string) => renderer.root.findByProps({ accessibilityLabel: label });

it('shows the selected Assistant and keeps the list closed until the trigger is pressed', async () => {
  useAssistantSelection.mockReturnValue({ assistants, agentic: [], selected: assistants[0], loading: false, error: null, choose: jest.fn() });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher />); });

  expect(JSON.stringify(renderer.toJSON())).toContain('Knowledge');
  expect(JSON.stringify(renderer.toJSON())).not.toContain('Operations');
});

it('opens the list as its own sheet route, with Agentic Assistants only where they are offered', async () => {
  useAssistantSelection.mockReturnValue({ assistants, agentic: [], selected: assistants[0], loading: false, error: null, choose: jest.fn() });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Choose Assistant' }).props.onPress(); });
  expect(mockPush).toHaveBeenLastCalledWith('/assistant/choose');

  await act(async () => { renderer.update(<AssistantSwitcher includeAgentic placement="header" />); });
  await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Choose Assistant' }).props.onPress(); });
  expect(mockPush).toHaveBeenLastCalledWith('/assistant/choose?agentic=1');
});

describe('the open selector', () => {
  it('lists the Legacy Assistants under their own heading, each labelled Legacy for screen readers, with the current one selected', async () => {
    const { renderer, text } = await open();

    expect(text()).toContain('Choose an Assistant');
    expect(text()).toContain('Legacy Assistants');
    expect(text()).not.toContain('LEGACY');
    expect(text()).toContain('Operations');
    expect(row(renderer, 'Knowledge, Legacy').props.accessibilityState).toMatchObject({ selected: true });
    expect(row(renderer, 'Operations, Legacy').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('chooses a Legacy Assistant without creating a Thread, then closes', async () => {
    const { renderer, choose } = await open();

    await act(async () => { await row(renderer, 'Operations, Legacy').props.onPress(); });

    expect(choose).toHaveBeenCalledWith(assistants[1]);
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('closes from its Close button without choosing', async () => {
    const { renderer, choose } = await open();

    await act(async () => { row(renderer, 'Close').props.onPress(); });

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(choose).not.toHaveBeenCalled();
  });

  it('stays open and says so when the choice cannot be remembered', async () => {
    const { renderer, choose, text } = await open();
    choose.mockRejectedValueOnce(new Error('storage'));

    await act(async () => { await row(renderer, 'Operations, Legacy').props.onPress(); });

    expect(text()).toContain('Could not remember the Assistant');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('lists Agentic Assistants under their own heading, which says once that they open in Qlik', async () => {
    mockAgentic = { rows: [clockRow, { ...clockRow, key: 'sales', title: 'Sales AI' }], noAccess: false };

    const { text } = await open({ includeAgentic: true });

    expect(text()).toContain('Agentic Assistants');
    expect(text()).toContain('ClockSense AI');
    expect(text().split('Opens in Qlik').length - 1).toBe(1);
  });

  it('names each Assistant once, with no kind badge, since the group heading already gives the kind', async () => {
    const { text } = await open();

    expect(text()).not.toContain('"Legacy"');
  });

  it('opens an Agentic Assistant in place of the sheet and leaves the Legacy choice alone', async () => {
    mockAgentic = { rows: [clockRow], noAccess: false };
    const { renderer, choose } = await open({ includeAgentic: true });

    await act(async () => { row(renderer, 'ClockSense AI, Agentic, opens in Qlik').props.onPress(); });

    // Replaced, so Back from the Agentic Assistant returns to the Assistant screen, not to the sheet.
    expect(mockReplace).toHaveBeenCalledWith(clockRow.href);
    expect(choose).not.toHaveBeenCalled();
  });

  it('does not offer Agentic Assistants where only Legacy Assistants make sense (History)', async () => {
    mockAgentic = { rows: [clockRow], noAccess: false };

    const { text } = await open();

    expect(text()).not.toContain('Agentic Assistants');
    expect(text()).not.toContain('ClockSense AI');
  });

  it('says so, in the Agentic group, when the Qlik User cannot view the configured Agentic Assistant', async () => {
    mockAgentic = { rows: [], noAccess: true };

    const { text } = await open({ includeAgentic: true });

    expect(text()).toContain("You don't have access to the Agentic Assistant");
  });
});

it('lets the Qlik User open the list when the one Legacy Assistant is not yet selected', async () => {
  useAssistantSelection.mockReturnValue({ assistants: [assistants[0]], agentic: [], selected: null, loading: false, error: null, choose: jest.fn() });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher />); });

  expect(renderer.root.findByProps({ accessibilityLabel: 'Choose Assistant' }).props.disabled).toBe(false);
});

it('shows nothing rather than an empty sheet when there is nothing to offer', async () => {
  useAssistantSelection.mockReturnValue({ assistants: [], agentic: [{ id: 'g' }], selected: null, loading: false, error: null, choose: jest.fn() });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher includeAgentic />); });

  expect(renderer.toJSON()).toBeNull();
});

it('forgets an earlier failure when the list is opened again', async () => {
  const first = await open();
  first.choose.mockRejectedValueOnce(new Error('storage'));
  await act(async () => { await row(first.renderer, 'Operations, Legacy').props.onPress(); });
  await act(async () => { first.renderer.unmount(); });

  const { text } = await open();

  expect(text()).not.toContain('Could not remember');
});

it('has nothing to open when the only choice is the one Legacy Assistant already selected', async () => {
  useAssistantSelection.mockReturnValue({ assistants: [assistants[0]], agentic: [], selected: assistants[0], loading: false, error: null, choose: jest.fn() });
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(<AssistantSwitcher />); });

  expect(renderer.root.findByProps({ accessibilityLabel: 'Choose Assistant' }).props.disabled).toBe(true);
});

describe('in a navigator header', () => {
  const render = (selection: object) => {
    useAssistantSelection.mockReturnValue({ assistants: [], agentic: [], selected: null, loading: false, error: null, choose: jest.fn(), ...selection });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AssistantSwitcher includeAgentic placement="header" />);
    });
    return renderer;
  };

  it('shows the current Assistant as the trigger', () => {
    const renderer = render({ assistants, selected: assistants[0] });

    expect(JSON.stringify(renderer.toJSON())).toContain('Knowledge');
  });

  it('leaves an error to the screen body, so the header stays compact', () => {
    expect(render({ error: { kind: 'ServiceUnavailable' } }).toJSON()).toBeNull();
  });

  it('leaves "No Assistants available" to the screen body', () => {
    expect(render({}).toJSON()).toBeNull();
  });
});

describe('AssistantProblem', () => {
  const render = (selection: object) => {
    useAssistantSelection.mockReturnValue({ assistants, agentic: [], loading: false, error: null, ...selection });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AssistantProblem />);
    });
    return renderer.toJSON();
  };

  it('says nothing while there are Assistants to choose from', () => {
    expect(render({})).toBeNull();
  });

  it('says nothing while the Assistants load', () => {
    expect(render({ assistants: [], loading: true })).toBeNull();
  });

  it('says nothing when only Agentic Assistants exist', () => {
    expect(render({ assistants: [], agentic: [{ id: 'g' }] })).toBeNull();
  });

  it('explains an error from the Assistants request', () => {
    expect(JSON.stringify(render({ assistants: [], error: { kind: 'ServiceUnavailable' } }))).toContain(errorMessageFor({ kind: 'ServiceUnavailable' }).title);
  });

  it('asks the Qlik User to ask the Tenant admin when there is no Assistant at all', () => {
    expect(JSON.stringify(render({ assistants: [] }))).toContain('Tenant admin');
  });
});

describe('a Qlik User with no classic Assistant (#22)', () => {
  const base = { assistants: [], agentic: [], selected: null, loading: false, error: null, choose: jest.fn() };
  const agentic = [{ id: 'g', name: 'ClockSense AI', description: '', kind: 'agentic' }];
  const render = (selection: object, includeAgentic = false) => {
    useAssistantSelection.mockReturnValue({ ...base, ...selection });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AssistantSwitcher includeAgentic={includeAgentic} />);
    });
    return { renderer, text: JSON.stringify(renderer.toJSON()) };
  };

  it('is not told that the license is missing when an Agentic Assistant is available', () => {
    mockAgentic = { rows: [clockRow], noAccess: false };

    const { text } = render({ agentic }, true);

    expect(text).not.toContain('license');
    expect(text).toContain('Choose an Assistant');
  });

  it('shows nothing on History, which has only Legacy Assistants to offer', () => {
    mockAgentic = { rows: [clockRow], noAccess: false };

    expect(render({ agentic }).renderer.toJSON()).toBeNull();
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
