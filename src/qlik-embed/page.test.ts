import { jsLiteral, quotedAttr } from './escape';
import { bottomInsetScript, embedPageHtml, keyboardRevealScript } from './page';

const input = {
  tenantHost: 'acme.sg.qlikcloud.com',
  clientId: 'client-1',
  surface: 'ai/agentic-assistant' as const,
  resourceId: 'assistant-1',
  session: 'session-1',
};

describe('embedPageHtml', () => {
  it('embeds the Agentic Assistant against the tenant origin, asking the app for tokens', () => {
    const html = embedPageHtml(input);

    expect(html).toContain('data-host="https://acme.sg.qlikcloud.com"');
    expect(html).toContain('data-client-id="client-1"');
    expect(html).toContain('data-get-access-token="getAccessToken"');
    expect(html).toContain('<qlik-embed ui="ai/agentic-assistant" assistant-id="assistant-1">');
  });

  it('resizes the page with the keyboard and lets the Qlik User pinch-zoom (#18, #25)', () => {
    const html = embedPageHtml(input);
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';

    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('interactive-widget=resizes-content');
    expect(viewport).not.toContain('maximum-scale');
    expect(viewport).not.toContain('user-scalable=no');
  });

  it('stops the iOS focus zoom with 16px text fields instead of a zoom limit (#25)', () => {
    const style = embedPageHtml(input).match(/<style>([^<]*)<\/style>/)?.[1] ?? '';

    expect(style).toMatch(/input,textarea,select,\[contenteditable\]\{font-size:max\(16px,1em\)!important\}/);
  });

  it("widens Qlik's fixed 384px Agentic Assistant column to the full page", () => {
    const style = embedPageHtml(input).match(/<style>([^<]*)<\/style>/)?.[1] ?? '';

    expect(style).toContain('qlik-embed div[style*="width: 384px"]{width:100%!important}');
  });

  describe('keeping the focused input in view (#18)', () => {
    type Listener = () => void;
    function run() {
      const listeners: Record<string, Listener> = {};
      const form = { scrollIntoView: jest.fn() };
      const input = { tagName: 'TEXTAREA', isContentEditable: false, closest: (sel: string) => (sel === 'form' ? form : null), scrollIntoView: jest.fn() };
      const doc = { activeElement: input as unknown };
      const win = { addEventListener: (type: string, fn: Listener) => (listeners[type] = fn) };
      new Function('window', 'document', keyboardRevealScript)(win, doc);
      return { listeners, form, input, doc };
    }

    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('scrolls the form of the focused field to the end once the keyboard has resized the page', () => {
      const { listeners, form } = run();

      listeners.resize();
      expect(form.scrollIntoView).not.toHaveBeenCalled();
      jest.advanceTimersByTime(200);

      expect(form.scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
    });

    it('also reacts when a field takes focus', () => {
      const { listeners, form } = run();

      listeners.focusin();
      jest.advanceTimersByTime(200);

      expect(form.scrollIntoView).toHaveBeenCalledTimes(1);
    });

    it('falls back to the field itself when it has no form', () => {
      const { listeners, input } = run();
      input.closest = () => null;

      listeners.focusin();
      jest.advanceTimersByTime(200);

      expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'end' });
    });

    it('does nothing when focus is not on something the Qlik User types into', () => {
      const { listeners, form, doc } = run();
      doc.activeElement = { tagName: 'BUTTON', isContentEditable: false, closest: () => form };

      listeners.resize();
      jest.advanceTimersByTime(200);

      expect(form.scrollIntoView).not.toHaveBeenCalled();
    });

    it('is part of the embed page', () => {
      expect(embedPageHtml(input)).toContain(keyboardRevealScript);
    });
  });

  describe('space kept below the embed for the floating tab bar (#13)', () => {
    it('starts with the inset the host gives it and keeps the body clear of it', () => {
      const html = embedPageHtml({ ...input, bottomInset: 83 });

      expect(html).toContain('--bottom-inset:83px');
      expect(html).toMatch(/body\{[^}]*box-sizing:border-box[^}]*padding-bottom:var\(--bottom-inset\)/);
    });

    it('starts with no inset when the host gives none', () => {
      expect(embedPageHtml(input)).toContain('--bottom-inset:0px');
    });

    it('turns anything that is not a plain length into 0 or a whole number', () => {
      expect(embedPageHtml({ ...input, bottomInset: -5 })).toContain('--bottom-inset:0px');
      expect(embedPageHtml({ ...input, bottomInset: Number.NaN })).toContain('--bottom-inset:0px');
      expect(embedPageHtml({ ...input, bottomInset: 82.6 })).toContain('--bottom-inset:83px');
    });

    it('can change the inset in a page that is already running', () => {
      const style = { setProperty: jest.fn() };
      new Function('document', 'window', bottomInsetScript(83))({ documentElement: { style } }, { dispatchEvent: jest.fn() });

      expect(style.setProperty).toHaveBeenCalledWith('--bottom-inset', '83px');
    });

    it('then lets the page re-check what is in view, as it does after the keyboard resizes it', () => {
      const win = { dispatchEvent: jest.fn() };
      new Function('document', 'window', bottomInsetScript(0))({ documentElement: { style: { setProperty: jest.fn() } } }, win);

      expect(win.dispatchEvent).toHaveBeenCalledTimes(1);
      expect(win.dispatchEvent.mock.calls[0][0].type).toBe('resize');
    });

    it('ends the injected script with true, so the WebView does not report a result', () => {
      expect(bottomInsetScript(0).trim().endsWith('true;')).toBe(true);
    });
  });

  it('addresses an Analytics App by app-id, with no sheet-id', () => {
    const html = embedPageHtml({ ...input, surface: 'classic/app', resourceId: 'app-1' });

    expect(html).toContain('<qlik-embed ui="classic/app" app-id="app-1">');
    expect(html).not.toContain('sheet-id');
  });

  it('does not set an auth type — the spike worked with it unset', () => {
    expect(embedPageHtml(input)).not.toContain('data-auth-type');
  });

  it('escapes identifiers for the HTML attribute they land in', () => {
    const html = embedPageHtml({ ...input, resourceId: `x" onload="alert(1)` });

    expect(html).toContain('assistant-id="x&quot; onload=&quot;alert(1)"');
    expect(html).not.toContain('onload="alert(1)"');
  });
});

describe('a Qlik script that cannot download (offline)', () => {
  const decode = (attr: string) =>
    attr.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

  it('tells the app, in this session, instead of failing silently', () => {
    const handler = decode(/onerror="([^"]*)"/.exec(embedPageHtml(input))![1]);
    const posted: string[] = [];

    new Function('window', handler)({ ReactNativeWebView: { postMessage: (m: string) => posted.push(m) } });

    expect(posted.map((m) => JSON.parse(m))).toEqual([{ v: 1, session: 'session-1', type: 'load-failed' }]);
  });

  it('keeps a hostile session id inside the handler', () => {
    const html = embedPageHtml({ ...input, session: `"></script><script>alert(1)</script>` });

    expect(html.match(/<script/g)).toHaveLength(2);
  });
});

describe('escaping', () => {
  it('jsLiteral cannot close a script block or inject a line separator', () => {
    const out = jsLiteral(`</script>${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}`);

    expect(out).not.toMatch(/[<>]/);
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out)).toBe(`</script>${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}`);
  });

  it('quotedAttr escapes quotes, ampersands and angle brackets', () => {
    expect(quotedAttr(`a&b"c'd<e>`)).toBe('"a&amp;b&quot;c&#39;d&lt;e&gt;"');
  });
});
