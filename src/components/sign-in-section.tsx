import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Alert, Platform, Share, StyleSheet, View } from 'react-native';

import { hasSession } from '@/auth/access-token';
import { useQlikAuth } from '@/auth/session';
import { Icon } from '@/components/icon';
import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { type TenantConfig } from '@/config';
import { Radius, Spacing } from '@/constants/theme';
import type { QlikUser } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort, useReloadAnswersPort } from '@/qlik/context';
import type { AnswersPort } from '@/qlik/port';

/** The signed-in Qlik User's Profile, loaded again for each port. Settings and the side panel show it. */
export function useProfile(): { user?: QlikUser; error?: string; retry: () => void } {
  const port = useAnswersPort();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ port: AnswersPort; attempt: number; user?: QlikUser; error?: string } | null>(null);

  useEffect(() => {
    let current = true;
    port.getCurrentUser().then(
      (user) => current && setResult({ port, attempt, user }),
      (error: unknown) => {
        const expired = typeof error === 'object' && error !== null && 'kind' in error && error.kind === 'SessionExpired';
        if (current) setResult({ port, attempt, error: expired
          ? 'Your session expired. Sign out, then sign in again.'
          : 'Could not load your profile.' });
      },
    );
    return () => {
      current = false;
    };
  }, [port, attempt]);

  const profile = result?.port === port && result.attempt === attempt ? result : null;
  return { user: profile?.user, error: profile?.error, retry: () => setAttempt((n) => n + 1) };
}

/** The Profile picture over the person icon. The icon stays when there is no picture or it fails to load. */
export function ProfileAvatar({ user, size }: { user?: QlikUser; size: number }) {
  const theme = useTheme();
  const [failedPicture, setFailedPicture] = useState<string | null>(null);

  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: theme.backgroundSelected }]}>
      <Icon ios="person.fill" android="person" size={size / 2} color="textSecondary" />
      {user?.pictureUrl && failedPicture !== user.pictureUrl && (
        <Image
          source={{ uri: user.pictureUrl }}
          cachePolicy="none"
          contentFit="cover"
          recyclingKey={`${user.id}:${user.pictureUrl}`}
          onError={() => setFailedPicture(user.pictureUrl!)}
          style={StyleSheet.absoluteFill}
          accessible={false}
        />
      )}
    </View>
  );
}

function ProfileDetails() {
  const { user, error, retry } = useProfile();
  return (
    <View style={styles.profile}>
      <ProfileAvatar user={user} size={Spacing.six} />
      <View style={styles.status}>
        {user ? (
          <>
            <ThemedText type="headline" selectable>{user.name || 'Qlik User'}</ThemedText>
            {user.email && <ThemedText type="small" themeColor="textSecondary" selectable>{user.email}</ThemedText>}
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {error ?? 'Loading profile…'}
          </ThemedText>
        )}
        {error && (
          <AppPressable accessibilityLabel="Retry loading profile" onPress={retry}>
            <ThemedText type="linkPrimary">Retry</ThemedText>
          </AppPressable>
        )}
      </View>
    </View>
  );
}

/** One settings row: session state on the left, the one action that changes it on the right. */
export function SignInSection({ config, onSignedIn, onSignedOut }: { config: TenantConfig; onSignedIn?: () => Promise<void>; onSignedOut?: () => Promise<void> }) {
  const { signIn, signOut, ready } = useQlikAuth(config);
  // A new port discards whatever the previous session's screens were holding in memory.
  const reloadPort = useReloadAnswersPort();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

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

  function shareApprovalRequest() {
    void Share.share({
      message: `Please approve the Qurio app for our Qlik Cloud Tenant ${config.tenantHost}. Sign in to Qurio once as a Tenant admin and approve it. This is needed once for the whole Tenant.`,
    });
  }

  async function handlePress() {
    setError(null);
    setNeedsApproval(false);
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
      setNeedsApproval(e instanceof Error && e.name === 'TenantApprovalRequired');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {signedIn && <ProfileDetails />}
      <View style={styles.row}>
        <View style={styles.status}>
          <ThemedText>{signedIn ? 'Signed in' : 'Not signed in'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" selectable>
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
      {needsApproval && (
        <AppPressable accessibilityLabel="Share approval request" onPress={shareApprovalRequest}>
          <ThemedText type="linkPrimary">Share approval request</ThemedText>
        </AppPressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, padding: Spacing.three },
  profile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingBottom: Spacing.two },
  avatar: { borderRadius: Radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  status: { flex: 1, minWidth: 0, gap: Spacing.half },
  signIn: { paddingVertical: Spacing.two },
});
