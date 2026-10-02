import { answerTokenRequest, exchangeForWebSocketToken, guidanceFor, isOwnPage, parseHostMessage, replyScript, safeText, safeUrl } from './bridge';

const ORIGIN = 'https://acme.sg.qlikcloud.com';
const request = (over: object = {}) =>
  JSON.stringify({ v: 1, session: 's1', type: 'token-request', id: 1, purpose: 'api', ...over });

describe('parseHostMessage', () => {
  it('accepts the page reporting that the Qlik script failed to load', () => {
    expect(parseHostMessage(request({ type: 'load-failed', id: undefined, purpose: undefined }), 's1')).toEqual({
      kind: 'load-failed',
    });
  });

  it('ignores a load-failed report from another session', () => {
    expect(parseHostMessage(request({ type: 'load-failed', session: 's0' }), 's1')).toBeNull();
  });

  it('accepts a well-formed request for this session, with what the token is for', () => {
    expect(parseHostMessage(request({ id: 7, purpose: 'exchange' }), 's1')).toEqual({ kind: 'token-request', id: 7, purpose: 'exchange' });
  });

  it.each(['runtime', 'api', 'exchange'])('accepts the %s purpose', (purpose) => {
    expect(parseHostMessage(request({ purpose }), 's1')).toEqual({ kind: 'token-request', id: 1, purpose });
  });

  it.each([
    ['another session', request({ session: 's0' })],
    ['an unknown version', request({ v: 2 })],
    ['another message type', request({ type: 'log' })],
    ['an unknown purpose', request({ purpose: 'login' })],
    ['no purpose', request({ purpose: undefined })],
    ['a non-numeric id', request({ id: '1' })],
    ['a zero id', request({ id: 0 })],
    ['a fractional id', request({ id: 1.5 })],
    ['not JSON', 'nope'],
    ['a non-object', '"hi"'],
    ['null', 'null'],
  ])('rejects %s', (_label, raw) => {
    expect(parseHostMessage(raw, 's1')).toBeNull();
  });
});

describe('answerTokenRequest', () => {
  const now = 1_000_000;

  it('answers with the token and its real remaining lifetime', async () => {
    const reply = await answerTokenRequest(3, 's1', async () => ({ token: 't', expiresAtMs: now + 417_900 }), now);

    expect(reply).toEqual({ session: 's1', id: 3, ok: true, token: 't', expiresIn: 417 });
  });

  it('takes the token fresh from the source on every call', async () => {
    const source = jest
      .fn()
      .mockResolvedValueOnce({ token: 'old', expiresAtMs: now + 100_000 })
      .mockResolvedValueOnce({ token: 'new', expiresAtMs: now + 3_600_000 });

    const first = await answerTokenRequest(1, 's1', source, now);
    const second = await answerTokenRequest(2, 's1', source, now);

    expect([first, second]).toMatchObject([{ token: 'old', expiresIn: 100 }, { token: 'new', expiresIn: 3600 }]);
  });

  it.each([
    ['signed out', async () => null],
    ['already expired', async () => ({ token: 't', expiresAtMs: now - 1 })],
    ['the refresh failing', async () => Promise.reject(new Error('network'))],
  ])('refuses when %s', async (_label, source) => {
    await expect(answerTokenRequest(4, 's1', source, now)).resolves.toEqual({ session: 's1', id: 4, ok: false });
  });
});

describe('replyScript', () => {
  it('delivers the reply to the page host, and cannot be broken out of by its content', () => {
    const script = replyScript({ session: '</script>', id: 1, ok: false });

    expect(script).toContain('window.__qlikHost.reply(');
    expect(script).not.toContain('</script>');
  });
});

describe('isOwnPage', () => {
  it.each(['about:blank', 'data:text/html,x', ORIGIN, `${ORIGIN}/`])('allows %s', (url) => {
    expect(isOwnPage(url, ORIGIN)).toBe(true);
  });

  it.each([`${ORIGIN}/login`, 'https://other.example.com/', `${ORIGIN}.evil.com/`])('does not allow %s', (url) => {
    expect(isOwnPage(url, ORIGIN)).toBe(false);
  });
});

describe('guidanceFor', () => {
  it('gives every failure native guidance', () => {
    for (const failure of ['token-unavailable', 'navigation', 'load-error'] as const) {
      expect(guidanceFor(failure).message.length).toBeGreaterThan(0);
    }
  });
});

describe('safeUrl', () => {
  it('keeps origin and path only — a login URL query string carries OAuth state', () => {
    expect(safeUrl('https://acme.sg.qlikcloud.com/login?state=abc&code=xyz#frag')).toBe(
      'https://acme.sg.qlikcloud.com/login',
    );
  });

  it('leaves a URL with no query or fragment alone', () => {
    expect(safeUrl('https://acme.sg.qlikcloud.com/')).toBe('https://acme.sg.qlikcloud.com/');
  });

  it('cuts a data: document down to its scheme, never echoing the page', () => {
    expect(safeUrl('data:text/html,<html>secret</html>')).toBe('data:');
  });
});

describe('safeText', () => {
  it('scrubs query strings out of any URL inside a platform error message', () => {
    expect(safeText('The URL https://acme.sg.qlikcloud.com/login?state=abc&code=xyz is not supported')).toBe(
      'The URL https://acme.sg.qlikcloud.com/login is not supported',
    );
  });

  it('leaves a message with no URL alone', () => {
    expect(safeText('net::ERR_INTERNET_DISCONNECTED')).toBe('net::ERR_INTERNET_DISCONNECTED');
  });
});

describe('exchangeForWebSocketToken', () => {
  const config = { tenantHost: 'acme.sg.qlikcloud.com', clientId: 'client-1' };
  const respond = (status: number, body: object) =>
    jest.fn(async (..._args: any[]) => ({ ok: status === 200, status, json: async () => body }));

  it('asks the tenant for a token minted for the engine WebSocket, as @qlik/api does in a browser', async () => {
    const fetchImpl = respond(200, { access_token: 'ws-token', expires_in: 300 });

    const result = await exchangeForWebSocketToken(config, 'access-1', fetchImpl as never);

    expect(result).toEqual({ ok: true, token: 'ws-token', expiresIn: 300 });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/oauth/token`);
    expect(init.headers).not.toHaveProperty('Origin');
    expect(JSON.parse(init.body)).toEqual({
      subject_token: 'access-1',
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      purpose: 'websocket',
      redirect_uri: `${ORIGIN}/`,
      client_id: 'client-1',
    });
  });

  it('reports the status and Qlik error code when the tenant refuses, without the token', async () => {
    const fetchImpl = respond(401, { errors: [{ code: 'OAUTH-29' }] });

    expect(await exchangeForWebSocketToken(config, 'access-1', fetchImpl as never)).toEqual({
      ok: false,
      reason: 'http 401 OAUTH-29',
    });
  });
});
