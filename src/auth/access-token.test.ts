import * as AuthSession from 'expo-auth-session';

import { forgetAccessToken, getAccessToken, adoptTokens } from './access-token';
import { loadExpiresAtMs, loadRefreshToken, saveExpiresAtMs, saveRefreshToken } from './tokens';

jest.mock('expo-auth-session', () => ({
  refreshAsync: jest.fn(),
  makeRedirectUri: () => 'qlikanswers://auth',
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
