import * as AuthSession from 'expo-auth-session';

import {
  adoptTokens,
  expireAccessTokenNow,
  forgetAccessToken,
  getAccessToken,
  getAccessTokenWithExpiry,
} from './access-token';
import { loadExpiresAtMs, loadRefreshToken, saveExpiresAtMs, saveRefreshToken } from './tokens';

jest.mock('expo-auth-session', () => ({
  refreshAsync: jest.fn(),
}));
jest.mock('./tokens', () => ({
  loadExpiresAtMs: jest.fn(),
  loadRefreshToken: jest.fn(),
  saveExpiresAtMs: jest.fn(),
  saveRefreshToken: jest.fn(),
}));

const refreshAsync = AuthSession.refreshAsync as jest.Mock;
const config = { tenantHost: 'acme.eu.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };

function tokenResponse(accessToken: string, expiresAt: string, refreshToken?: string) {
  return { accessToken, refreshToken, rawResponse: { expires_at: expiresAt } } as unknown as AuthSession.TokenResponse;
}

const farFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  forgetAccessToken();
  (loadExpiresAtMs as jest.Mock).mockResolvedValue(null);
  (loadRefreshToken as jest.Mock).mockResolvedValue(null);
});

describe('getAccessToken', () => {
  it('reuses the in-memory token while it is still fresh, without a network round-trip', async () => {
    await adoptTokens(tokenResponse('access-1', farFuture));
    (loadExpiresAtMs as jest.Mock).mockResolvedValue(Date.parse(farFuture));

    await expect(getAccessToken(config)).resolves.toBe('access-1');
    expect(refreshAsync).not.toHaveBeenCalled();
  });

  it('refreshes when the stored expiry says the token is about to lapse', async () => {
    await adoptTokens(tokenResponse('access-1', farFuture));
    (loadExpiresAtMs as jest.Mock).mockResolvedValue(Date.now() + 1_000); // inside the refresh margin
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue(tokenResponse('access-2', farFuture, 'refresh-2'));

    await expect(getAccessToken(config)).resolves.toBe('access-2');
    expect(refreshAsync).toHaveBeenCalledWith(
      { clientId: 'client-1', refreshToken: 'refresh-1' },
      expect.objectContaining({ tokenEndpoint: 'https://acme.eu.qlikcloud.com/oauth/token' }),
    );
    expect(saveRefreshToken).toHaveBeenCalledWith('refresh-2');
    expect(saveExpiresAtMs).toHaveBeenCalledWith(Date.parse(farFuture));
  });

  it('refreshes on a cold start, when nothing is in memory yet', async () => {
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue(tokenResponse('access-2', farFuture));

    await expect(getAccessToken(config)).resolves.toBe('access-2');
  });

  it('spends one refresh token for concurrent callers — Qlik rotates them, so racing would sign the user out', async () => {
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue(tokenResponse('access-2', farFuture, 'refresh-2'));

    const [first, second] = await Promise.all([getAccessToken(config), getAccessToken(config)]);

    expect([first, second]).toEqual(['access-2', 'access-2']);
    expect(refreshAsync).toHaveBeenCalledTimes(1);
  });

  it('lets a later attempt retry after a failed refresh, rather than caching the failure', async () => {
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockRejectedValueOnce(new Error('network')).mockResolvedValue(tokenResponse('access-2', farFuture));

    await expect(getAccessToken(config)).rejects.toThrow('network');
    await expect(getAccessToken(config)).resolves.toBe('access-2');
  });

  it('returns null — not a stale token — when there is no refresh token to fall back on', async () => {
    await expect(getAccessToken(config)).resolves.toBeNull();
    expect(refreshAsync).not.toHaveBeenCalled();
  });
});

describe('getAccessTokenWithExpiry', () => {
  it('returns the token with the expiry the token authority recorded for it', async () => {
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue(tokenResponse('access-2', farFuture));
    (loadExpiresAtMs as jest.Mock).mockResolvedValue(Date.parse(farFuture));

    await expect(getAccessTokenWithExpiry(config)).resolves.toEqual({
      token: 'access-2',
      expiresAtMs: Date.parse(farFuture),
    });
  });

  it('is null when there is no way back to a valid token', async () => {
    await expect(getAccessTokenWithExpiry(config)).resolves.toBeNull();
  });

  it('is null rather than a guess when the expiry is unknown', async () => {
    await adoptTokens(tokenResponse('access-1', farFuture));
    (loadExpiresAtMs as jest.Mock).mockResolvedValue(null);
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue({ accessToken: 'access-2', rawResponse: {} } as unknown as AuthSession.TokenResponse);

    await expect(getAccessTokenWithExpiry(config)).resolves.toBeNull();
  });
});

describe('expireAccessTokenNow', () => {
  it('makes the next call refresh with the refresh token, as a real expiry would', async () => {
    await adoptTokens(tokenResponse('access-1', farFuture));
    (loadRefreshToken as jest.Mock).mockResolvedValue('refresh-1');
    refreshAsync.mockResolvedValue(tokenResponse('access-2', farFuture));

    await expireAccessTokenNow();
    const [stored] = (saveExpiresAtMs as jest.Mock).mock.calls.at(-1)!;
    (loadExpiresAtMs as jest.Mock).mockResolvedValue(stored);

    await expect(getAccessToken(config)).resolves.toBe('access-2');
    expect(refreshAsync).toHaveBeenCalledTimes(1);
  });
});
