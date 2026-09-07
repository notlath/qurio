import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { InteractionRow } from '@/components/interaction-row';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import type { Starter, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { useAnswersPort } from '@/qlik/context';

function StarterRow({ starter, onPress }: { starter: Starter; onPress: (prompt: string) => void }) {
  const theme = useTheme();

  return (
    <AppPressable
      onPress={() => onPress(starter.prompt)}
      accessibilityLabel={`Ask: ${starter.prompt}`}
      style={[styles.starterRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small">{starter.prompt}</ThemedText>
    </AppPressable>
  );
}

export default function NewThreadScreen() {
  const port = useAnswersPort();
  const [starters, setStarters] = useState<Starter[]>([]);
  const threadRef = useRef<Promise<Thread> | null>(null);
  // The Thread is created by the first question, not by opening the screen — and only once,
  // however many questions follow. A failed creation is forgotten rather than cached, so
  // retrying after signing in works instead of replaying the same rejection forever.
  const ensureThreadId = useCallback(async () => {
    const pending = (threadRef.current ??= port.createThread('New thread'));
    try {
      return (await pending).id;
    } catch (e) {
      if (threadRef.current === pending) threadRef.current = null;
      throw e;
    }
  }, [port]);
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
  } = useThreadConversation(ensureThreadId);

  useEffect(() => {
    // Starters are a nicety — a tenant that cannot serve them still answers questions.
    port.listStarters().then(setStarters, () => setStarters([]));
  }, [port]);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <SafeAreaView style={styles.flex} edges={['bottom']}>
        <FlatList
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          data={interactions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <InteractionRow interaction={item} />}
          keyboardDismissMode="interactive"
          ListEmptyComponent={
            asking ? null : (
              <View style={styles.emptyState}>
                <View style={styles.kicker}>
                  <ThemedView type="primary" style={styles.kickerMark} />
                  <ThemedText type="caption" themeColor="primary">
                    QLIK ANSWERS
                  </ThemedText>
                </View>
                <ThemedText type="title" style={styles.welcomeTitle}>
                  Find the signal in your work.
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.welcomeCopy}>
                  Ask a clear question. Answers stay grounded in your organization&rsquo;s knowledge.
                </ThemedText>
                {starters.length > 0 && (
                  <View style={styles.startersSection}>
                    <ThemedText type="caption" themeColor="textSecondary">
                      START WITH A PROMPT
                    </ThemedText>
                    {starters.map((starter) => (
                      <StarterRow key={starter.id} starter={starter} onPress={ask} />
                    ))}
                  </View>
                )}
              </View>
            )
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1, padding: Spacing.four, gap: Spacing.four },
  emptyState: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.five, gap: Spacing.three },
  kicker: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  kickerMark: { width: 9, height: 9, borderRadius: Radius.pill },
  welcomeTitle: { maxWidth: 340 },
  welcomeCopy: { maxWidth: 340 },
  startersSection: { gap: Spacing.two, marginTop: Spacing.three },
  starterRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
  },
});
