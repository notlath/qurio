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
type Inputs = { ui: Ui; id: string; authTypeOauth2: boolean; tenantOrigin: boolean };

// Module scope so the inputs survive Back — this screen unmounts on every pop.
let saved: Inputs = { ui: 'ai/agentic-assistant', id: '', authTypeOauth2: false, tenantOrigin: true };

// The first script on the page: forwards everything worth knowing to native before qlik-embed loads.
const LOGGER = `<script>
(function () {
  function post(kind, msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ kind: kind, msg: String(msg).slice(0, 400) }));
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
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    return originalFetch(input, init).then(function (r) {
      if (!r.ok) post('http', r.status + ' ' + (input && input.url ? input.url : input));
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
${LOGGER}
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
<qlik-embed ui=${JSON.stringify(inputs.ui)} ${idAttr}=${JSON.stringify(inputs.id.trim())}></qlik-embed>
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
        }`,
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
