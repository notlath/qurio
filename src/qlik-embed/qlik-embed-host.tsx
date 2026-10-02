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
  guidanceFor,
  isOwnPage,
  parseTokenRequest,
  replyScript,
  type HostFailure,
} from './bridge';
import { embedPageHtml, tenantOriginOf } from './page';
import type { QlikEmbedHostProps } from './types';

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

  function fail(reason: HostFailure) {
    active.current = false;
    setFailure(reason);
  }

  function allowNavigation(request: ShouldStartLoadRequest): boolean {
    if (!request.isTopFrame || isOwnPage(request.url, page.tenantOrigin)) return true;
    fail('navigation');
    return false;
  }

  async function onMessage(event: WebViewMessageEvent) {
    if (!active.current || !isOwnPage(event.nativeEvent.url, page.tenantOrigin)) return;
    const id = parseTokenRequest(event.nativeEvent.data, session);
    if (id === null) return;

    const reply = await answerTokenRequest(id, session, () => getAccessTokenWithExpiry(config));
    if (!active.current) return;
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
      onError={() => fail('load-error')}
      onHttpError={(e) => {
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
