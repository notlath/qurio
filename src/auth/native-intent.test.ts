import { Dimensions } from 'react-native';

import { redirectSystemPath } from '@/app/+native-intent';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('redirectSystemPath', () => {
  it.each([
    'qlikanswers://auth?code=abc&state=xyz&iss=https://t.example',
    'qlikanswers://auth',
    '/auth?code=abc',
  ])('sends the OAuth redirect %s back to Settings, where sign-in starts', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe('/settings');
  });

  it('sends the OAuth redirect to Settings beside the docked side panel on a wide window', () => {
    jest.spyOn(Dimensions, 'get').mockReturnValueOnce({ width: 1024, height: 768, scale: 2, fontScale: 1 });
    expect(redirectSystemPath({ path: 'qlikanswers://auth?code=abc', initial: false })).toBe('/docked-settings');
  });

  it.each(['/settings', '/assistant/thread/1', 'qlikanswers://history', '/authors'])('leaves %s alone', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });
});
