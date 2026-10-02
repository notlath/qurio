import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';

import { getAccessTokenWithExpiry } from '@/auth/access-token';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  answerTokenRequest,
  exchangeForWebSocketToken,
  guidanceFor,
  isOwnPage,
  parseHostMessage,
  replyScript,
  safeText,
  safeUrl,
  type HostFailure,
} from './bridge';
import { embedPageHtml, tenantOriginOf } from './page';
import { hostTrace } from './trace';
import type { QlikEmbedHostProps } from './types';

/** A healthy embed asks for its first token within seconds; silence this long means it never started. */
const STARTUP_TIMEOUT_MS = 20_000;

/**
 * Hosts a Qlik-owned embed in a WebView, signed in with the app's own token (ADR-0009). Any
 * surprise — a navigation away, a token we cannot supply, a failed load — ends the session with
 * native guidance. Retrying is the user's own tap, never automatic, and each attempt is a new
 * session so a reply to an earlier one can never be accepted.
 */
export function QlikEmbedHost(props: QlikEmbedHostProps) {
  const [attempt, setAttempt] = useState(0);
  // A new session whenever the Tenant, client or target changes, so nothing carries across.
  const key = [props.config.tenantHost, props.config.clientId, props.surface, props.resourceId, attempt].join('|');
  return <HostSession key={key} {...props} onRetry={() => setAttempt((n) => n + 1)} />;
}

function HostSession({ config, surface, resourceId, onRetry }: QlikEmbedHostProps & { onRetry: () => void }) {
  const router = useRouter();
  const webView = useRef<WebView>(null);
  const [session] = useState(() => randomUUID());
  const [failure, setFailure] = useState<HostFailure | null>(null);
  const [page] = useState(() => ({
    html: embedPageHtml({
      tenantHost: config.tenantHost,
      clientId: config.clientId,
      surface,
      resourceId,
      session,
    }),
    tenantOrigin: tenantOriginOf(config.tenantHost),
  }));

  // Replies that resolve after this session ended (unmount, failure) are dropped, not delivered.
  const active = useRef(true);
  useEffect(
    () => () => {
      active.current = false;
    },
    [],
  );

  // The inline page loads even with no internet, but Qlik's script then cannot download — which
  // no WebView error reports. So an embed that never asks for a token is a failed load.
  const started = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (started.current || !active.current) return;
      hostTrace('no token request within the startup window');
      active.current = false;
      setFailure('load-error');
    }, STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  function fail(reason: HostFailure) {
    hostTrace(`session failure: ${reason}`);
    active.current = false;
    setFailure(reason);
  }

  function allowNavigation(request: ShouldStartLoadRequest): boolean {
    if (!request.isTopFrame || isOwnPage(request.url, page.tenantOrigin)) return true;
    hostTrace(`blocked navigation → ${safeUrl(request.url)}`);
    fail('navigation');
    return false;
  }

  async function onMessage(event: WebViewMessageEvent) {
    if (!active.current) return;
    // Dropped messages are traced too: if a platform reports a different page URL, every token
    // request would otherwise vanish without a trace.
    if (!isOwnPage(event.nativeEvent.url, page.tenantOrigin)) {
      hostTrace(`ignored message from ${safeUrl(event.nativeEvent.url)}`);
      return;
    }
    const message = parseHostMessage(event.nativeEvent.data, session);
    if (message === null) {
      hostTrace('ignored malformed or foreign-session message');
      return;
    }
    if (message.kind === 'load-failed') {
      hostTrace('the page reports the Qlik script failed to load');
      fail('load-error');
      return;
    }
    started.current = true;
    const { id, purpose } = message;

    let reply = await answerTokenRequest(id, session, () => getAccessTokenWithExpiry(config));
    if (reply.ok && purpose === 'websocket') {
      // Falls back to the plain token on refusal (the behaviour before), so the trace shows why.
      const minted = await exchangeForWebSocketToken(config, reply.token);
      hostTrace(`websocket token exchange → ${minted.ok ? `minted, expires in ${minted.expiresIn}s` : minted.reason}`);
      if (minted.ok) reply = { ...reply, token: minted.token, expiresIn: minted.expiresIn };
    }
    if (!active.current) return;
    hostTrace(`token request ${id} (${purpose}) → ${reply.ok ? `granted, expires in ${reply.expiresIn}s` : 'refused'}`);
    webView.current?.injectJavaScript(replyScript(reply));
    if (!reply.ok) fail('token-unavailable');
  }

  if (failure) {
    const { title, message } = guidanceFor(failure);
    return (
      <ThemedView style={styles.guidance}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small">{message}</ThemedText>
        <ThemedView style={styles.actions}>
          <AppPressable accessibilityLabel="Open Settings" onPress={() => router.navigate('/settings')}>
            <ThemedText type="linkPrimary">Open Settings</ThemedText>
          </AppPressable>
          <AppPressable accessibilityLabel="Try again" onPress={onRetry}>
            <ThemedText type="linkPrimary">Try again</ThemedText>
          </AppPressable>
        </ThemedView>
      </ThemedView>
    );
  }

  return (
    <WebView
      ref={webView}
      style={styles.flex}
      // Nothing from a Qlik session is kept on the device (ADR-0007).
      incognito
      cacheEnabled={false}
      webviewDebuggingEnabled={__DEV__}
      originWhitelist={['*']}
      source={{ html: page.html, baseUrl: page.tenantOrigin }}
      onShouldStartLoadWithRequest={allowNavigation}
      onMessage={onMessage}
      onNavigationStateChange={(state) => hostTrace(`nav ${safeUrl(state.url)}`)}
      onError={(e) => {
        hostTrace(`load error: ${safeText(e.nativeEvent.description)}`);
        fail('load-error');
      }}
      onHttpError={(e) => {
        hostTrace(`http ${e.nativeEvent.statusCode} ${safeUrl(e.nativeEvent.url)}`);
        // Only the page itself: the runtime's own calls may 4xx without ending the session.
        if (isOwnPage(e.nativeEvent.url, page.tenantOrigin)) fail('load-error');
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  guidance: { flex: 1, gap: Spacing.two, padding: Spacing.three },
  actions: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
});
