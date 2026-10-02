import { Link } from 'expo-router';
import { Children, Fragment, useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expireAccessTokenNow } from '@/auth/access-token';
import { AppPressable, PrimaryButton } from '@/components/pressable';
import { usePrivacyLock } from '@/components/lock-gate';
import { SignInSection } from '@/components/sign-in-section';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import {
  IS_INTERNAL_BUILD,
  loadDevConfig,
  resolveCurrentTenantConfig,
  saveDevConfig,
  validateTenantHost,
  type TenantConfig,
} from '@/config';
import { loadAllowScreenshots, setAllowScreenshots } from '@/config/screen-capture';
import { errorMessageFor } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useReloadAnswersPort } from '@/qlik/context';

/** A titled, grouped list: one surface per section, rows split by inset hairlines. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;

  return (
    <View style={styles.section}>
      <ThemedText type="caption" themeColor="textSecondary" accessibilityRole="header" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </ThemedText>
      <ThemedView type="backgroundElement" style={[styles.group, { borderColor: theme.border }, Elevation.card]}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
            {row}
          </Fragment>
        ))}
      </ThemedView>
    </View>
  );
}

/** Title and optional detail on the left, a control or action on the right. */
function Row({ title, detail, accessory }: { title: string; detail?: string; accessory?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <ThemedText>{title}</ThemedText>
        {detail && (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        )}
      </View>
      {accessory}
    </View>
  );
}

function RowAction({ label }: { label: string }) {
  return (
    <ThemedText type="linkPrimary" themeColor="primary">
      {label}
    </ThemedText>
  );
}

function AccountSection({ resolved }: { resolved: TenantConfig | null | undefined }) {
  if (resolved === undefined) return null;
  return (
    <Section title="Account">
      {!resolved ? (
        <Row title="Not connected" detail={errorMessageFor({ kind: 'ConfigMissing' }).message} />
      ) : Platform.OS === 'web' ? (
        <Row title="Sign-in unavailable" detail="Sign-in is native-only (ADR-0005) — not available in the web preview." />
      ) : (
        <SignInSection config={resolved} />
      )}
    </Section>
  );
}

function PrivacyLockRow() {
  const theme = useTheme();
  const privacyLock = usePrivacyLock();
  return (
    <View>
      <Row
        title="Privacy lock"
        detail="Ask for your device passcode when you open or return to the app."
        accessory={
          <Switch
            accessibilityLabel="Privacy lock"
            value={privacyLock.enabled}
            disabled={privacyLock.saving}
            onValueChange={privacyLock.setEnabled}
            trackColor={{ false: theme.borderStrong, true: theme.primary }}
          />
        }
      />
      {privacyLock.saveError && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" style={styles.rowMessage}>
          {privacyLock.saveError}
        </ThemedText>
      )}
    </View>
  );
}

/** Internal builds only (the caller gates it): lets a tester take screenshots, e.g. for a review. Off by default. */
function ScreenshotRow() {
  const theme = useTheme();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAllowScreenshots().then(setAllowed);
  }, []);

  async function change(next: boolean) {
    setError(null);
    try {
      await setAllowScreenshots(next);
      setAllowed(next);
    } catch {
      setError('Could not change screenshot protection.');
    }
  }

  return (
    <View>
      <Row
        title="Allow screenshots"
        detail="Remembered on this device. Release builds always block capture."
        accessory={
          <Switch
            accessibilityLabel="Allow screenshots"
            value={!!allowed}
            disabled={allowed === null}
            onValueChange={change}
            trackColor={{ false: theme.borderStrong, true: theme.primary }}
          />
        }
      />
      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" style={styles.rowMessage}>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/** Collapsed to a summary row by default, so the four fields only appear when someone asks for them. */
function WorkspaceConnection({
  resolved,
  onSaved,
}: {
  resolved: TenantConfig | null | undefined;
  onSaved: (active: TenantConfig | null) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <AppPressable
        accessibilityLabel="Workspace connection"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}>
        <Row
          title="Workspace connection"
          detail={resolved ? resolved.tenantHost : 'Not configured'}
          accessory={<RowAction label={open ? 'Done' : 'Edit'} />}
        />
      </AppPressable>
      {open && <TenantConfigForm onSaved={onSaved} />}
    </View>
  );
}

function TenantConfigForm({ onSaved }: { onSaved: (active: TenantConfig | null) => void }) {
  const theme = useTheme();
  const reloadPort = useReloadAnswersPort();
  const [tenantHost, setTenantHost] = useState('');
  const [clientId, setClientId] = useState('');
  const [assistantId, setAssistantId] = useState('');
  const [agenticAssistantId, setAgenticAssistantId] = useState('');
  const [fieldError, setFieldError] = useState<{ field: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    loadDevConfig().then((dev) => {
      setTenantHost(dev?.tenantHost ?? '');
      setClientId(dev?.clientId ?? '');
      setAssistantId(dev?.assistantId ?? '');
      setAgenticAssistantId(dev?.agenticAssistantId ?? '');
    });
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
      onSaved(active);
      // Says what the Assistant tab will now do, which a bare "Saved" would not.
      setSaved(`Saved. Agentic Assistant: ${active?.agenticAssistantId ? 'on' : 'off'}.`);
      reloadPort(); // the port was built from the old config — without this the save needs an app restart
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = [styles.input, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }];

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="small">Tenant hostname</ThemedText>
        <TextInput
          style={inputStyle}
          placeholder="acme.eu.qlikcloud.com"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          value={tenantHost}
          onChangeText={edit(setTenantHost)}
        />
        {fieldError?.field === 'tenantHost' && (
          <ThemedText type="small" themeColor="danger">
            {fieldError.message}
          </ThemedText>
        )}
      </View>

      <View style={styles.field}>
        <ThemedText type="small">OAuth client id</ThemedText>
        <TextInput style={inputStyle} autoCapitalize="none" autoCorrect={false} value={clientId} onChangeText={edit(setClientId)} />
      </View>

      <View style={styles.field}>
        <ThemedText type="small">Assistant id</ThemedText>
        <TextInput
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          value={assistantId}
          onChangeText={edit(setAssistantId)}
        />
      </View>

      <View style={styles.field}>
        <ThemedText type="small">Agentic Assistant id (optional)</ThemedText>
        <TextInput
          style={inputStyle}
          autoCapitalize="none"
          autoCorrect={false}
          value={agenticAssistantId}
          onChangeText={edit(setAgenticAssistantId)}
        />
      </View>

      {fieldError?.field === 'form' && (
        <ThemedText type="small" themeColor="danger">
          {fieldError.message}
        </ThemedText>
      )}

      <PrimaryButton label="Validate & Save" busy={saving} onPress={handleSave} />
      {saved && (
        <ThemedText type="small" themeColor="primary" accessibilityLiveRegion="polite">
          {saved}
        </ThemedText>
      )}
    </View>
  );
}

/** Device validation only (ticket 19): rendered in internal builds, never in a release. */
function ExpireTokenRow() {
  const [marked, setMarked] = useState(false);

  return (
    <AppPressable
      accessibilityLabel="Expire the access token now"
      onPress={async () => {
        await expireAccessTokenNow();
        setMarked(true);
      }}>
      <Row
        title="Expire access token"
        detail={marked ? 'Token marked expired — the next Qlik request refreshes it.' : 'Test token refresh.'}
        accessory={<RowAction label="Expire" />}
      />
    </AppPressable>
  );
}

export default function SettingsScreen() {
  const [resolved, setResolved] = useState<TenantConfig | null | undefined>(undefined);
  const native = Platform.OS !== 'web';

  useEffect(() => {
    resolveCurrentTenantConfig().then(setResolved, () => setResolved(null));
  }, []);

  return (
    <SafeAreaView style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <ThemedText type="title">Settings</ThemedText>
        </View>

        <AccountSection resolved={resolved} />

        {native && (
          <Section title="Security">
            <PrivacyLockRow />
          </Section>
        )}

        {IS_INTERNAL_BUILD && (
          <Section title="Developer">
            <WorkspaceConnection resolved={resolved} onSaved={setResolved} />
            {native && <ScreenshotRow />}
            {native && <ExpireTokenRow />}
            {native && (
              <Link href="/agentic-spike" asChild>
                <AppPressable accessibilityLabel="Open agentic assistant spike">
                  <Row title="Agentic spike" accessory={<RowAction label="Open" />} />
                </AppPressable>
              </Link>
            )}
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four },
  intro: { gap: Spacing.one },
  section: { gap: Spacing.two },
  // Inset to line up with the row text inside the group, not the group's edge.
  sectionTitle: { paddingHorizontal: Spacing.three },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowText: { flex: 1, gap: Spacing.half },
  rowMessage: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  form: { gap: Spacing.three, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  field: { gap: Spacing.one },
  input: {
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
