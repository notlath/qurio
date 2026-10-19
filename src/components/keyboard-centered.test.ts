import { welcomeLift } from '@/components/keyboard-centered';

// Reanimated's worklets do not load under Jest, so each library's own mock stands in.
jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => jest.requireActual('react-native-reanimated/mock'));
jest.mock('react-native-keyboard-controller', () => ({}));

it('stays put while the keyboard is down', () => {
  expect(welcomeLift(0, 34, 200)).toBe(0);
});

it('rises half the distance the composer rises, so it stays centred above it', () => {
  // A 334pt keyboard lifts the composer 300pt: the home indicator inset is handed back.
  expect(welcomeLift(334, 34, 400)).toBe(150);
});

it('never rises past the room above it, so its top stays in view on a small screen', () => {
  expect(welcomeLift(334, 34, 60)).toBe(60);
  expect(welcomeLift(334, 34, -10)).toBe(0);
});
