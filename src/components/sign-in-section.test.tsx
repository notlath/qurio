import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { adoptTokens, forgetAccessToken } from '@/auth/access-token';
import { SignInSection } from './sign-in-section';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
jest.mock('@/auth/session', () => ({
  useQlikAuth: () => ({ signIn: jest.fn(), signOut: jest.fn(), ready: true }),
}));
jest.mock('expo-auth-session', () => ({ makeRedirectUri: () => 'qlikanswers://auth' }));
jest.mock('@/auth/tokens', () => ({
  loadExpiresAtMs: jest.fn().mockResolvedValue(null),
  loadRefreshToken: jest.fn().mockResolvedValue(null),
  saveExpiresAtMs: jest.fn(),
  saveRefreshToken: jest.fn(),
}));

const { loadRefreshToken } = jest.requireMock('@/auth/tokens');
const config = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

async function renderSection(): Promise<string> {
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(<SignInSection config={config} />);
  });
  return JSON.stringify(renderer.toJSON());
}

beforeEach(() => {
  forgetAccessToken();
  loadRefreshToken.mockResolvedValue(null);
});

describe('SignInSection on a fresh mount', () => {
  it('says "Signed in" when this device already holds a session from earlier', async () => {
    await adoptTokens({ accessToken: 'access-1', rawResponse: { expires_at: '2099-01-01T00:00:00Z' } } as never);

    const rendered = await renderSection();

    expect(rendered).toContain('Signed in');
    expect(rendered).not.toContain('Not signed in');
    expect(rendered).toContain('Sign out');
  });

  it('says "Signed in" after an app restart, when only the stored refresh token remains', async () => {
    loadRefreshToken.mockResolvedValue('refresh-1');

    expect(await renderSection()).toContain('Signed in');
  });

  it('says "Not signed in" when there is no session at all', async () => {
    const rendered = await renderSection();

    expect(rendered).toContain('Not signed in');
    expect(rendered).toContain('Sign in');
  });
});
