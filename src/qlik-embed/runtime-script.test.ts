import { runtimeScript } from './runtime-script';

// React Native's URL polyfill lacks `origin`; the page runs in a real browser, so use Node's.
const NodeURL: typeof URL = jest.requireActual('url').URL;

const ORIGIN = 'https://acme.sg.qlikcloud.com';
const SESSION = 'session-1';

class FakeHeaders {
  private map = new Map<string, string>();
  constructor(init: Record<string, string> = {}) {
    Object.entries(init).forEach(([k, v]) => this.set(k, v));
  }
  set(k: string, v: string) {
    this.map.set(k.toLowerCase(), v);
  }
  get(k: string) {
    return this.map.get(k.toLowerCase()) ?? null;
  }
}

class FakeResponse {
  constructor(
    private body: string,
    public init: { status: number },
  ) {}
  get status() {
    return this.init.status;
  }
  json() {
    return JSON.parse(this.body);
  }
}

/** Runs the real page script against a fake window, as a browser would run it. */
function loadPage() {
  const sent: any[] = [];
  const originalFetch = jest.fn(async (..._args: any[]) => ({ status: 200 }));
  const win: any = { fetch: originalFetch, ReactNativeWebView: { postMessage: (m: string) => sent.push(JSON.parse(m)) } };
  new Function('window', 'location', 'URL', 'Headers', 'Response', runtimeScript({ session: SESSION, tenantOrigin: ORIGIN }))(
    win,
    { href: `${ORIGIN}/` },
    NodeURL,
    FakeHeaders,
    FakeResponse,
  );
  const reply = (message: object) => win.__qlikHost.reply({ session: SESSION, ...message });
  const answerNext = (message: object) => {
    const request = sent[sent.length - 1];
    reply({ id: request.id, ...message });
  };
  return { win, sent, originalFetch, reply, answerNext };
}

const granted = { ok: true, token: 'native-token', expiresIn: 1800 };

describe('runtime script', () => {
  it('asks the app for a token every time the runtime wants one', async () => {
    const page = loadPage();

    const first = page.win.getAccessToken();
    page.answerNext({ ...granted, token: 'first' });
    const second = page.win.getAccessToken();
    page.answerNext({ ...granted, token: 'second' });

    await expect(first).resolves.toBe('first');
    await expect(second).resolves.toBe('second');
    expect(page.sent.map((m) => m.type)).toEqual(['token-request', 'token-request']);
    expect(page.sent.every((m) => m.session === SESSION && m.v === 1)).toBe(true);
  });

  it('adds the bearer to same-origin calls', async () => {
    const page = loadPage();

    const call = page.win.fetch(`${ORIGIN}/api/v1/assistants`, { headers: { Accept: 'application/json' } });
    page.answerNext(granted);
    await call;

    const [, init] = page.originalFetch.mock.calls[0];
    expect(init.headers.get('authorization')).toBe('Bearer native-token');
  });

  it('uses the app current token on each call, not the one from page load', async () => {
    const page = loadPage();

    const a = page.win.fetch(`${ORIGIN}/api/v1/a`);
    page.answerNext({ ...granted, token: 'before-refresh' });
    await a;
    const b = page.win.fetch(`${ORIGIN}/api/v1/b`);
    page.answerNext({ ...granted, token: 'after-refresh' });
    await b;

    expect(page.originalFetch.mock.calls.map(([, init]) => init.headers.get('authorization'))).toEqual([
      'Bearer before-refresh',
      'Bearer after-refresh',
    ]);
  });

  it('never adds a bearer under /oauth/ and never asks the app for a token there', async () => {
    const page = loadPage();

    await page.win.fetch(`${ORIGIN}/oauth/revoke`, { method: 'POST' });

    expect(page.sent).toHaveLength(0);
    expect(page.originalFetch).toHaveBeenCalledWith(`${ORIGIN}/oauth/revoke`, { method: 'POST' });
  });

  it('leaves other origins and existing Authorization headers alone', async () => {
    const page = loadPage();

    await page.win.fetch('https://cdn.example.com/lib.js');
    await page.win.fetch(`${ORIGIN}/api/v1/x`, { headers: { Authorization: 'Basic abc' } });

    expect(page.sent).toHaveLength(0);
    expect(page.originalFetch).toHaveBeenCalledTimes(2);
  });

  it('answers the token exchange locally with a fresh token and its real remaining lifetime', async () => {
    const page = loadPage();

    const exchange = page.win.fetch(`${ORIGIN}/oauth/token`, { method: 'POST', body: '{}' });
    page.answerNext({ ok: true, token: 'fresh', expiresIn: 417 });
    const response = await exchange;

    expect(page.originalFetch).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.json()).toEqual({
      access_token: 'fresh',
      issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      token_type: 'Bearer',
      expires_in: 417,
    });
  });

  it('fails the exchange, rather than inventing a token, when the app cannot supply one', async () => {
    const page = loadPage();

    const exchange = page.win.fetch(`${ORIGIN}/oauth/token`, { method: 'POST' });
    page.answerNext({ ok: false });

    expect((await exchange).status).toBe(503);
  });

  it('ignores replies for another session or for a request it never made', async () => {
    const page = loadPage();

    const token = page.win.getAccessToken();
    const { id } = page.sent[0];
    page.win.__qlikHost.reply({ session: 'other-session', id, ...granted, token: 'forged' });
    page.reply({ id: id + 99, ...granted, token: 'unrequested' });
    page.reply({ id, ...granted, token: 'real' });

    await expect(token).resolves.toBe('real');
  });

  it('rejects a token request the app refuses', async () => {
    const page = loadPage();

    const token = page.win.getAccessToken();
    page.answerNext({ ok: false });

    await expect(token).rejects.toThrow('token-unavailable');
  });

  it('cannot have its reply handler replaced by page content', () => {
    const page = loadPage();

    expect(() => {
      'use strict';
      page.win.__qlikHost.reply = () => {};
    }).toThrow();
  });

  it('keeps configuration from breaking out of the script', () => {
    const hostile = `</script><script>alert(1)</script>${String.fromCharCode(0x2028)}`;
    const script = runtimeScript({ session: hostile, tenantOrigin: ORIGIN });

    expect(script).not.toContain('</script>');
    expect(script).not.toContain(String.fromCharCode(0x2028));
  });
});
