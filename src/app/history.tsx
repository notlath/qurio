import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { AppPressable } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import type { AppError, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort } from '@/qlik/context';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

function ThreadRow({ thread, onDelete }: { thread: Thread; onDelete: (id: string) => void }) {
  const theme = useTheme();

  // Deleting a thread is not undoable and the control sits inside a tappable row — a stray tap
  // used to destroy a conversation outright, with no confirmation of any kind.
  function confirmDelete() {
    Alert.alert('Delete conversation?', `"${thread.name}" and its answers will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(thread.id) },
    ]);
  }

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.row, { borderColor: theme.border }, Elevation.card]}>
      <Link href={{ pathname: '/thread/[id]', params: { id: thread.id } }} asChild>
        <AppPressable
          accessibilityLabel={`Open ${thread.name}`}
          accessibilityHint={`Last updated ${formatRelativeTime(thread.updatedAt)}`}
          style={styles.rowText}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {thread.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatRelativeTime(thread.updatedAt)}
          </ThemedText>
        </AppPressable>
      </Link>
      <AppPressable
        onPress={confirmDelete}
        accessibilityLabel={`Delete ${thread.name}`}
        style={styles.deleteAction}>
        <ThemedText type="link" themeColor="danger">
          Delete
        </ThemedText>
      </AppPressable>
    </ThemedView>
  );
}

export default function HistoryScreen() {
  const port = useAnswersPort();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [erroredAt, setErroredAt] = useState(0);

  const load = useCallback(() => {
    port.listThreads().then(
      ({ items, next }) => {
        setThreads(items);
        setNextCursor(next);
        setInitialLoad(false);
      },
      (e) => {
        // The list used to render as a permanently blank screen when this rejected.
        setError(isAppError(e) ? e : { kind: 'ServiceUnavailable' });
        setErroredAt(Date.now());
        setInitialLoad(false);
      },
    );
  }, [port]);

  useEffect(load, [load]);

  // Only the retry path resets these — doing it inside the effect would be a synchronous
  // setState on mount, which React flags and which re-renders for no reason.
  function retry() {
    setError(null);
    setInitialLoad(true);
    load();
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const { items, next } = await port.listThreads({ cursor: nextCursor });
      setThreads((prev) => [...prev, ...items]);
      setNextCursor(next);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleDelete(id: string) {
    const previous = threads;
    setThreads((prev) => prev.filter((t) => t.id !== id)); // optimistic — restored below if it fails
    try {
      await port.deleteThread(id);
    } catch {
      setThreads(previous);
    }
  }

  const header = (
    <View style={styles.intro}>
      <ThemedText type="subtitle">Conversations</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Return to an answer, source, or earlier line of thinking.
      </ThemedText>
    </View>
  );

  if (initialLoad || error || threads.length === 0) {
    return (
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <View style={styles.centeredContent}>
          {header}
          {initialLoad ? (
            <ActivityIndicator accessibilityLabel="Loading conversations" />
          ) : error ? (
            <ErrorState error={error} erroredAt={erroredAt} onRetry={retry} onDismiss={() => setError(null)} />
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              No conversations yet. Ask a question to start one.
            </ThemedText>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={threads}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ThreadRow thread={item} onDelete={handleDelete} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { padding: Spacing.four, gap: Spacing.two },
  centeredContent: { flex: 1, padding: Spacing.four, gap: Spacing.four },
  intro: { gap: Spacing.one, paddingBottom: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: Spacing.half, paddingVertical: Spacing.three },
  deleteAction: { paddingLeft: Spacing.two },
  footerLoading: { paddingVertical: Spacing.four },
});
