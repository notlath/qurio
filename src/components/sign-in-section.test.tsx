import React from 'react';
import { Alert, Share } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';

import { PrimaryButton } from '@/components/pressable';
import { adoptTokens, forgetAccessToken } from '@/auth/access-token';
import type { QlikUser } from '@/domain';
import { SignInSection } from './sign-in-section';

jest.mock('@/global.css', () => ({}));
jest.mock('@/config', () => ({ IS_INTERNAL_BUILD: false }));
const mockGetCurrentUser = jest.fn();
const mockPort = { getCurrentUser: mockGetCurrentUser };
let mockActivePort = mockPort;
jest.mock('@/qlik/context', () => ({ useReloadAnswersPort: () => jest.fn(), useAnswersPort: () => mockActivePort }));
jest.mock('@/components/icon', () => ({ Icon: () => null }));
const mockSignOut = jest.fn();
const mockSignIn = jest.fn();
jest.mock('@/auth/session', () => ({
  useQlikAuth: () => ({ signIn: mockSignIn, signOut: mockSignOut, ready: true }),
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
  mockSignIn.mockReset();
  mockGetCurrentUser.mockReset().mockResolvedValue({ id: 'user-1', name: 'Alex Morgan', email: 'alex@example.com' });
  mockActivePort = mockPort;
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
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });
});

describe('Profile in Settings', () => {
  let renderer: TestRenderer.ReactTestRenderer;
  const text = () => JSON.stringify(renderer.toJSON());
  async function showProfile() {
    loadRefreshToken.mockResolvedValue('refresh-1');
    await act(async () => { renderer = TestRenderer.create(<SignInSection config={config} />); });
  }
  afterEach(async () => { await act(async () => { renderer?.unmount(); }); });

  it('shows the Qlik User identity and active Tenant above sign-out', async () => {
    await showProfile();
    expect(text()).toContain('Alex Morgan');
    expect(text()).toContain('alex@example.com');
    expect(text()).toContain(config.tenantHost);
    expect(text()).toContain('Sign out');
  });

  it('shows a loading state while sign-out remains available', async () => {
    mockGetCurrentUser.mockReturnValue(new Promise(() => {}));
    await showProfile();
    expect(text()).toContain('Loading profile');
    expect(text()).toContain('Sign out');
  });

  it('does not require an email address or a picture', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', name: 'Alex Morgan' });
    await showProfile();
    expect(text()).toContain('Alex Morgan');
    expect(text()).not.toContain('alex@example.com');
    expect(text()).not.toContain('Could not load');
  });

  it('loads the picture without credentials or a disk cache and removes it if loading fails', async () => {
    const pictureUrl = 'https://images.example.com/alex.jpg';
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', name: 'Alex Morgan', pictureUrl });
    await showProfile();
    const picture = renderer.root.findAll((node) => node.props.source?.uri === pictureUrl && node.props.onError)[0];
    expect(picture.props.source).toEqual({ uri: pictureUrl });
    expect(picture.props.cachePolicy).toBe('none');
    await act(async () => { picture.props.onError(); });
    expect(text()).not.toContain(pictureUrl);
    expect(text()).toContain('Alex Morgan');
  });

  it('discards the previous identity when the session port changes', async () => {
    let finish!: (user: QlikUser) => void;
    mockGetCurrentUser.mockReturnValue(new Promise<QlikUser>((resolve) => { finish = resolve; }));
    await showProfile();
    mockActivePort = { getCurrentUser: jest.fn().mockResolvedValue({ id: 'user-2', name: 'Next Qlik User' }) };
    await act(async () => { renderer.update(<SignInSection config={config} />); });
    await act(async () => { finish({ id: 'old-user', name: 'Previous Qlik User' }); });
    expect(text()).toContain('Next Qlik User');
    expect(text()).not.toContain('Previous Qlik User');
  });

  it('recovers from a failed profile request without ending the session', async () => {
    mockGetCurrentUser.mockRejectedValueOnce({ kind: 'Offline' });
    await showProfile();
    expect(text()).toContain('Could not load your profile.');
    expect(text()).toContain('Sign out');
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Retry loading profile' }).props.onPress(); });
    expect(text()).toContain('Alex Morgan');
    expect(text()).not.toContain('Could not load');
  });

  it('explains how to restore an expired session', async () => {
    mockGetCurrentUser.mockRejectedValueOnce({ kind: 'SessionExpired' });
    await showProfile();
    expect(text()).toContain('Your session expired. Sign out, then sign in again.');
    expect(text()).toContain('Sign out');
  });

  it('discards a profile request that completes after sign-out', async () => {
    let finish!: (user: QlikUser) => void;
    mockGetCurrentUser.mockReturnValue(new Promise<QlikUser>((resolve) => { finish = resolve; }));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await showProfile();
    await act(async () => { renderer.root.findByProps({ accessibilityLabel: 'Sign out' }).props.onPress(); });
    await act(async () => { alert.mock.calls[0][2]!.find((b) => b.style === 'destructive')!.onPress!(); });
    await act(async () => { finish({ id: 'old-user', name: 'Previous Qlik User' }); });
    expect(text()).toContain('Not signed in');
    expect(text()).not.toContain('Previous Qlik User');
    alert.mockRestore();
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

describe('Tenant Approval request', () => {
  async function failSignIn(error: Error) {
    mockSignIn.mockRejectedValue(error);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SignInSection config={config} />);
    });
    await act(async () => {
      await renderer.root.findByType(PrimaryButton).props.onPress();
    });
    return renderer;
  }

  it('lets the Qlik User share a request to the Tenant admin when the Tenant has not approved the app', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    const error = Object.assign(new Error('Your Tenant admin must approve the app once.'), { name: 'TenantApprovalRequired' });
    const renderer = await failSignIn(error);

    await act(async () => {
      renderer.root.findByProps({ accessibilityLabel: 'Share approval request' }).props.onPress();
    });

    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining(config.tenantHost) });
  });

  it('offers no share action for any other sign-in error', async () => {
    const renderer = await failSignIn(new Error('Something went wrong.'));

    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Share approval request' })).toHaveLength(0);
  });

  it('explains a sign-in that did not finish, and offers the share action: Qlik shows a non-admin an error page, not a redirect', async () => {
    mockSignIn.mockResolvedValue(null);
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(<SignInSection config={config} />);
    });
    await act(async () => {
      await renderer.root.findByType(PrimaryButton).props.onPress();
    });

    expect(JSON.stringify(renderer.toJSON())).toContain('Tenant admin');
    expect(renderer.root.findAllByProps({ accessibilityLabel: 'Share approval request' }).length).toBeGreaterThan(0);
  });
});
