import { Link, Stack } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AssistantProblem } from '@/components/assistant-switcher';
import { ChatScrollView, Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { InteractionRow } from '@/components/interaction-row';
import { AppPressable, IconButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import type { Starter, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { useAnswersPort } from '@/qlik/context';
// PROTOTYPE (prototype/side-panel): the side panel variants host on this screen.
import { SidePanelPrototype } from '@/components/side-panel.prototype';

function StarterRow({ starter, onPress }: { starter: Starter; onPress: (prompt: string) => void }) {
  const theme = useTheme();

  return (
    <AppPressable
      onPress={() => onPress(starter.prompt)}
      accessibilityLabel={`Ask: ${starter.prompt}`}
      feedback="scale"
      style={[styles.starterRow, Shape.continuous, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
      <Icon ios="text.bubble" android="chat_bubble" size={16} color="primary" />
      <ThemedText type="small" numberOfLines={2} style={styles.starterText}>
        {starter.prompt}
      </ThemedText>
    </AppPressable>
  );
}

/**
 * The header's actions. "New conversation" shows only once there is a conversation to leave, as in
 * the ChatGPT and Gemini apps: on an empty screen it would do nothing.
 */
function HeaderActions({ canStartNew, onNew }: { canStartNew: boolean; onNew: () => void }) {
  return (
    <View style={styles.headerActions}>
      {canStartNew && (
        <IconButton
          accessibilityLabel="New conversation"
          onPress={onNew}
          icon={<Icon ios="square.and.pencil" android="edit_square" size={22} color="primary" />}
        />
      )}
      <Link href="/assistant/history" asChild>
        <IconButton
          accessibilityLabel="Open conversation history"
          icon={<Icon ios="clock.arrow.circlepath" android="history" size={22} color="primary" />}
        />
      </Link>
    </View>
  );
}

export default function NewThreadScreen() {
  const { selected } = useAssistantSelection();
  // A new conversation is a fresh mount, so a pending question is aborted and nothing carries over.
  const [conversation, setConversation] = useState(0);
  return (
    <SidePanelPrototype onNew={() => setConversation((n) => n + 1)}>
      <View style={styles.flex}>
        <AssistantProblem />
        <NewThreadConversation
          key={`${selected?.id ?? 'none'}:${conversation}`}
          onNew={() => setConversation((n) => n + 1)}
        />
      </View>
    </SidePanelPrototype>
  );
}

function NewThreadConversation({ onNew }: { onNew: () => void }) {
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
      <Stack.Screen
        options={{
          headerRight: () => <HeaderActions canStartNew={asking || interactions.length > 0} onNew={onNew} />,
        }}
      />
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
              <ThemedText type="title" style={styles.welcomeTitle}>
                What can I help with?
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.welcomeCopy}>
                Answers stay grounded in your organization&rsquo;s knowledge.
              </ThemedText>
              {starters.length > 0 && (
                <View style={styles.startersSection} accessibilityLabel="Start with a prompt">
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  listContent: { flexGrow: 1, padding: Spacing.three, paddingTop: Spacing.four, gap: Spacing.five },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: Spacing.five, gap: Spacing.three },
  welcomeTitle: { maxWidth: 480, textAlign: 'center' },
  welcomeCopy: { maxWidth: 480, textAlign: 'center' },
  startersSection: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.two, marginTop: Spacing.three },
  starterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  starterText: { flexShrink: 1 },
});
