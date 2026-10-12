import React from 'react';
import { Alert } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { adoptTokens, forgetAccessToken } from '@/auth/access-token';
import { SignInSection } from './sign-in-section';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn() }));
const mockSignOut = jest.fn();
jest.mock('@/auth/session', () => ({
  useQlikAuth: () => ({ signIn: jest.fn(), signOut: mockSignOut, ready: true }),
}));
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
  mockSignOut.mockReset();
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

describe('Sign out confirmation', () => {
  async function pressSignOut() {
    await adoptTokens({ accessToken: 'access-1', rawResponse: { expires_at: '2099-01-01T00:00:00Z' } } as never);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SignInSection config={config} />);
    });
    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress();
    });
    return alert;
  }

  it('asks first and does not sign out until the user confirms', async () => {
    const alert = await pressSignOut();

    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('keeps the session when the user cancels', async () => {
    const alert = await pressSignOut();
    const buttons = alert.mock.calls[0][2]!;

    await act(async () => {
      buttons.find((b) => b.style === 'cancel')?.onPress?.();
    });

    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('signs out when the user confirms', async () => {
    const alert = await pressSignOut();
    const buttons = alert.mock.calls[0][2]!;

    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });
});
