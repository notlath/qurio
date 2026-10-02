import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import {
  IS_INTERNAL_BUILD,
  loadDevConfig,
  resolveCurrentTenantConfig,
  saveDevConfig,
  validateTenantHost,
  type TenantConfig,
} from '@/config';
import { errorMessageFor } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { expireAccessTokenNow } from '@/auth/access-token';
import { useQlikAuth } from '@/auth/session';
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

function SignInSection({ config }: { config: TenantConfig }) {
  const { signIn, signOut, ready } = useQlikAuth(config);
  // A new port discards whatever the previous session's screens were holding in memory.
  const reloadPort = useReloadAnswersPort();
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

function TenantConfigForm() {
  const theme = useTheme();
  const reloadPort = useReloadAnswersPort();
  const [tenantHost, setTenantHost] = useState('');
  const [clientId, setClientId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [agenticAssistantId, setAgenticAssistantId] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [resolved, setResolved] = useState<TenantConfig | null>(null);

  useEffect(() => {
    loadDevConfig().then((dev) => {
      setTenantHost(dev?.tenantHost ?? '');
      setClientId(dev?.clientId ?? '');
      setAssistantId(dev?.assistantId ?? '');
      setAgenticAssistantId(dev?.agenticAssistantId ?? '');
    });
    resolveCurrentTenantConfig().then(setResolved);
  }, []);

  // Editing any field makes the "Saved" line stale.
  const edit = (set: (value: string) => void) => (value: string) => {
    setSaved(null);
    set(value);
  };

  async function handleSave() {
    setFieldError(null);
    setSaved(null);
    if (!tenantHost.trim() || !clientId.trim() || !assistantId.trim()) {
      setFieldError({ field: 'form', message: 'All three fields are required.' });
      return;
    }
    setSaving(true);
    try {
      const preflight = await validateTenantHost(tenantHost.trim());
      if (!preflight.ok) {
        setFieldError({ field: preflight.field, message: preflight.message });
        return;
      }
      await saveDevConfig({
        tenantHost: tenantHost.trim(),
        clientId: clientId.trim(),
        assistantId: assistantId.trim(),
        // Optional: a blank field clears it, since a save replaces the whole dev entry.
        agenticAssistantId: agenticAssistantId.trim() || undefined,
      });
      const active = await resolveCurrentTenantConfig();
      setResolved(active);
      // Says what the Assistant tab will now do, which a bare "Saved" would not.
      setSaved(`Saved. Agentic Assistant: ${active?.agenticAssistantId ? 'on' : 'off'}.`);
      reloadPort(); // the port was built from the old config — without this the save needs an app restart
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={[styles.form, { borderColor: theme.border }]}>
      <ThemedText type="smallBold" themeColor="primary">DEVELOPMENT CONNECTION</ThemedText>
      <ThemedText type="subtitle">Workspace access</ThemedText>

      <ThemedText themeColor="textSecondary">
        {resolved ? `Active: ${resolved.tenantHost}` : errorMessageFor({ kind: 'ConfigMissing' }).message}
      </ThemedText>

      <ThemedView style={styles.field}>
        <ThemedText type="small">Tenant hostname</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
          placeholder="acme.eu.qlikcloud.com"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={tenantHost}
          onChangeText={edit(setTenantHost)}
        />
        {fieldError?.field === 'tenantHost' && (
          <ThemedText type="small" themeColor="text">
            {fieldError.message}
          </ThemedText>
        )}
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="small">OAuth client id</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
          autoCapitalize="none"
          autoCorrect={false}
          value={clientId}
          onChangeText={edit(setClientId)}
        />
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="small">Assistant id</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
          autoCapitalize="none"
          autoCorrect={false}
          value={assistantId}
          onChangeText={edit(setAssistantId)}
        />
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="small">Agentic Assistant id (optional)</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
          autoCapitalize="none"
          autoCorrect={false}
          value={agenticAssistantId}
          onChangeText={edit(setAgenticAssistantId)}
        />
      </ThemedView>

      {fieldError?.field === 'form' && <ThemedText type="small">{fieldError.message}</ThemedText>}

      <PrimaryButton label="Validate & Save" busy={saving} onPress={handleSave} style={styles.saveButton} />
      {saved && (
        <ThemedText type="small" themeColor="primary" accessibilityLiveRegion="polite">
          {saved}
        </ThemedText>
      )}

      {resolved &&
        (Platform.OS === 'web' ? (
          <ThemedText type="small" themeColor="textSecondary">
            Sign-in is native-only (ADR-0005) — not available in the web preview.
          </ThemedText>
        ) : (
          <SignInSection config={resolved} />
        ))}
    </ThemedView>
  );
}

/**
 * Release builds have no development form, but a Qlik User still has to sign in against the
 * Tenant that MDM configured. Without a resolved configuration there is nothing to sign in to.
 */
function ManagedSettings() {
  const [resolved, setResolved] = useState<TenantConfig | null | undefined>(undefined);

  useEffect(() => {
    resolveCurrentTenantConfig().then(setResolved, () => setResolved(null));
  }, []);

  if (resolved === undefined) return null;
  if (!resolved) {
    return <ThemedText themeColor="textSecondary">{errorMessageFor({ kind: 'ConfigMissing' }).message}</ThemedText>;
  }
  if (Platform.OS === 'web') {
    return (
      <ThemedText type="small" themeColor="textSecondary">
        Sign-in is native-only (ADR-0005) — not available in the web preview.
      </ThemedText>
    );
  }
  return <SignInSection config={resolved} />;
}

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.intro}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText themeColor="textSecondary">Connect this build to your Qlik tenant.</ThemedText>
        </ThemedView>
        {IS_INTERNAL_BUILD ? (
          <>
            <TenantConfigForm />
            {Platform.OS !== 'web' && (
              <Link href="/agentic-spike" asChild>
                <AppPressable accessibilityLabel="Open agentic assistant spike">
                  <ThemedText type="link" themeColor="primary">
                    Agentic spike
                  </ThemedText>
                </AppPressable>
              </Link>
            )}
          </>
        ) : (
          <ManagedSettings />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, gap: Spacing.three },
  intro: { gap: Spacing.one, paddingBottom: Spacing.one },
  form: { gap: Spacing.three, padding: Spacing.three, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card },
  signIn: { gap: Spacing.two, paddingTop: Spacing.one },
  field: { gap: Spacing.one },
  input: {
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  saveButton: { marginTop: Spacing.two },
});
