import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as AuthSession from 'expo-auth-session';

import { forgetAccessToken, peekAccessToken } from '@/auth/access-token';
import { SignInSection } from '@/components/sign-in-section';

import { clearTokens, loadRefreshToken, saveRefreshToken } from './tokens';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
jest.mock('expo-auth-session', () => ({
  Prompt: { Login: 'login' },
  TokenTypeHint: { RefreshToken: 'refresh_token' },
  useAuthRequest: jest.fn((options) => [{ codeVerifier: 'verifier' }, null, () => mockPromptAsync(options)]),
  exchangeCodeAsync: jest.fn(),
  revokeAsync: jest.fn().mockResolvedValue(true),
}));
jest.mock('expo-device', () => ({
  DeviceType: { PHONE: 1, TABLET: 2 },
  getDeviceTypeAsync: jest.fn().mockResolvedValue(1),
}));
jest.mock('./tokens', () => ({
  loadExpiresAtMs: jest.fn().mockResolvedValue(null),
  loadRefreshToken: jest.fn().mockResolvedValue(null),
  saveExpiresAtMs: jest.fn(),
  saveRefreshToken: jest.fn(),
  clearTokens: jest.fn(),
}));

const mockPromptAsync = jest.fn();
const config = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

async function signIn(): Promise<TestRenderer.ReactTestRenderer> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SignInSection config={config} />);
  });
  await act(async () => {
    await renderer.root.findByProps({ label: 'Sign in' }).props.onPress();
  });
  return renderer;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPromptAsync.mockReset();
  (loadRefreshToken as jest.Mock).mockResolvedValue(null);
  (saveRefreshToken as jest.Mock).mockReset();
  (clearTokens as jest.Mock).mockReset();
  forgetAccessToken();
});

it('lets another Qlik account sign in after sign-out despite the existing browser session', async () => {
  let browserAccount = 'previous-account';
  let selectedAccount = browserAccount;
  let storedRefreshToken: string | null = null;
  (loadRefreshToken as jest.Mock).mockImplementation(async () => storedRefreshToken);
  (saveRefreshToken as jest.Mock).mockImplementation(async (token: string) => {
    storedRefreshToken = token;
  });
  (clearTokens as jest.Mock).mockImplementation(async () => {
    storedRefreshToken = null;
  });
  mockPromptAsync.mockImplementation(async ({ prompt }: { prompt?: string }) => {
    if (prompt === 'login') browserAccount = selectedAccount;
    return { type: 'success', params: { code: browserAccount } };
  });
  (AuthSession.exchangeCodeAsync as jest.Mock).mockImplementation(async ({ code }: { code: string }) => ({
    accessToken: `${code}-access`, refreshToken: `${code}-refresh`, expiresIn: 3600,
  }));

  const renderer = await signIn();
  await act(async () => {
    await renderer.root.findAllByProps({ accessibilityLabel: 'Sign out' })[0].props.onPress();
  });

  expect(AuthSession.revokeAsync).toHaveBeenCalledWith(
    { token: 'previous-account-access', clientId: config.clientId }, expect.any(Object),
  );
  expect(AuthSession.revokeAsync).toHaveBeenCalledWith(
    { token: 'previous-account-refresh', clientId: config.clientId, tokenTypeHint: 'refresh_token' }, expect.any(Object),
  );
  expect(peekAccessToken()).toBeNull();
  expect(storedRefreshToken).toBeNull();

  selectedAccount = 'different-account';
  await act(async () => {
    await renderer.root.findByProps({ label: 'Sign in' }).props.onPress();
  });
  expect(peekAccessToken()).toBe('different-account-access');
  expect(storedRefreshToken).toBe('different-account-refresh');
  await act(async () => renderer.unmount());
});

it('tells the Qlik User that the Tenant admin must approve the app for OAUTH-28', async () => {
  mockPromptAsync.mockResolvedValue({
    type: 'error',
    params: { error: 'access_denied', error_code: 'OAUTH-28' },
  });

  const renderer = await signIn();

  expect(JSON.stringify(renderer.toJSON())).toContain('Your Tenant admin must approve the app once');
});

it.each(['OAUTH-27', 'OAUTH-20'])('keeps %s access_denied silent instead of requesting Tenant Approval', async (errorCode) => {
  mockPromptAsync.mockResolvedValue({ type: 'error', params: { error: 'access_denied', error_code: errorCode } });

  const rendered = JSON.stringify((await signIn()).toJSON());

  expect(rendered).toContain('Not signed in');
  expect(rendered).not.toContain('Your Tenant admin');
});

it.each(['cancel', 'dismiss'])('keeps %s silent', async (type) => {
  mockPromptAsync.mockResolvedValue({ type });

  const rendered = JSON.stringify((await signIn()).toJSON());

  expect(rendered).toContain('Not signed in');
  expect(rendered).not.toContain('Your Tenant admin');
});

it('still signs in after a successful authorization', async () => {
  mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'code-1' } });
  (AuthSession.exchangeCodeAsync as jest.Mock).mockResolvedValue({ accessToken: 'access-1', expiresIn: 3600 });

  const rendered = JSON.stringify((await signIn()).toJSON());

  expect(rendered).toContain('Signed in');
  expect(rendered).not.toContain('Not signed in');
});

it('retains the existing message when the token exchange fails', async () => {
  mockPromptAsync.mockResolvedValue({ type: 'success', params: { code: 'code-1' } });
  (AuthSession.exchangeCodeAsync as jest.Mock).mockRejectedValue(new Error('Token exchange failed.'));

  expect(JSON.stringify((await signIn()).toJSON())).toContain('Token exchange failed.');
});
