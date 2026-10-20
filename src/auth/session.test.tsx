import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import * as AuthSession from 'expo-auth-session';

import { forgetAccessToken } from '@/auth/access-token';
import { SignInSection } from '@/components/sign-in-section';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
const mockPort = { getCurrentUser: jest.fn().mockResolvedValue({ id: 'user-1', name: 'Alex Morgan' }) };
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn(), useAnswersPort: () => mockPort }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
jest.mock('expo-auth-session', () => ({
  useAuthRequest: () => [{ codeVerifier: 'verifier' }, null, mockPromptAsync],
  exchangeCodeAsync: jest.fn(),
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
  forgetAccessToken();
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

it('opens the sign-in sheet without sharing the phone browser session: a sign-out must ask for credentials again', async () => {
  mockPromptAsync.mockResolvedValue({ type: 'cancel' });

  await signIn();

  expect(mockPromptAsync).toHaveBeenCalledWith({ preferEphemeralSession: true });
});
