import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ChatScrollView, Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { InteractionRow } from '@/components/interaction-row';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import type { AppError, ThreadDetail } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { AnswersScope, useAnswersPort } from '@/qlik/context';

// A separate component, mounted only once `detail` is loaded, so useThreadConversation's
// internal useState seeds itself from the real interactions on its one and only mount —
// calling the hook directly in the parent would lock in `[]` from before `detail` arrived,
// since a useState initial value is only read on a component's first render.
function ThreadConversation({ detail, assistantName }: { detail: ThreadDetail; assistantName: string }) {
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
      <Stack.Screen options={{ title: assistantName }} />
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.listContent, ContentColumn]}
        data={interactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InteractionRow interaction={item} />}
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
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
  const { id, assistantId, assistantName } = useLocalSearchParams<{ id: string; assistantId: string; assistantName: string }>();
  const { portFor } = useAssistantSelection();
  const scoped = useMemo(() => portFor(assistantId), [portFor, assistantId]);
  return (
    <AnswersScope port={scoped}>
      <LoadedThreadScreen id={id} assistantName={assistantName} />
    </AnswersScope>
  );
}

function LoadedThreadScreen({ id, assistantName }: { id: string; assistantName: string }) {
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

  if (!detail) return <ThreadSkeleton />;

  return <ThreadConversation detail={detail} assistantName={assistantName} />;
}

/** A question bubble and an answer's lines, where the conversation will land, so nothing reflows. */
function ThreadSkeleton() {
  const theme = useTheme();
  const fill = { backgroundColor: theme.backgroundSelected };

  return (
    <View accessible accessibilityLabel="Loading conversation" style={[styles.listContent, ContentColumn]}>
      <View style={styles.skeletonTurn}>
        <View style={[styles.skeletonQuestion, Shape.continuous, fill]} />
        <View style={styles.skeletonAnswer}>
          {(['100%', '92%', '60%'] as const).map((width) => (
            <View key={width} style={[styles.skeletonLine, { width }, fill]} />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skeletonTurn: { gap: Spacing.three },
  // A one-line question bubble: the question line height inside the bubble's vertical padding.
  skeletonQuestion: {
    alignSelf: 'flex-end',
    width: '60%',
    height: TextStyles.question.lineHeight + Spacing.two * 2,
    borderRadius: Radius.card,
  },
  skeletonAnswer: { gap: Spacing.three },
  skeletonLine: { height: 12, borderRadius: Radius.pill },
  failureState: { flex: 1, justifyContent: 'center', padding: Spacing.three },
  listContent: { flexGrow: 1, padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.five },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
