import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import { expireAccessTokenNow, hasSession } from '@/auth/access-token';
import { useQlikAuth } from '@/auth/session';
import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IS_INTERNAL_BUILD, type TenantConfig } from '@/config';
import { Spacing } from '@/constants/theme';
import { useReloadAnswersPort } from '@/qlik/context';

/** Device validation only (ticket 19): rendered in internal builds, never in a release. */
function ExpireTokenButton() {
  const [marked, setMarked] = useState(false);

  return (
    <>
      <AppPressable
        accessibilityLabel="Expire the access token now"
        onPress={async () => {
          await expireAccessTokenNow();
          setMarked(true);
        }}>
        <ThemedText type="link" themeColor="primary">
          Expire token now (test)
        </ThemedText>
      </AppPressable>
      {marked && (
        <ThemedText type="small" themeColor="textSecondary">
          Token marked expired — the next Qlik request refreshes it.
        </ThemedText>
      )}
    </>
  );
}

export function SignInSection({ config }: { config: TenantConfig }) {
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

  async function handlePress() {
    setError(null);
    setBusy(true);
    try {
      if (signedIn) {
        await signOut();
        setSignedIn(false);
        reloadPort();
      } else {
        const tokens = await signIn();
        setSignedIn(!!tokens);
        if (tokens) reloadPort();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="background" style={styles.signIn}>
      <ThemedText type="smallBold">Sign-in</ThemedText>
      <ThemedText themeColor="textSecondary">{signedIn ? 'Signed in' : 'Not signed in'}</ThemedText>
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      <PrimaryButton
        label={signedIn ? 'Sign out' : 'Sign in'}
        busy={busy}
        disabled={!ready}
        onPress={handlePress}
        style={styles.saveButton}
      />
      {IS_INTERNAL_BUILD && <ExpireTokenButton />}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  signIn: { gap: Spacing.two, paddingTop: Spacing.one },
  saveButton: { marginTop: Spacing.two },
});
