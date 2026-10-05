import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ChatScrollView, Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { InteractionRow } from '@/components/interaction-row';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import type { Starter, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { AgenticEntry } from '@/qlik-embed/agentic-entry';
import { useAnswersPort } from '@/qlik/context';

function StarterRow({ starter, onPress }: { starter: Starter; onPress: (prompt: string) => void }) {
  const theme = useTheme();

  return (
    <AppPressable
      onPress={() => onPress(starter.prompt)}
      accessibilityLabel={`Ask: ${starter.prompt}`}
      style={[styles.starterRow, Shape.continuous, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Icon ios="text.bubble" android="chat_bubble" size={18} color="primary" />
      <ThemedText style={styles.starterText}>
        {starter.prompt}
      </ThemedText>
      <Icon ios="arrow.up.right" android="north_east" size={14} color="textSecondary" />
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
    <View style={styles.flex}>
      <AgenticEntry />
      <FlatList
        style={styles.flex}
        contentContainerStyle={[styles.listContent, ContentColumn]}
        data={interactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InteractionRow interaction={item} />}
        keyboardDismissMode="interactive"
        renderScrollComponent={(props) => <ChatScrollView {...props} />}
        ListEmptyComponent={
          asking ? null : (
            <View style={styles.emptyState}>
              <View style={styles.kicker}>
                <ThemedView type="primary" style={styles.kickerMark} />
                <ThemedText type="caption" themeColor="primary">
                  QURIO
                </ThemedText>
              </View>
              <ThemedText type="title" style={styles.welcomeTitle}>
                Find the signal in your work.
              </ThemedText>
              <ThemedText style={styles.welcomeCopy}>
                Ask a clear question. Answers stay grounded in your organization&rsquo;s knowledge.
              </ThemedText>
              {starters.length > 0 && (
                <View style={styles.startersSection}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Start with a prompt
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { flexGrow: 1, padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.five },
  emptyState: { flex: 1, justifyContent: 'center', paddingBottom: Spacing.five, gap: Spacing.three },
  kicker: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two },
  kickerMark: { width: 9, height: 9, borderRadius: Radius.pill },
  welcomeTitle: { maxWidth: 480, textAlign: 'left' },
  welcomeCopy: { maxWidth: 480, textAlign: 'left' },
  startersSection: { gap: Spacing.two, marginTop: Spacing.three },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  starterText: { flex: 1, textAlign: 'left' },
});
