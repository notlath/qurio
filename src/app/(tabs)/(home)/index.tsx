import * as Haptics from 'expo-haptics';
import { Link, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppCover } from '@/components/app-cover';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, MaxContentWidth, Radius, Shape, Spacing } from '@/constants/theme';
import type { AnalyticsApp, AppError } from '@/domain';
import { useAppsViewMode, type AppsViewMode } from '@/hooks/use-apps-view-mode';
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
          Shape.continuous,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ])}>
        <View style={[styles.appTile, Shape.continuous, { backgroundColor: theme.backgroundSelected }]}>
          <Icon ios="chart.bar.xaxis" android="bar_chart" color="primary" />
        </View>
        <View style={styles.rowText}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {app.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatRelativeTime(app.updatedAt)}
          </ThemedText>
        </View>
        <Icon ios="chevron.right" android="chevron_right" size={14} color="textSecondary" />
      </AppPressable>
    </Link>
  );
}

/** Placeholder rows in the final row's shape, so the list does not reflow when apps arrive. */
function AppRowSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={[styles.row, Shape.continuous, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.appTile, Shape.continuous, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.rowText}>
        <View style={[styles.skeletonLine, { width: '60%', backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeletonLine, { width: '25%', backgroundColor: theme.backgroundSelected }]} />
      </View>
    </View>
  );
}

/** A grid tile: the app's cover on top, its name and last update below. */
function AppCard({ app, width }: { app: AnalyticsApp; width: number }) {
  const theme = useTheme();

  return (
    <Link href={{ pathname: '/apps/[id]', params: { id: app.id, name: app.name } }} asChild>
      <AppPressable
        accessibilityLabel={`${app.name}, updated ${formatRelativeTime(app.updatedAt)}`}
        // Flattened: `Link asChild` throws in development if its child's style is an array.
        style={StyleSheet.flatten([
          styles.card,
          Shape.continuous,
          { width, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ])}>
        <AppCover app={app} />
        <View style={styles.cardText}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {app.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatRelativeTime(app.updatedAt)}
          </ThemedText>
        </View>
      </AppPressable>
    </Link>
  );
}

function AppCardSkeleton({ width }: { width: number }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, Shape.continuous, { width, borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.skeletonCover, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.cardText}>
        <View style={[styles.skeletonLine, { width: '75%', backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.backgroundSelected }]} />
      </View>
    </View>
  );
}

/** Two columns on phones, three once there is room; card width shares the content column exactly. */
function useGridLayout(): { columns: number; cardWidth: number } {
  const { width } = useWindowDimensions();
  const columns = width >= 600 ? 3 : 2;
  const content = Math.min(width, MaxContentWidth) - Spacing.three * 2;
  return { columns, cardWidth: Math.floor((content - Spacing.two * (columns - 1)) / columns) };
}

/** Switches to the other layout: the icon shows where a tap takes you, as Files and Drive do. */
function ViewModeToggle({ mode, onChange }: { mode: AppsViewMode; onChange: (mode: AppsViewMode) => void }) {
  const next = mode === 'list' ? 'grid' : 'list';

  return (
    <IconButton
      accessibilityLabel={next === 'grid' ? 'Show apps as a grid' : 'Show apps as a list'}
      onPress={() => {
        if (process.env.EXPO_OS !== 'web') Haptics.selectionAsync();
        onChange(next);
      }}
      icon={
        next === 'grid' ? (
          <Icon ios="square.grid.2x2" android="grid_view" size={20} color="primary" />
        ) : (
          <Icon ios="list.bullet" android="view_list" size={20} color="primary" />
        )
      }
    />
  );
}

export default function AppsScreen() {
  const [viewMode, setViewMode] = useAppsViewMode();
  const { columns, cardWidth } = useGridLayout();
  const grid = viewMode === 'grid';
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
      <ThemedText type="small" themeColor="textSecondary">
        Analytics Apps you can access in Qlik.
      </ThemedText>
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
    <>
      <Stack.Screen options={{ headerRight: () => <ViewModeToggle mode={viewMode} onChange={setViewMode} /> }} />
      <FlatList
        // numColumns cannot change on a mounted list, so each layout is its own list.
        key={grid ? `grid-${columns}` : 'list'}
        numColumns={grid ? columns : 1}
        columnWrapperStyle={grid ? styles.gridRow : undefined}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.listContent, ContentColumn]}
        data={current?.apps ?? []}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={header}
        renderItem={({ item }) => (grid ? <AppCard app={item} width={cardWidth} /> : <AppRow app={item} />)}
        ListEmptyComponent={
          current === null ? (
            <View
              accessible
              accessibilityLabel="Loading Analytics Apps"
              style={grid ? [styles.skeletons, styles.gridRow, styles.skeletonGrid] : styles.skeletons}>
              {[0, 1, 2, 3].map((i) => (grid ? <AppCardSkeleton key={i} width={cardWidth} /> : <AppRowSkeleton key={i} />))}
            </View>
          ) : current.erroredAt !== undefined ? null : (
            // Only a load that succeeded may say there is nothing to show — a dismissed error must not
            // read as "no apps". Zero apps is also no evidence about licences or access, so no claim is made.
            <EmptyState
              icon={<Icon ios="square.grid.2x2" android="apps" size={28} color="primary" />}
              title="No Analytics Apps yet"
              message="Apps you have access to in Qlik will appear here."
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null}
      />
    </>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four, gap: Spacing.two },
  intro: { gap: Spacing.three, paddingHorizontal: Spacing.one, paddingBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: Spacing.half },
  appTile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.small },
  skeletons: { gap: Spacing.two },
  gridRow: { gap: Spacing.two },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'flex-start' },
  cardText: { gap: Spacing.half, padding: Spacing.three },
  skeletonCover: { aspectRatio: 16 / 10 },
  skeletonLine: { height: 12, borderRadius: Radius.pill },
  footerLoading: { paddingVertical: Spacing.four },
});
