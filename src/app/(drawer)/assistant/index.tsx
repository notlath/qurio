import { Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import type { NavigationProp } from 'expo-router/react-navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { AssistantProblem } from '@/components/assistant-switcher';
import { newChatKey, type ChatParams } from '@/components/chat-params';
import { ChatScrollView, Composer, PendingAnswer } from '@/components/composer';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { InteractionRow } from '@/components/interaction-row';
import { AppPressable, IconButton } from '@/components/pressable';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import { threadNameFor } from '@/domain';
import type { AppError, Interaction, Starter, Thread, ThreadDetail } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadConversation } from '@/hooks/use-thread-conversation';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { AnswersScope, useAnswersPort } from '@/qlik/context';

/** This screen's navigation, so `setParams` accepts the chat params only. */
const useChatNavigation = () => useNavigation<NavigationProp<{ index: ChatParams }, 'index'>>();

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
 * The header's "New conversation" button. It shows only once there is a conversation to leave, as in
 * the ChatGPT and Gemini apps: on an empty screen it would do nothing.
 */
function NewConversationButton({ onNew }: { onNew: () => void }) {
  return (
    <IconButton
      accessibilityLabel="New conversation"
      onPress={onNew}
      icon={<Icon ios="square.and.pencil" android="edit_square" size={22} color="primary" />}
    />
  );
}

/** The one chat screen: a new chat, or a Thread opened from the side panel's History. */
export default function ChatScreen() {
  const navigation = useChatNavigation();
  const { selected } = useAssistantSelection();
  const { thread, assistantId, chat } = useLocalSearchParams<ChatParams>();
  // A new chat gets a new `chat` value, so it is a fresh mount: a pending question is aborted and nothing carries over.
  const startNew = useCallback(
    () => navigation.setParams({ thread: undefined, assistantId: undefined, started: undefined, chat: newChatKey() }),
    [navigation],
  );
  // A Thread keeps its Assistant. When the Qlik User selects another Assistant, they leave the Thread
  // for a new chat with that Assistant, as the header's switcher now shows.
  const resumed = thread !== undefined && assistantId !== undefined && assistantId === selected?.id;

  return (
    <View style={styles.flex}>
      <AssistantProblem />
      {resumed ? (
        <ResumedThread key={thread} id={thread} assistantId={assistantId} onNew={startNew} />
      ) : (
        <NewChat key={`${selected?.id ?? 'none'}:${chat ?? ''}`} onNew={startNew} />
      )}
    </View>
  );
}

function NewChat({ onNew }: { onNew: () => void }) {
  const navigation = useChatNavigation();
  const port = useAnswersPort();
  const [starters, setStarters] = useState<Starter[]>([]);
  const threadRef = useRef<Promise<Thread> | null>(null);
  // The Thread is created by the first question, not by opening the screen — and only once,
  // however many questions follow. A failed creation is forgotten rather than cached, so
  // retrying after signing in works instead of replaying the same rejection forever.
  const ensureThreadId = useCallback(async (question: string) => {
    const isNew = threadRef.current === null;
    const pending = (threadRef.current ??= port.createThread(threadNameFor(question)));
    try {
      const { id } = await pending;
      // The side panel highlights this Thread and loads History again, so it is listed.
      if (isNew) navigation.setParams({ started: id });
      return id;
    } catch (e) {
      if (threadRef.current === pending) threadRef.current = null;
      throw e;
    }
  }, [port, navigation]);

  // A new chat has started no Thread yet, also after the Qlik User selects another Assistant.
  useEffect(() => {
    navigation.setParams({ started: undefined });
  }, [navigation]);

  useEffect(() => {
    // Starters are a nicety — a tenant that cannot serve them still answers questions.
    port.listStarters().then(setStarters, () => setStarters([]));
  }, [port]);

  return <Conversation thread={ensureThreadId} starters={starters} onNew={onNew} />;
}

function isAppError(value: unknown): value is AppError {
  return typeof value === 'object' && value !== null && 'kind' in value;
}

function ResumedThread({ id, assistantId, onNew }: { id: string; assistantId: string; onNew: () => void }) {
  const { portFor } = useAssistantSelection();
  // Resuming a Thread always continues with its own Assistant (CONTEXT.md, Thread).
  const scoped = useMemo(() => portFor(assistantId), [portFor, assistantId]);
  return (
    <AnswersScope port={scoped}>
      <LoadedThread id={id} onNew={onNew} />
    </AnswersScope>
  );
}

function LoadedThread({ id, onNew }: { id: string; onNew: () => void }) {
  const port = useAnswersPort();
  const [detail, setDetail] = useState<ThreadDetail | null>(null);
  // A failed load used to leave the spinner up forever.
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
          // Dismissing leaves nothing to show here, so it starts a new chat.
          onDismiss={onNew}
        />
      </View>
    );
  }

  if (!detail) return <ThreadSkeleton />;

  // Mounted only once `detail` is loaded, so useThreadConversation seeds itself from the real
  // interactions: a useState initial value is only read on a component's first render.
  return <Conversation thread={detail.id} initialInteractions={detail.interactions} onNew={onNew} />;
}

/** The list and the Composer. With `starters`, it is a new chat and greets the Qlik User. */
function Conversation({
  thread,
  initialInteractions,
  starters,
  onNew,
}: {
  thread: string | ((question: string) => Promise<string>);
  initialInteractions?: Interaction[];
  starters?: Starter[];
  onNew: () => void;
}) {
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
  } = useThreadConversation(thread, initialInteractions);

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          // No right item at all until there is something to start over. On iOS 26 an item that renders
          // nothing still gets an empty glass circle.
          headerRight: asking || interactions.length > 0 ? () => <NewConversationButton onNew={onNew} /> : undefined,
        }}
      />
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
          asking ? null : starters ? (
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
          ) : (
            <View style={styles.emptyState}>
              <ThemedText type="small" themeColor="textSecondary">
                No messages in this thread yet.
              </ThemedText>
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
});
