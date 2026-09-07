import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { InteractionRow } from '@/components/interaction-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { ThreadDetail } from '@/domain';
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <Stack.Screen options={{ title: detail.name }} />
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={interactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InteractionRow interaction={item} />}
          keyboardDismissMode="interactive"
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
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const port = useAnswersPort();
  const [detail, setDetail] = useState<ThreadDetail | null>(null);

  useEffect(() => {
    port.getThread(id).then(setDetail);
  }, [port, id]);

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
  listContent: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
