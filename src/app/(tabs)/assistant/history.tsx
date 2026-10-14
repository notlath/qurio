import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { warningHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AppPressable, PrimaryButton } from '@/components/pressable';
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

/** The action a left swipe uncovers. It asks first, like every other way to delete. */
function DeleteAction({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <AppPressable
      onPress={onPress}
      accessibilityLabel="Delete"
      style={[styles.deleteAction, { backgroundColor: theme.danger }]}>
      <Icon ios="trash" android="delete" size={18} color="dangerForeground" />
      <ThemedText type="smallBold" themeColor="dangerForeground">
        Delete
      </ThemedText>
    </AppPressable>
  );
}

function ThreadRow({ thread, onDelete }: { thread: Thread; onDelete: (id: string) => void }) {
  const { selected } = useAssistantSelection();
  const theme = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);

  // Deleting a thread is not undoable, so every path to it asks first: the swipe action, a long
  // press, and the screen reader's Delete action. Each row used to carry its own trash button,
  // where a stray tap destroyed a conversation.
  function confirmDelete() {
    const close = () => swipeable.current?.close();
    Alert.alert(
      'Delete conversation?',
      `"${thread.name}" and its answers will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: close },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            warningHaptic();
            onDelete(thread.id);
          },
        },
      ],
      // Android: a tap outside the dialog cancels it, so the row must close then as well.
      { cancelable: true, onDismiss: close },
    );
  }

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={() => <DeleteAction onPress={confirmDelete} />}>
      <Link
        href={{
          pathname: '/assistant/thread/[id]',
          params: { id: thread.id, assistantId: selected?.id, assistantName: selected?.name },
        }}
        asChild>
        <AppPressable
          accessibilityLabel={`Open ${thread.name}`}
          accessibilityHint={`Last updated ${formatRelativeTime(thread.updatedAt)}`}
          accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') confirmDelete();
          }}
          onLongPress={confirmDelete}
          feedback="highlight"
          // Flattened: `Link asChild` throws in development if its child's style is an array.
          // Opaque, so the Delete action stays hidden under the row until a swipe uncovers it.
          style={StyleSheet.flatten([styles.row, { backgroundColor: theme.background }])}>
          <ThemedText numberOfLines={1}>
            {thread.name}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {formatRelativeTime(thread.updatedAt)}
          </ThemedText>
        </AppPressable>
      </Link>
    </ReanimatedSwipeable>
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
          <View style={styles.inset}>
            <ErrorState error={error} erroredAt={erroredAt} onRetry={retry} onDismiss={() => setError(null)} />
          </View>
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

// Rows run edge to edge, so the press highlight and the swipe span the whole width. The text keeps
// its inset through the row's own padding.
const styles = StyleSheet.create({
  listContent: { paddingTop: Spacing.two, paddingBottom: Spacing.four, gap: Spacing.half },
  inset: { paddingHorizontal: Spacing.three },
  row: { gap: Spacing.half, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  deleteAction: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.four },
  skeletons: { gap: Spacing.half },
  // Same height as a row: two text lines in the row's vertical padding.
  skeletonRow: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  skeletonLine: { height: 12, borderRadius: Radius.pill },
  footerLoading: { paddingVertical: Spacing.four },
});
