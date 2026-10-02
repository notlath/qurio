import { ActivityIndicator, StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
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

  return (
    // Rides the keyboard frame by frame (iOS interactive dismiss included). The bottom inset —
    // home indicator plus tab bar inside the tabs — is handed back once the keyboard is up, so the
    // composer sits on the keyboard rather than a tab bar's height above it.
    <KeyboardStickyView offset={{ opened: bottom }} style={[styles.dock, { paddingBottom: Spacing.two + bottom }]}>
      <ThemedView
        type="backgroundElement"
        style={[styles.composer, ContentColumn, Shape.continuous, { borderColor: theme.borderStrong }, Elevation.floating]}>
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder="Ask a question"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Your question"
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={onAsk}
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
            onPress={onAsk}
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

/** The in-flight turn: the question already committed, and the answer as it streams in. */
export function PendingAnswer({ question, partialAnswer }: { question: string; partialAnswer: string }) {
  const theme = useTheme();

  return (
    <View style={styles.pendingRow}>
      <ThemedView type="backgroundSelected" style={[styles.pendingQuestion, Shape.continuous]}>
        <ThemedText type="question">{question}</ThemedText>
      </ThemedView>
      {partialAnswer ? (
        <ThemedText>{partialAnswer}</ThemedText>
      ) : (
        <View style={styles.thinking} accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" color={theme.primary} />
          <ThemedText type="caption" themeColor="textSecondary">
            Searching your knowledge base&hellip;
          </ThemedText>
        </View>
      )}
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
    paddingLeft: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    // Near-pill at one line; keeps the card radius rather than a stadium as the question wraps.
    borderRadius: Radius.card,
  },
  input: {
    flex: 1,
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 120,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.two,
    // Centres a single 22pt line in the tap-target-high field, level with the send button.
    paddingVertical: (TouchTarget - 22) / 2,
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
});
