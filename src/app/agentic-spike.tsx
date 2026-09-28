import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { getAccessToken } from '@/auth/access-token';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IS_INTERNAL_BUILD, resolveCurrentTenantConfig } from '@/config';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * THROWAWAY — the Q22 device spike, internal builds only. Proves whether qlik-embed's
 * ai/agentic-assistant accepts our Native OAuth token when the page's origin is set to the
 * tenant via baseUrl. The token is baked into the HTML only because this is a spike; delete
 * this screen once ADR-0002 records the outcome.
 */
function spikeHtml(tenantHost: string, clientId: string, assistantId: string, token: string): string {
  // JSON.stringify quotes and escapes, so the values cannot break out of the script.
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script>window.getAccessToken = async () => ${JSON.stringify(token)};</script>
<script crossorigin="anonymous" type="application/javascript"
  src="https://cdn.jsdelivr.net/npm/@qlik/embed-web-components@1/dist/index.min.js"
  data-host=${JSON.stringify(`https://${tenantHost}`)}
  data-client-id=${JSON.stringify(clientId)}
  data-get-access-token="getAccessToken"></script>
<style>html,body,qlik-embed{margin:0;height:100%;display:block}</style>
</head><body>
<qlik-embed ui="ai/agentic-assistant" assistant-id=${JSON.stringify(assistantId)}></qlik-embed>
</body></html>`;
}

type Loaded = { html: string; baseUrl: string };

export default function AgenticSpikeScreen() {
  const theme = useTheme();
  const [assistantId, setAssistantId] = useState('');
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [status, setStatus] = useState('');

  async function load() {
    try {
      const config = await resolveCurrentTenantConfig();
      if (!config) return setStatus('No tenant configured.');
      const token = await getAccessToken(config);
      if (!token) return setStatus('Not signed in — sign in from Settings first.');
      setStatus('');
      setLoaded({
        html: spikeHtml(config.tenantHost, config.clientId, assistantId.trim(), token),
        baseUrl: `https://${config.tenantHost}`,
      });
    } catch (e) {
      setStatus(`Failed to get a token: ${String(e)}`);
    }
  }

  // A file-based route ships in every build and is deep-linkable, so the gate lives here,
  // not just on the header button.
  if (!IS_INTERNAL_BUILD) return <Redirect href="/" />;

  if (loaded) {
    return (
      <WebView
        incognito
        cacheEnabled={false}
        originWhitelist={['*']}
        source={loaded}
        onError={(e) => console.warn('[agentic-spike] load error', e.nativeEvent)}
        onHttpError={(e) => console.warn('[agentic-spike] http', e.nativeEvent.statusCode, e.nativeEvent.url)}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText>Agentic Assistant ID</ThemedText>
      <TextInput
        value={assistantId}
        onChangeText={setAssistantId}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
      />
      <View>
        <AppPressable accessibilityLabel="Load agentic assistant" onPress={load} disabled={!assistantId.trim()}>
          <ThemedText type="link" themeColor="primary">
            Load
          </ThemedText>
        </AppPressable>
      </View>
      {status ? <ThemedText>{status}</ThemedText> : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.two },
  input: { borderWidth: 1, padding: Spacing.two },
});
