import { Link } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { AppPressable } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import type { AnalyticsApp, AppError } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort } from '@/qlik/context';
import type { AnswersPort } from '@/qlik/port';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

// Held against the port that produced it: a new port means a new Tenant or session, and the
// previous Qlik User's list must not survive that (ADR-0007) — memory only, never stored.
type AppsState = { port: AnswersPort; apps: AnalyticsApp[]; next?: string; error?: AppError; erroredAt?: number };

function AppRow({ app }: { app: AnalyticsApp }) {
  const theme = useTheme();

  // PoC: opening an Analytics App is ticket 20, not yet hardened.
  return (
    <Link href={{ pathname: '/apps/[id]', params: { id: app.id, name: app.name } }} asChild>
      <AppPressable
        accessibilityLabel={`${app.name}, updated ${formatRelativeTime(app.updatedAt)}`}
        // Flattened: `Link asChild` throws in development if its child's style is an array.
        style={StyleSheet.flatten([
          styles.row,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          Elevation.card,
        ])}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {app.name}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {formatRelativeTime(app.updatedAt)}
        </ThemedText>
      </AppPressable>
    </Link>
  );
}

export default function AppsScreen() {
  const port = useAnswersPort();
  const [state, setState] = useState<AppsState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const current = state?.port === port ? state : null;
  // A request started for an earlier port can finish after the current one's; its result is dropped.
  const livePort = useRef(port);
  useEffect(() => {
    livePort.current = port;
  }, [port]);

  const load = useCallback(
    () =>
      port.listAnalyticsApps().then(
        (page) => {
          if (livePort.current === port) setState({ port, apps: page.items, next: page.next });
        },
        (e) => {
          if (livePort.current !== port) return;
          setState({
            port,
            apps: [],
            error: isAppError(e) ? e : { kind: 'ServiceUnavailable' },
            erroredAt: Date.now(),
          });
        },
      ),
    [port],
  );

  useEffect(() => {
    load();
  }, [load]);

  function retry() {
    setState(null);
    load();
  }

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function loadMore() {
    if (!current?.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await port.listAnalyticsApps({ cursor: current.next });
      setState((prev) =>
        prev?.port === port ? { ...prev, apps: [...prev.apps, ...page.items], next: page.next } : prev,
      );
    } catch (e) {
      setState((prev) =>
        prev?.port === port
          ? { ...prev, error: isAppError(e) ? e : { kind: 'ServiceUnavailable' }, erroredAt: Date.now() }
          : prev,
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const header = (
    <View style={styles.intro}>
      <ThemedText type="title">Apps</ThemedText>
      <ThemedText themeColor="textSecondary">Analytics Apps you can access in Qlik.</ThemedText>
      {current?.error && (
        <ErrorState
          error={current.error}
          erroredAt={current.erroredAt ?? 0}
          onRetry={retry}
          onDismiss={() => setState((prev) => (prev ? { ...prev, error: undefined } : prev))}
        />
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={current?.apps ?? []}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={header}
        renderItem={({ item }) => <AppRow app={item} />}
        ListEmptyComponent={
          current === null ? (
            <ActivityIndicator accessibilityLabel="Loading Analytics Apps" />
          ) : current.erroredAt !== undefined ? null : (
            // Only a load that succeeded may say there is nothing to show — a dismissed error must not
            // read as "no apps". Zero apps is also no evidence about licences or access, so no claim is made.
            <ThemedText type="small" themeColor="textSecondary">
              No Analytics Apps to show. Apps you have access to in Qlik will appear here.
            </ThemedText>
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { padding: Spacing.four, gap: Spacing.two },
  intro: { gap: Spacing.one, paddingBottom: Spacing.two },
  row: {
    gap: Spacing.half,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  footerLoading: { paddingVertical: Spacing.four },
});
