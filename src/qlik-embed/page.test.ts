import { jsLiteral, quotedAttr } from './escape';
import { embedPageHtml } from './page';

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

  it('does not set an auth type — the spike worked with it unset', () => {
    expect(embedPageHtml(input)).not.toContain('data-auth-type');
  });

  it('escapes identifiers for the HTML attribute they land in', () => {
    const html = embedPageHtml({ ...input, resourceId: `x" onload="alert(1)` });

    expect(html).toContain('assistant-id="x&quot; onload=&quot;alert(1)"');
    expect(html).not.toContain('onload="alert(1)"');
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
