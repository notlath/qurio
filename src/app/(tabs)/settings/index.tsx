import { Link } from 'expo-router';
import { Children, Fragment, useEffect, useState, type ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { expireAccessTokenNow } from '@/auth/access-token';
import { AppPressable } from '@/components/pressable';
import { usePrivacyLock } from '@/components/lock-gate';
import { NativeSwitch } from '@/components/native-switch';
import { SignInSection } from '@/components/sign-in-section';
import { TenantConfigForm } from '@/components/tenant-config-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import {
  IS_INTERNAL_BUILD,
  type TenantConfig,
} from '@/config';
import { loadAllowScreenshots, setAllowScreenshots } from '@/config/screen-capture';
import { useTenantConfig } from '@/config/context';
import { errorMessageFor } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

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
      <ThemedView type="backgroundElement" style={[styles.group, Shape.continuous, { borderColor: theme.border }]}>
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

function AccountSection({ resolved, onSignedOut }: { resolved: TenantConfig | null | undefined; onSignedOut: () => Promise<void> }) {
  if (resolved === undefined) return null;
  return (
    <Section title="Account">
      {!resolved ? (
        <Row title="Not connected" detail={errorMessageFor({ kind: 'ConfigMissing' }).message} />
      ) : Platform.OS === 'web' ? (
        <Row title="Sign-in unavailable" detail="Sign-in is native-only (ADR-0005) — not available in the web preview." />
      ) : (
        <SignInSection config={resolved} onSignedOut={onSignedOut} />
      )}
    </Section>
  );
}

function PrivacyLockRow() {
  const privacyLock = usePrivacyLock();
  return (
    <View>
      <Row
        title="Privacy lock"
        detail="Ask for your device passcode when you open or return to the app."
        accessory={
          <NativeSwitch
            accessibilityLabel="Privacy lock"
            value={privacyLock.enabled}
            disabled={privacyLock.saving}
            onValueChange={privacyLock.setEnabled}
          />
        }
      />
      {privacyLock.saveError && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" selectable style={styles.rowMessage}>
          {privacyLock.saveError}
        </ThemedText>
      )}
    </View>
  );
}

/** Internal builds only (the caller gates it): lets a tester take screenshots, e.g. for a review. Off by default. */
function ScreenshotRow() {
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
          <NativeSwitch
            accessibilityLabel="Allow screenshots"
            value={!!allowed}
            disabled={allowed === null}
            onValueChange={change}
          />
        }
      />
      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" selectable style={styles.rowMessage}>
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
  const { config: resolved, managed, reloadConfig } = useTenantConfig();
  const native = Platform.OS !== 'web';

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.content, ContentColumn]}
      keyboardShouldPersistTaps="handled">
      <AccountSection resolved={resolved} onSignedOut={reloadConfig} />

      {native && (
        <Section title="Security">
          <PrivacyLockRow />
        </Section>
      )}

      {resolved && (
        <Section title="Tenant">
          {managed ? (
            <Row title={resolved.tenantHost} detail="Configured by your administrator." />
          ) : !native ? (
            // Changing the Tenant signs out through useQlikAuth, which is native-only (ADR-0005).
            <Row title={resolved.tenantHost} />
          ) : (
            <Link href="/settings/change-tenant" asChild>
              <AppPressable accessibilityLabel="Change tenant" accessibilityHint="Opens the Tenant screen">
                <Row title={resolved.tenantHost} accessory={<RowAction label="Change" />} />
              </AppPressable>
            </Link>
          )}
        </Section>
      )}

      {IS_INTERNAL_BUILD && (
        <Section title="Developer">
          <WorkspaceConnection
            resolved={resolved}
            onSaved={() => {
              void reloadConfig();
            }} />
          {native && <ScreenshotRow />}
          {native && <ExpireTokenRow />}
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.five, gap: Spacing.four },
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
});
