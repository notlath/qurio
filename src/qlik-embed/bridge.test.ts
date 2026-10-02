import { answerTokenRequest, guidanceFor, isOwnPage, parseTokenRequest, replyScript } from './bridge';

const ORIGIN = 'https://acme.sg.qlikcloud.com';
const request = (over: object = {}) => JSON.stringify({ v: 1, session: 's1', type: 'token-request', id: 1, ...over });

describe('parseTokenRequest', () => {
  it('accepts a well-formed request for this session', () => {
    expect(parseTokenRequest(request({ id: 7 }), 's1')).toBe(7);
  });

  it.each([
    ['another session', request({ session: 's0' })],
    ['an unknown version', request({ v: 2 })],
    ['another message type', request({ type: 'log' })],
    ['a non-numeric id', request({ id: '1' })],
    ['a zero id', request({ id: 0 })],
    ['a fractional id', request({ id: 1.5 })],
    ['not JSON', 'nope'],
    ['a non-object', '"hi"'],
    ['null', 'null'],
  ])('rejects %s', (_label, raw) => {
    expect(parseTokenRequest(raw, 's1')).toBeNull();
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
