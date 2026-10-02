import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';

import { ChatScrollView, Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { InteractionRow } from '@/components/interaction-row';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Spacing } from '@/constants/theme';
import type { AppError, ThreadDetail } from '@/domain';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { useAnswersPort } from '@/qlik/context';

// A separate component, mounted only once `detail` is loaded, so useThreadConversation's
// internal useState seeds itself from the real interactions on its one and only mount —
// calling the hook directly in the parent would lock in `[]` from before `detail` arrived,
// since a useState initial value is only read on a component's first render.
function ThreadConversation({ detail }: { detail: ThreadDetail }) {
  const {
    interactions,
    question,
    setQuestion,
    asking,
    pendingQuestion,
    partialAnswer,
    error,
    erroredAt,
    ask,
    stop,
    dismissError,
  } = useThreadConversation(detail.id, detail.interactions);

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: detail.name }} />
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.listContent, ContentColumn]}
        data={interactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InteractionRow interaction={item} />}
        keyboardDismissMode="interactive"
        renderScrollComponent={(props) => <ChatScrollView {...props} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ThemedText type="small" themeColor="textSecondary">
              No messages in this thread yet.
            </ThemedText>
          </View>
        }
        ListFooterComponent={
          asking ? (
            <PendingAnswer question={pendingQuestion} partialAnswer={partialAnswer} />
          ) : error && erroredAt ? (
            <ErrorState error={error} erroredAt={erroredAt} onRetry={() => ask()} onDismiss={dismissError} />
          ) : null
        }
      />
      <Composer
        question={question}
        setQuestion={setQuestion}
        asking={asking}
        onAsk={() => ask()}
        onStop={stop}
      />
    </View>
  );
}

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const port = useAnswersPort();
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  // A failed load used to leave the spinner up forever, with no way out but Back.
  const [failure, setFailure] = useState<{ error: AppError; at: number } | null>(null);

  const load = useCallback(() => {
    port.getThread(id).then(setDetail, (e) =>
      setFailure({ error: isAppError(e) ? e : { kind: 'ServiceUnavailable' }, at: Date.now() }),
    );
  }, [port, id]);

  useEffect(load, [load]);

  if (failure) {
    return (
      <View style={styles.failureState}>
        <ErrorState
          error={failure.error}
          erroredAt={failure.at}
          onRetry={() => {
            setFailure(null);
            load();
          }}
          // Dismissing leaves nothing to show here, so it leaves the screen.
          onDismiss={() => router.back()}
        />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.loadingState}>
        <ActivityIndicator accessibilityLabel="Loading conversation" />
      </View>
    );
  }

  return <ThreadConversation detail={detail} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  failureState: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  listContent: { flexGrow: 1, padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.five },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
