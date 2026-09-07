import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/pressable';
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
import { useQlikAuth } from '@/auth/session';
import { useReloadAnswersPort } from '@/qlik/context';

function SignInSection({ config }: { config: TenantConfig }) {
  const { signIn, signOut, ready } = useQlikAuth(config);
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
      } else {
        const tokens = await signIn();
        setSignedIn(!!tokens);
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
    </ThemedView>
  );
}

function TenantConfigForm() {
  const theme = useTheme();
  const reloadPort = useReloadAnswersPort();
  const [tenantHost, setTenantHost] = useState('');
  const [clientId, setClientId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [resolved, setResolved] = useState<TenantConfig | null>(null);

  useEffect(() => {
    loadDevConfig().then((dev) => {
      setTenantHost(dev?.tenantHost ?? '');
      setClientId(dev?.clientId ?? '');
      setAssistantId(dev?.assistantId ?? '');
    });
    resolveCurrentTenantConfig().then(setResolved);
  }, []);

  async function handleSave() {
    setFieldError(null);
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
      await saveDevConfig({ tenantHost: tenantHost.trim(), clientId: clientId.trim(), assistantId: assistantId.trim() });
      setResolved(await resolveCurrentTenantConfig());
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
          onChangeText={setTenantHost}
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
          onChangeText={setClientId}
        />
      </ThemedView>

      <ThemedView style={styles.field}>
        <ThemedText type="small">Assistant id</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
          autoCapitalize="none"
          autoCorrect={false}
          value={assistantId}
          onChangeText={setAssistantId}
        />
      </ThemedView>

      {fieldError?.field === 'form' && <ThemedText type="small">{fieldError.message}</ThemedText>}

      <PrimaryButton label="Validate & Save" busy={saving} onPress={handleSave} style={styles.saveButton} />

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

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={styles.intro}>
          <ThemedText type="title">Settings</ThemedText>
          <ThemedText themeColor="textSecondary">Connect this build to your Qlik tenant.</ThemedText>
        </ThemedView>
        {IS_INTERNAL_BUILD ? (
          <TenantConfigForm />
        ) : (
          <ThemedText themeColor="textSecondary">Nothing to configure yet.</ThemedText>
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
