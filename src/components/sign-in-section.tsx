import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { hasSession } from '@/auth/access-token';
import { useQlikAuth } from '@/auth/session';
import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { type TenantConfig } from '@/config';
import { Spacing } from '@/constants/theme';
import { useReloadAnswersPort } from '@/qlik/context';

/** One settings row: session state on the left, the one action that changes it on the right. */
export function SignInSection({ config, onSignedIn, onSignedOut }: { config: TenantConfig; onSignedIn?: () => Promise<void>; onSignedOut?: () => Promise<void> }) {
  const { signIn, signOut, ready } = useQlikAuth(config);
  // A new port discards whatever the previous session's screens were holding in memory.
  const reloadPort = useReloadAnswersPort();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // This screen mounts long after sign-in (a later visit, or a restarted app), so what it shows
  // comes from the token authority, not from whether this instance's button was ever pressed.
  useEffect(() => {
    let current = true;
    hasSession().then((signed) => current && setSignedIn(signed));
    return () => {
      current = false;
    };
  }, []);

  // A stray tap on "Sign out" used to end the session outright. Alert.alert is a no-op on web.
  function confirmSignOut() {
    const title = 'Sign out?';
    const message = 'You will need to sign in again to use your Assistants.';
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}
${message}`)) void handlePress();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void handlePress() },
    ]);
  }

  async function handlePress() {
    setError(null);
    setBusy(true);
    try {
      if (signedIn) {
        await signOut();
        setSignedIn(false);
        reloadPort();
        await onSignedOut?.();
      } else {
        const tokens = await signIn();
        setSignedIn(!!tokens);
        if (tokens) {
          await onSignedIn?.();
          reloadPort();
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.status}>
          <ThemedText>{signedIn ? 'Signed in' : 'Not signed in'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {config.tenantHost}
          </ThemedText>
        </View>
        {signedIn ? (
          // Signing out is the secondary path once signed in, so it is a text action, not the filled button.
          <AppPressable accessibilityLabel="Sign out" disabled={!ready || busy} onPress={confirmSignOut}>
            <ThemedText type="linkPrimary" themeColor="danger">
              Sign out
            </ThemedText>
          </AppPressable>
        ) : (
          <PrimaryButton label="Sign in" busy={busy} disabled={!ready} onPress={handlePress} style={styles.signIn} />
        )}
      </View>
      {error && (
        <ThemedText type="small" themeColor="danger" selectable>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, padding: Spacing.three },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  status: { flex: 1, gap: Spacing.half },
  signIn: { paddingVertical: Spacing.two },
});
