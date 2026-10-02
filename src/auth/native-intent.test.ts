import { redirectSystemPath } from '@/app/+native-intent';

describe('redirectSystemPath', () => {
  it.each([
    'qlikanswers://auth?code=abc&state=xyz&iss=https://t.example',
    'qlikanswers://auth',
    '/auth?code=abc',
  ])('sends the OAuth redirect %s back to Settings, where sign-in starts', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe('/settings');
  });

  it.each(['/settings', '/assistant/thread/1', 'qlikanswers://history', '/authors'])('leaves %s alone', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });
});
