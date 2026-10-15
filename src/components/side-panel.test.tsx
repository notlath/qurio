import OpeningScreen from '@/app/index';
import { edgeSwipeEnabled } from '@/components/side-panel';

jest.mock('@/global.css', () => ({}));
// The drawer loads Reanimated, whose worklets do not load under Jest, so each library's own mock stands in.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

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
    ['Settings, which pushes over the destinations', drawerRoute('settings', ['index'])],
  ])('leaves the left edge to swipe-to-go-back on %s', (_, route) => {
    expect(edgeSwipeEnabled(route)).toBe(false);
  });
});

it('opens the app on the Assistant', () => {
  expect(OpeningScreen().props.href).toBe('/assistant');
});
