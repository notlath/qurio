import { redirectSystemPath } from '@/app/+native-intent';

describe('redirectSystemPath', () => {
  it.each([
    'qlikanswers://auth?code=abc&state=xyz&iss=https://t.example',
    'qlikanswers://auth',
    '/auth?code=abc',
  ])('sends the OAuth redirect %s to the home route', (path) => {
    expect(redirectSystemPath({ path, initial: false })).toBe('/');
  });

  it.each(['/settings', '/thread/1', 'qlikanswers://history', '/authors'])('leaves %s alone', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
  });
});
