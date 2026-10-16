import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { resolveCurrentTenantConfig, type TenantConfig } from '@/config';
import { Spacing } from '@/constants/theme';
import { errorMessageFor } from '@/domain';
import { QlikEmbedHost } from '@/qlik-embed/qlik-embed-host';
import { useAnswersPort } from '@/qlik/context';

/** PoC (ticket 20): opens an Analytics App in the shared embedded host. */
export default function AnalyticsAppScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  // Re-resolved when the port is rebuilt, as Settings does after a save or a sign-in change.
  const port = useAnswersPort();
  const [config, setConfig] = useState<TenantConfig | null | undefined>(undefined);

  useEffect(() => {
    let current = true;
    resolveCurrentTenantConfig().then(
      (resolved) => current && setConfig(resolved),
      () => current && setConfig(null),
    );
    return () => {
      current = false;
    };
  }, [port]);

  return (
    <>
      <Stack.Screen options={{ title: name ?? 'Analytics App' }} />
      {config === undefined ? (
        // Resolving the config is a storage read: a spinner, not a blank screen, while it runs.
        <ThemedView style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Loading Analytics App" />
        </ThemedView>
      ) : config === null ? (
        <ThemedView style={styles.message}>
          <ThemedText themeColor="textSecondary" selectable>{errorMessageFor({ kind: 'ConfigMissing' }).message}</ThemedText>
        </ThemedView>
      ) : (
        <QlikEmbedHost config={config} surface="classic/app" resourceId={id} />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, padding: Spacing.three },
});
