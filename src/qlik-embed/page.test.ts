import { jsLiteral, quotedAttr } from './escape';
import { embedPageHtml, keyboardRevealScript } from './page';

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

  it('resizes the page with the keyboard and stops the focus zoom (#18)', () => {
    const html = embedPageHtml(input);
    const viewport = html.match(/<meta name="viewport" content="([^"]*)"/)?.[1] ?? '';

    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('interactive-widget=resizes-content');
    expect(viewport).toContain('maximum-scale=1');
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
