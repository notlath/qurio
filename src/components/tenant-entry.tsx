import { useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { hasSession } from '@/auth/access-token';
import { useQlikAuth } from '@/auth/session';
import { AppPressable, PrimaryButton } from '@/components/pressable';
import { SignInSection } from '@/components/sign-in-section';
import { TenantConfigForm } from '@/components/tenant-config-form';
import { ThemedText } from '@/components/themed-text';
import { IS_INTERNAL_BUILD, normalizeTenantHost, saveDevConfig, validateTenantHost, type TenantConfig } from '@/config';
import { useTenantConfig } from '@/config/context';
import { resolveTenant } from '@/config/resolver';
import { ContentColumn, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReloadAnswersPort } from '@/qlik/context';

export function HostnameEntry() {
  const theme = useTheme();
  const { reloadConfig } = useTenantConfig();
  const reloadPort = useReloadAnswersPort();
  const [hostname, setHostname] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolved, setResolved] = useState<TenantConfig | null>(null);
  const [developer, setDeveloper] = useState(false);

  async function connect() {
    setMessage(null);
    const tenantHost = normalizeTenantHost(hostname);
    const result = resolveTenant({ dev: { tenantHost } });
    if (result.kind !== 'resolved') {
      setMessage(result.kind === 'custom-domain'
        ? 'This is a custom domain. Enter your standard Tenant address ending in qlikcloud.com.'
        : result.kind === 'unsupported-region'
          ? `Region "${result.region}" is not supported. Contact your administrator.`
          : 'Enter your Tenant hostname.');
      return;
    }
    setBusy(true);
    try {
      const preflight = await validateTenantHost(tenantHost);
      if (!preflight.ok) {
        setMessage(preflight.message);
        return;
      }
      await saveDevConfig({ tenantHost });
      setResolved(result.config);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save the Tenant hostname.');
    } finally {
      setBusy(false);
    }
  }

  if (resolved) {
    return (
      <View style={styles.form}>
        <SignInSection config={resolved} onSignedIn={reloadConfig} />
        <AppPressable accessibilityLabel="Change tenant" onPress={() => setResolved(null)}>
          <ThemedText type="linkPrimary" themeColor="primary">Change tenant</ThemedText>
        </AppPressable>
      </View>
    );
  }
  return (
    <View style={styles.form}>
      <ThemedText type="title">Connect to your Tenant</ThemedText>
      <ThemedText>Tenant hostname</ThemedText>
      <TextInput
        accessibilityLabel="Tenant hostname"
        value={hostname}
        onChangeText={setHostname}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="acme.sg.qlikcloud.com"
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: theme.borderStrong }]} />
      {message && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      )}
      <PrimaryButton label="Continue" busy={busy} onPress={connect} />
      {IS_INTERNAL_BUILD && (
        <AppPressable accessibilityLabel="Developer" onPress={() => setDeveloper(!developer)}>
          <ThemedText>Developer</ThemedText>
        </AppPressable>
      )}
      {IS_INTERNAL_BUILD && developer && (
        <TenantConfigForm
          onSaved={() => {
            void reloadConfig();
            reloadPort();
          }} />
      )}
    </View>
  );
}

export function TenantEntryGate({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const { config, managed } = useTenantConfig();
  const [signedIn, setSignedIn] = useState<boolean | undefined>();
  useEffect(() => {
    let current = true;
    hasSession().then(
      (signed) => {
        if (current) setSignedIn(signed);
      },
      () => {
        if (current) setSignedIn(false);
      },
    );
    return () => {
      current = false;
    };
  }, [config]);
  if (Platform.OS === 'web') return children;
  if (config === undefined) return null;
  if (config && signedIn === undefined) return null;
  if (config && signedIn) return children;
  return (
    // Painted here: the gate replaces the navigator, which otherwise paints the screen background.
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, ContentColumn]}
      keyboardShouldPersistTaps="handled">
      {config ? (
        <>
          <SignInSection config={config} onSignedIn={async () => {
            setSignedIn(true);
          }} />
          {!managed && <ChangeTenant config={config} />}
        </>
      ) : (
        <HostnameEntry />
      )}
    </ScrollView>
  );
}

export function ChangeTenant({ config }: { config: TenantConfig }) {
  const { signOut } = useQlikAuth(config);
  const { clearConfig } = useTenantConfig();
  const reloadPort = useReloadAnswersPort();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function change() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      await clearConfig();
      reloadPort();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change Tenant.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.form}>
      <ThemedText>{config.tenantHost}</ThemedText>
      <AppPressable accessibilityLabel="Change tenant" disabled={busy} onPress={change}>
        <ThemedText type="linkPrimary" themeColor="primary">Change tenant</ThemedText>
      </AppPressable>
      {error && (
        <ThemedText themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: Spacing.three },
  form: { gap: Spacing.three, padding: Spacing.three },
  input: { fontSize: 16, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.control, padding: Spacing.three },
});
