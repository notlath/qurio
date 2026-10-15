import { StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerContent } from '@/components/answer-content';
import { hasWideBlock } from '@/components/answer-markdown';
import { tapHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AnswerBubble } from '@/components/interaction-row';
import { IconButton } from '@/components/pressable';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContentColumn, Elevation, Radius, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shared by the new-thread screen and a resumed thread — the two were maintaining their own
 * copies of the same input, which is how one of them ended up with a 40pt send button.
 */
export function Composer({
  question,
  setQuestion,
  asking,
  onAsk,
  onStop,
}: {
  question: string;
  setQuestion: (value: string) => void;
  asking: boolean;
  onAsk: () => void;
  onStop: () => void;
}) {
  const theme = useTheme();
  const { bottom } = useSafeAreaInsets();
  const canAsk = !!question.trim();

  function send() {
    if (canAsk) tapHaptic();
    onAsk();
  }

  return (
    // Rides the keyboard frame by frame (iOS interactive dismiss included). The bottom inset —
    // home indicator plus tab bar inside the tabs — is handed back once the keyboard is up, so the
    // composer sits on the keyboard rather than a tab bar's height above it.
    <KeyboardStickyView offset={{ opened: bottom }} style={[styles.dock, { paddingBottom: Spacing.two + bottom }]}>
      <ThemedView
        type="backgroundElement"
        style={[styles.composer, ContentColumn, Shape.continuous, { borderColor: theme.borderStrong }, Elevation.floating]}>
        <TextInput
          style={[TextStyles.default, styles.input, { color: theme.text }]}
          placeholder="Ask a question"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Your question"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={send}
          // A multiline input otherwise inserts a newline on return, so the "send" key never sent.
          submitBehavior="submit"
          editable={!asking}
          returnKeyType="send"
          multiline
        />
        {asking ? (
          <IconButton
            onPress={onStop}
            accessibilityLabel="Stop generating"
            variant="tinted"
            icon={<Icon ios="stop.fill" android="stop" size={16} color="primary" />}
          />
        ) : (
          <IconButton
            onPress={send}
            disabled={!canAsk}
            accessibilityLabel="Ask question"
            variant={canAsk ? 'filled' : 'tinted'}
            icon={<Icon ios="arrow.up" android="arrow_upward" size={20} color={canAsk ? 'primaryForeground' : 'primary'} />}
          />
        )}
      </ThemedView>
    </KeyboardStickyView>
  );
}

/**
 * The message list's scroll view, for FlatList's `renderScrollComponent`: lifts the latest messages
 * with the keyboard by the same distance the composer moves — but only when already at the end, so
 * someone reading back through a thread is not scrolled away from it.
 */
export function ChatScrollView(props: ScrollViewProps) {
  const { bottom } = useSafeAreaInsets();

  return <KeyboardChatScrollView {...props} offset={bottom} keyboardLiftBehavior="whenAtEnd" />;
}

/**
 * The in-flight Interaction: the question already committed, and the Answer in the same bubble the
 * finished Answer uses, from the first moment. The same renderer too, so lists and bold do not jump
 * into place at the end.
 */
export function PendingAnswer({ question, partialAnswer }: { question: string; partialAnswer: string }) {
  const theme = useTheme();

  return (
    <View style={styles.pendingRow}>
      <ThemedView type="backgroundSelected" style={[styles.pendingQuestion, Shape.continuous]}>
        <ThemedText type="question">{question}</ThemedText>
      </ThemedView>
      <AnswerBubble wide={!!partialAnswer && hasWideBlock(partialAnswer)}>
        {partialAnswer ? (
          <AnswerContent markdown={partialAnswer} />
        ) : (
          <View style={styles.thinking} accessibilityLiveRegion="polite">
            {/* Static for now: the animated typing indicator comes with the motion pass. */}
            <ThemedText testID="typing-dots" type="smallBold" style={[styles.dots, { color: theme.primary }]}>
              &bull;&bull;&bull;
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.thinkingText}>
              Searching your knowledge base&hellip;
            </ThemedText>
          </View>
        )}
      </AnswerBubble>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { paddingHorizontal: Spacing.three },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.one,
    padding: Spacing.one,
    paddingLeft: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    // A full pill at one line: the send button's radius plus the padding around it. It stays a rounded
    // rectangle rather than a stadium as the question wraps.
    borderRadius: TouchTarget / 2 + Spacing.one,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.two,
    // Center the shared body line height within the send button's tap target.
    paddingVertical: (TouchTarget - TextStyles.default.lineHeight) / 2,
  },
  pendingRow: { gap: Spacing.three },
  pendingQuestion: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dots: { letterSpacing: 2 },
  thinkingText: { flex: 1 },
});
