import { Link, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppCover } from '@/components/app-cover';
import { gridLayout } from '@/components/apps-grid';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { selectionHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import type { AnalyticsApp, AppError } from '@/domain';
import { useAppsViewMode, type AppsViewMode } from '@/hooks/use-apps-view-mode';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort } from '@/qlik/context';
import type { AnswersPort } from '@/qlik/port';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

// Held against the port and the search that produced it: a new port means a new Tenant or session,
// and the previous Qlik User's list must not survive that (ADR-0007) — memory only, never stored.
type AppsState = { port: AnswersPort; name: string; apps: AnalyticsApp[]; next?: string; error?: AppError; erroredAt?: number };

/** How long typing must pause before the search runs, so each keystroke is not its own request. */
const SEARCH_DEBOUNCE_MS = 300;

type Search = { port: AnswersPort; name: string };

/** True when `state` holds the list for this port and this search. */
function isFor(state: Search | null, search: Search): boolean {
  return state?.port === search.port && state.name === search.name;
}

/** The update time to show, and the row's spoken label. An app with no valid date shows no time. */
function appSummary(app: AnalyticsApp): { updated: string; label: string } {
  const updated = formatRelativeTime(app.updatedAt);
  return { updated, label: updated ? `${app.name}, updated ${updated}` : app.name };
}

function AppRow({ app }: { app: AnalyticsApp }) {
  const theme = useTheme();
  const { updated, label } = appSummary(app);

  // PoC: opening an Analytics App is ticket 20, not yet hardened.
  return (
    <Link href={{ pathname: '/apps/[id]', params: { id: app.id, name: app.name } }} asChild>
      <AppPressable
        accessibilityLabel={label}
        feedback="scale"
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
          {!!updated && (
            <ThemedText type="caption" themeColor="textSecondary">
              {updated}
            </ThemedText>
          )}
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
function AppCard({ app }: { app: AnalyticsApp }) {
  const theme = useTheme();
  const { updated, label } = appSummary(app);

  return (
    <Link href={{ pathname: '/apps/[id]', params: { id: app.id, name: app.name } }} asChild>
      <AppPressable
        accessibilityLabel={label}
        feedback="scale"
        // Flattened: `Link asChild` throws in development if its child's style is an array.
        style={StyleSheet.flatten([
          styles.card,
          Shape.continuous,
          styles.gridCell,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ])}>
        <AppCover app={app} />
        <View style={styles.cardText}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {app.name}
          </ThemedText>
          {!!updated && (
            <ThemedText type="caption" themeColor="textSecondary">
              {updated}
            </ThemedText>
          )}
        </View>
      </AppPressable>
    </Link>
  );
}

function AppCardSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, styles.gridCell, Shape.continuous, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.skeletonCover, { backgroundColor: theme.backgroundSelected }]} />
      <View style={styles.cardText}>
        <View style={[styles.skeletonLine, { width: '75%', backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.backgroundSelected }]} />
      </View>
    </View>
  );
}

/** Pads the grid's last row with empty cells, so its cards keep the width of the cards above. */
function fillLastRow(apps: AnalyticsApp[], columns: number): (AnalyticsApp | null)[] {
  const fillers = (columns - (apps.length % columns)) % columns;
  return [...apps, ...Array<null>(fillers).fill(null)];
}

/** Switches to the other layout: the icon shows where a tap takes you, as Files and Drive do. */
function ViewModeToggle({ mode, onChange }: { mode: AppsViewMode; onChange: (mode: AppsViewMode) => void }) {
  const next = mode === 'list' ? 'grid' : 'list';

  return (
    <IconButton
      accessibilityLabel={next === 'grid' ? 'Show apps as a grid' : 'Show apps as a list'}
      onPress={() => {
        selectionHaptic();
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
  // The list's own width, not the window's: the docked side panel takes part of a wide window.
  // The window width stands in until the first layout.
  const windowSize = useWindowDimensions();
  const [listWidth, setListWidth] = useState<number | null>(null);
  const { columns, gap } = gridLayout((listWidth ?? windowSize.width) - Spacing.three * 2);
  const grid = viewMode === 'grid';
  const port = useAnswersPort();
  const [state, setState] = useState<AppsState | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // `search` is what the field holds. `name` is the search that runs, once typing pauses.
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const current = isFor(state, { port, name }) ? state : null;
  // A request for an earlier port or search can finish after the current one. Its result is dropped.
  const live = useRef<Search>({ port, name });
  useEffect(() => {
    live.current = { port, name };
  }, [port, name]);

  useEffect(() => {
    const timer = setTimeout(() => setName(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(() => {
    const isLive = () => isFor(live.current, { port, name });
    return port.listAnalyticsApps(name ? { name } : undefined).then(
      (page) => {
        if (isLive()) setState({ port, name, apps: page.items, next: page.next });
      },
      (e) => {
        if (!isLive()) return;
        setState({
          port,
          name,
          apps: [],
          error: isAppError(e) ? e : { kind: 'ServiceUnavailable' },
          erroredAt: Date.now(),
        });
      },
    );
  }, [port, name]);

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
      const page = await port.listAnalyticsApps({ cursor: current.next, name: name || undefined });
      setState((prev) =>
        prev && isFor(prev, { port, name }) ? { ...prev, apps: [...prev.apps, ...page.items], next: page.next } : prev,
      );
    } catch (e) {
      setState((prev) =>
        prev && isFor(prev, { port, name })
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
      <Stack.Screen
        options={{
          headerRight: () => <ViewModeToggle mode={viewMode} onChange={setViewMode} />,
          // The native search field: under the large title on iOS, a header action on Android.
          headerSearchBarOptions: {
            placeholder: 'Search Analytics Apps',
            autoCapitalize: 'none',
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(''),
            onClose: () => setSearch(''),
          },
        }}
      />
      <FlatList
        // numColumns cannot change on a mounted list, so each layout is its own list.
        key={grid ? `grid-${columns}` : 'list'}
        numColumns={grid ? columns : 1}
        columnWrapperStyle={grid ? { gap } : undefined}
        onLayout={(event) => setListWidth(event.nativeEvent.layout.width)}
        contentInsetAdjustmentBehavior="automatic"
        // The grid fills the width it has. The list keeps the centred content column.
        contentContainerStyle={[styles.listContent, grid ? { gap } : ContentColumn]}
        data={grid ? fillLastRow(current?.apps ?? [], columns) : (current?.apps ?? [])}
        keyExtractor={(item, index) => item?.id ?? `filler-${index}`}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={refresh}
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          item === null ? <View style={styles.gridCell} /> : grid ? <AppCard app={item} /> : <AppRow app={item} />
        }
        ListEmptyComponent={
          current === null ? (
            <View
              accessible
              accessibilityLabel="Loading Analytics Apps"
              style={grid ? [styles.skeletons, { gap }] : styles.skeletons}>
              {grid
                ? Array.from({ length: Math.ceil(4 / columns) }, (_, row) => (
                    <View key={row} style={[styles.skeletonRow, { gap }]}>
                      {Array.from({ length: columns }, (_, i) => (
                        <AppCardSkeleton key={i} />
                      ))}
                    </View>
                  ))
                : [0, 1, 2, 3].map((i) => <AppRowSkeleton key={i} />)}
            </View>
          ) : current.erroredAt !== undefined ? null : name ? (
            <EmptyState
              icon={<Icon ios="magnifyingglass" android="search" size={28} color="primary" />}
              title="No matching Analytics Apps"
              message={`No Analytics App name matches "${name}".`}
            />
          ) : (
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
  skeletonRow: { flexDirection: 'row' },
  // Cards share each row equally, so they fill the width the row really has.
  gridCell: { flex: 1 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card, overflow: 'hidden', justifyContent: 'flex-start' },
  cardText: { gap: Spacing.half, padding: Spacing.three },
  skeletonCover: { aspectRatio: 16 / 10 },
  skeletonLine: { height: 12, borderRadius: Radius.pill },
  footerLoading: { paddingVertical: Spacing.four },
});
