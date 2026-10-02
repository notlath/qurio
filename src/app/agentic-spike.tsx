import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { getAccessToken } from '@/auth/access-token';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IS_INTERNAL_BUILD, resolveCurrentTenantConfig } from '@/config';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * THROWAWAY — the device spike for embedding qlik-embed with our Native OAuth token, internal
 * builds only. Round 1 redirected to the Qlik login page; this version instruments why. It
 * records whether the tenant's runtime ever calls our token function, every failed HTTP
 * response, page errors, and every top-level navigation away from our page — which it blocks,
 * so the URL Qlik tried to send us to is the diagnosis. Delete once ADR-0002 records the outcome.
 */

type Ui = 'ai/agentic-assistant' | 'classic/app';
type Inputs = { ui: Ui; id: string; authTypeOauth2: boolean; tenantOrigin: boolean; stubCsrf: boolean; injectBearer: boolean; answerExchange: boolean };

// Module scope so the inputs survive Back — this screen unmounts on every pop.
let saved: Inputs = { ui: 'ai/agentic-assistant', id: '', authTypeOauth2: false, tenantOrigin: true, stubCsrf: false, injectBearer: false, answerExchange: false };

// The first script on the page: forwards everything worth knowing to native before qlik-embed loads.
const loggerScript = (
  stubCsrf: boolean,
  bearer: { token: string; origin: string } | null,
  answerExchange: boolean,
) => `<script>
(function () {
  var t0 = Date.now();
  function post(kind, msg) {
    var at = '+' + Math.round((Date.now() - t0) / 1000) + 's ';
    window.ReactNativeWebView.postMessage(JSON.stringify({ kind: kind, msg: at + String(msg).slice(0, 400) }));
  }
  window.__spikeLog = post;
  ['error', 'warn'].forEach(function (level) {
    var original = console[level];
    console[level] = function () {
      post(level, Array.prototype.map.call(arguments, String).join(' '));
      original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function (e) { post('page-error', e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    post('rejection', e.reason && (e.reason.message || e.reason));
  });
  post('origin', 'location.origin=' + location.origin);
  var originalFetch = window.fetch;
  var stubCsrf = ${stubCsrf};
  var bearer = ${JSON.stringify(bearer)};
  window.fetch = function (input, init) {
    // EXPERIMENT: the runtime's own same-origin calls carry no bearer token (round 3 log:
    // bearer=no on /api/v1/accesscontrol/evaluation), so add ours. Never ship this.
    try {
      var target = new URL(String(input && input.url ? input.url : input), location.href);
      var existing = (init && init.headers) || (input && input.headers);
      var present = existing && (existing.get ? existing.get('authorization') : existing.Authorization || existing.authorization);
      // Never the token endpoint: it wants Basic credentials and answers a Bearer with OAUTH-16.
      if (bearer && target.origin === bearer.origin && !present && target.pathname.indexOf('/oauth/') !== 0) {
        var withAuth = new Headers(existing || {});
        withAuth.set('Authorization', 'Bearer ' + bearer.token);
        init = Object.assign({}, init, { headers: withAuth });
      }
    } catch (e) {}
    // EXPERIMENT: answer the CSRF call ourselves (204 + header, as the API documents) to see
    // whether its 401 is what sends the runtime to the login page. Never ship this.
    if (stubCsrf && String(input && input.url ? input.url : input).indexOf('/api/v1/csrf-token') !== -1) {
      post('stub', 'served /api/v1/csrf-token locally');
      return Promise.resolve(new Response(null, { status: 204, headers: { 'qlik-csrf-token': 'spike-stub' } }));
    }
    // EXPERIMENT: the runtime exchanges our token at /oauth/token (RFC 8693 field names) about
    // 12-15 minutes in, and the tenant rejects the browser Origin (OAUTH-29). Answer that call
    // with our own token instead. Never ship this.
    try {
      var exchangeUrl = new URL(String(input && input.url ? input.url : input), location.href);
      if (${answerExchange} && bearer && exchangeUrl.pathname === '/oauth/token' && init && init.method === 'POST') {
        post('stub', 'answered /oauth/token locally');
        return Promise.resolve(new Response(JSON.stringify({
          access_token: bearer.token,
          issued_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          token_type: 'Bearer',
          expires_in: 3600,
        }), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
    } catch (e) {}
    // Only grant_type is read from a token request body — never the token itself.
    var sent = '';
    try {
      var body = init && init.body;
      if (body && String(input && input.url ? input.url : input).indexOf('/oauth/token') !== -1) {
        // Shape only — field names and content type, never values.
        var ctype = (init.headers && (init.headers.get ? init.headers.get('content-type') : init.headers['Content-Type'] || init.headers['content-type'])) || '?';
        var fields;
        try { fields = Object.keys(JSON.parse(String(body))).join(','); }
        catch (e) { fields = Array.from(new URLSearchParams(String(body)).keys()).join(','); }
        // Enumerations and public identifiers only — never subject_token.
        var shown = '';
        try {
          var parsed = JSON.parse(String(body));
          ['grant_type', 'subject_token_type', 'purpose', 'redirect_uri'].forEach(function (k) { shown += ' ' + k + '=' + parsed[k]; });
        } catch (e) {}
        sent = ' content-type=' + ctype + ' fields=[' + fields + ']' + shown;
      }
    } catch (e) {}
    // Whether the call carries a bearer token and cookies — presence only, never the values.
    try {
      var headers = (init && init.headers) || (input && input.headers);
      var hasAuth = headers && (headers.get ? headers.get('authorization') : headers.Authorization || headers.authorization);
      sent += ' bearer=' + (hasAuth ? 'yes' : 'no') + ' credentials=' + ((init && init.credentials) || (input && input.credentials) || 'default');
    } catch (e) {}
    return originalFetch(input, init).then(function (r) {
      if (!r.ok) {
        var where = r.status + ' ' + (init && init.method ? init.method + ' ' : '') + (input && input.url ? input.url : input) + sent;
        r.clone().text().then(function (t) { post('http', where + ' body=' + t.slice(0, 200)); },
          function () { post('http', where); });
      } else {
        // Successes too, path only (no query string), so we can see what a working session does.
        try { post('ok', r.status + ' ' + new URL(String(input && input.url ? input.url : input), location.href).pathname); } catch (e) {}
      }
      return r;
    });
  };
})();
</script>`;

function spikeHtml(tenantHost: string, clientId: string, token: string, inputs: Inputs): string {
  // JSON.stringify quotes and escapes, so the values cannot break out of the script or attributes.
  const idAttr = inputs.ui === 'classic/app' ? 'app-id' : 'assistant-id';
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
${loggerScript(inputs.stubCsrf, inputs.injectBearer ? { token, origin: `https://${tenantHost}` } : null, inputs.answerExchange)}
<script>
window.getAccessToken = async function () {
  window.__spikeLog('auth', 'getAccessToken called by the runtime');
  return ${JSON.stringify(token)};
};
</script>
<script crossorigin="anonymous" type="application/javascript"
  src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js"
  data-host=${JSON.stringify(`https://${tenantHost}`)}
  data-client-id=${JSON.stringify(clientId)}
  ${inputs.authTypeOauth2 ? 'data-auth-type="Oauth2"' : ''}
  data-get-access-token="getAccessToken"></script>
<style>html,body,qlik-embed{margin:0;height:100%;display:block}</style>
</head><body>
<qlik-embed ui=${JSON.stringify(inputs.ui)} ${idAttr}=${JSON.stringify(inputs.id.replace(/[\p{C}\s]/gu, ''))}></qlik-embed>
</body></html>`;
}

type Loaded = { html: string; baseUrl?: string; tenantOrigin: string };

export default function AgenticSpikeScreen() {
  const theme = useTheme();
  const [inputs, setInputsState] = useState<Inputs>(saved);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState('');
  const [log, setLog] = useState<string[]>([]);

  const setInputs = (patch: Partial<Inputs>) =>
    setInputsState((current) => (saved = { ...current, ...patch }));

  function record(line: string) {
    console.warn(`[agentic-spike] ${line}`);
    setLog((lines) => [...lines, line]);
  }

  async function load() {
    try {
      const config = await resolveCurrentTenantConfig();
      if (!config) return setStatus('No tenant configured.');
      const token = await getAccessToken(config);
      if (!token) return setStatus('Not signed in — sign in from Settings first.');
      setStatus('');
      setLog([
        `ui=${inputs.ui} auth-type=${inputs.authTypeOauth2 ? 'Oauth2' : '(unset)'} origin=${
          inputs.tenantOrigin ? 'tenant' : 'none'
        } stub-csrf=${inputs.stubCsrf ? 'on' : 'off'} inject-bearer=${inputs.injectBearer ? 'on' : 'off'} answer-exchange=${inputs.answerExchange ? 'on' : 'off'}`,
      ]);
      const tenantOrigin = `https://${config.tenantHost}`;
      setLoaded({
        html: spikeHtml(config.tenantHost, config.clientId, token, inputs),
        baseUrl: inputs.tenantOrigin ? tenantOrigin : undefined,
        tenantOrigin,
      });
    } catch (e) {
      setStatus(`Failed to get a token: ${String(e)}`);
    }
  }

  // Our own document loads at about:blank, data:, or the tenant origin root (when baseUrl is set).
  // Anything else at the top frame is Qlik trying to navigate us away — block it and keep the URL.
  function allowNavigation(request: ShouldStartLoadRequest, tenantOrigin: string): boolean {
    const { url } = request;
    if (!request.isTopFrame) return true;
    if (url.startsWith('about:') || url.startsWith('data:')) return true;
    if (url === tenantOrigin || url === `${tenantOrigin}/`) return true;
    record(`BLOCKED navigation → ${url}`);
    return false;
  }

  function onMessage(event: WebViewMessageEvent) {
    try {
      const { kind, msg } = JSON.parse(event.nativeEvent.data) as { kind: string; msg: string };
      record(`${kind}: ${msg}`);
    } catch {
      record(`message: ${event.nativeEvent.data}`);
    }
  }

  // A file-based route ships in every build and is deep-linkable, so the gate lives here,
  // not just on the header button.
  if (!IS_INTERNAL_BUILD) return <Redirect href="/" />;

  if (loaded) {
    return (
      <View style={styles.flex}>
        <WebView
          style={styles.flex}
          incognito
          cacheEnabled={false}
          webviewDebuggingEnabled
          originWhitelist={['*']}
          source={{ html: loaded.html, baseUrl: loaded.baseUrl }}
          onShouldStartLoadWithRequest={(request) => allowNavigation(request, loaded.tenantOrigin)}
          onMessage={onMessage}
          onNavigationStateChange={(state) => {
            // Origin + path only: a login URL's query string carries OAuth state we do not need.
            const { origin, pathname } = new URL(state.url);
            record(`nav: ${origin === 'null' ? state.url.slice(0, 20) : origin + pathname}`);
          }}
          onError={(e) => record(`load error: ${e.nativeEvent.description}`)}
          onHttpError={(e) => record(`http error: ${e.nativeEvent.statusCode} ${e.nativeEvent.url}`)}
        />
        <ThemedView style={[styles.logPanel, { borderColor: theme.border }]}>
          <AppPressable accessibilityLabel="Back to spike settings" onPress={() => setLoaded(null)}>
            <ThemedText type="link" themeColor="primary">
              ← Settings
            </ThemedText>
          </AppPressable>
          <ScrollView>
            {log.map((line, i) => (
              <ThemedText key={i} type="small" selectable>
                {line}
              </ThemedText>
            ))}
          </ScrollView>
        </ThemedView>
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText>UI</ThemedText>
      <View style={styles.row}>
        {(['ai/agentic-assistant', 'classic/app'] as const).map((ui) => (
          <AppPressable key={ui} accessibilityLabel={`Use ${ui}`} onPress={() => setInputs({ ui })}>
            <ThemedText type="link" themeColor={inputs.ui === ui ? 'primary' : undefined}>
              {inputs.ui === ui ? `● ${ui}` : `○ ${ui}`}
            </ThemedText>
          </AppPressable>
        ))}
      </View>

      <ThemedText>{inputs.ui === 'classic/app' ? 'Analytics App ID' : 'Agentic Assistant ID'}</ThemedText>
      <TextInput
        value={inputs.id}
        onChangeText={(id) => setInputs({ id })}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />

      <View style={styles.row}>
        <Switch value={inputs.authTypeOauth2} onValueChange={(authTypeOauth2) => setInputs({ authTypeOauth2 })} />
        <ThemedText>data-auth-type=&quot;Oauth2&quot;</ThemedText>
      </View>
      <View style={styles.row}>
        <Switch value={inputs.tenantOrigin} onValueChange={(tenantOrigin) => setInputs({ tenantOrigin })} />
        <ThemedText>Page origin = tenant (baseUrl)</ThemedText>
      </View>

      <View style={styles.row}>
        <Switch value={inputs.stubCsrf} onValueChange={(stubCsrf) => setInputs({ stubCsrf })} />
        <ThemedText>Stub /api/v1/csrf-token (experiment)</ThemedText>
      </View>

      <View style={styles.row}>
        <Switch value={inputs.injectBearer} onValueChange={(injectBearer) => setInputs({ injectBearer })} />
        <ThemedText>Inject bearer into tenant fetches (experiment)</ThemedText>
      </View>

      <View style={styles.row}>
        <Switch value={inputs.answerExchange} onValueChange={(answerExchange) => setInputs({ answerExchange })} />
        <ThemedText>Answer /oauth/token exchange locally (experiment, needs inject)</ThemedText>
      </View>

      <AppPressable accessibilityLabel="Load embed" onPress={load} disabled={!inputs.id.trim()}>
        <ThemedText type="link" themeColor="primary">
          Load
        </ThemedText>
      </AppPressable>
      {status ? <ThemedText>{status}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  input: { borderWidth: 1, padding: Spacing.two },
  logPanel: { maxHeight: '35%', borderTopWidth: 1, padding: Spacing.two, gap: Spacing.one },
});
