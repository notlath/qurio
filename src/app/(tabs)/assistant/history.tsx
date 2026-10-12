import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton, PrimaryButton } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Spacing } from '@/constants/theme';
import type { AppError, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { useAnswersPort } from '@/qlik/context';

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

function ThreadRow({ thread, onDelete }: { thread: Thread; onDelete: (id: string) => void }) {
  const { selected } = useAssistantSelection();

  // Deleting a thread is not undoable and the control sits inside a tappable row — a stray tap
  // used to destroy a conversation outright, with no confirmation of any kind.
  function confirmDelete() {
    Alert.alert('Delete conversation?', `"${thread.name}" and its answers will be permanently removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(thread.id) },
    ]);
  }

  return (
    // Plain rows grouped by spacing, not a bordered card per row (ui-skills playbook).
    <View style={styles.row}>
      <Link
        href={{
          pathname: '/assistant/thread/[id]',
          params: { id: thread.id, assistantId: selected?.id, assistantName: selected?.name },
        }}
        asChild>
        <AppPressable
          accessibilityLabel={`Open ${thread.name}`}
          accessibilityHint={`Last updated ${formatRelativeTime(thread.updatedAt)}`}
          style={styles.rowText}>
          <ThemedText numberOfLines={1}>
            {thread.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatRelativeTime(thread.updatedAt)}
          </ThemedText>
        </AppPressable>
      </Link>
      <IconButton
        onPress={confirmDelete}
        accessibilityLabel={`Delete ${thread.name}`}
        icon={<Icon ios="trash" android="delete" size={18} color="textSecondary" />}
      />
    </View>
  );
}

export default function HistoryScreen() {
  const { selected, assistants } = useAssistantSelection();
  // With no Assistant to choose, the switcher already says why. Loading History would only add
  // "No Assistant chosen", which tells the Qlik User to pick from nothing (#22).
  const nothingToChoose = !selected && assistants.length === 0;
  return (
    <View style={{ flex: 1 }}>
      <AssistantSwitcher />
      {nothingToChoose ? null : <AssistantHistory key={selected?.id ?? 'none'} />}
    </View>
  );
}

function AssistantHistory() {
  const port = useAnswersPort();
  const router = useRouter();
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
      // The row reappearing on its own read as a glitch; say why it came back.
      Alert.alert('Could not delete conversation', 'Check your connection and try again.');
    }
  }

  return (
    <FlatList
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[styles.listContent, ContentColumn]}
      data={initialLoad || error ? [] : threads}
      keyExtractor={(item) => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => <ThreadRow thread={item} onDelete={handleDelete} />}
      ListEmptyComponent={
        initialLoad ? (
          <View accessible accessibilityLabel="Loading conversations" style={styles.skeletons}>
            {[0, 1, 2, 3].map((i) => (
              <ThreadRowSkeleton key={i} />
            ))}
          </View>
        ) : error ? (
          <ErrorState error={error} erroredAt={erroredAt} onRetry={retry} onDismiss={() => setError(null)} />
        ) : (
          <EmptyState
            icon={<Icon ios="bubble.left.and.bubble.right" android="forum" size={28} color="primary" />}
            title="No conversations yet"
            message="Ask the Assistant a question and the conversation will be saved here.">
            <PrimaryButton label="Ask a question" onPress={() => router.dismissTo('/assistant')} />
          </EmptyState>
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null}
    />
  );
}

/** Placeholder rows in the final row's shape, so the list does not reflow when threads arrive. */
function ThreadRowSkeleton() {
  const theme = useTheme();

  return (
    <View style={[styles.row, styles.skeletonRow]}>
      <View style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.backgroundSelected }]} />
      <View style={[styles.skeletonLine, { width: '20%', backgroundColor: theme.backgroundSelected }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.half },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowText: { flex: 1, gap: Spacing.half, paddingVertical: Spacing.two },
  skeletons: { gap: Spacing.half },
  // Same height as a row: two text lines in the row's vertical padding.
  skeletonRow: { flexDirection: 'column', alignItems: 'flex-start', gap: Spacing.two, paddingVertical: Spacing.three },
  skeletonLine: { height: 12, borderRadius: Radius.pill },
  footerLoading: { paddingVertical: Spacing.four },
});
