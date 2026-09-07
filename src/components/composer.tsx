import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radius, Spacing, TouchTarget } from '@/constants/theme';
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

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.composer, { borderColor: theme.borderStrong }, Elevation.card]}>
      <TextInput
        style={[styles.input, { color: theme.text }]}
        placeholder="Ask a question"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Your question"
        value={question}
        onChangeText={setQuestion}
        onSubmitEditing={onAsk}
        editable={!asking}
        returnKeyType="send"
        multiline
      />
      {asking ? (
        <AppPressable
          onPress={onStop}
          accessibilityLabel="Stop generating"
          style={[styles.sendButton, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="smallBold" themeColor="primary">
            Stop
          </ThemedText>
        </AppPressable>
      ) : (
        <AppPressable
          onPress={onAsk}
          disabled={!question.trim()}
          accessibilityLabel="Ask question"
          style={[styles.sendButton, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" themeColor="primaryForeground">
            Ask
          </ThemedText>
        </AppPressable>
      )}
    </ThemedView>
  );
}

/** The in-flight turn: the question already committed, and the answer as it streams in. */
export function PendingAnswer({ question, partialAnswer }: { question: string; partialAnswer: string }) {
  const theme = useTheme();

  return (
    <View style={styles.pendingRow}>
      <ThemedView type="backgroundSelected" style={styles.pendingQuestion}>
        <ThemedText type="smallBold">{question}</ThemedText>
      </ThemedView>
      <ThemedView
        type="backgroundElement"
        style={[styles.answerCard, { borderColor: theme.border }, Elevation.card]}>
        {partialAnswer ? (
          <ThemedText>{partialAnswer}</ThemedText>
        ) : (
          <View style={styles.thinking}>
            <ActivityIndicator size="small" color={theme.primary} />
            <ThemedText type="caption" themeColor="textSecondary">
              Searching your knowledge base&hellip;
            </ThemedText>
          </View>
        )}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.two,
    padding: Spacing.two,
    margin: Spacing.three,
    marginTop: 0,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.control,
  },
  pendingRow: { gap: Spacing.two },
  pendingQuestion: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
  },
  answerCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
