import { StyleSheet, TextInput, View, type ScrollViewProps } from 'react-native';
import { KeyboardChatScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, { Easing, FadeIn, Keyframe, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnswerContent } from '@/components/answer-content';
import { tapHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AnswerBubble, QuestionBubble } from '@/components/interaction-row';
import { IconButton } from '@/components/pressable';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ContentColumn, Elevation, Shape, Spacing, TouchTarget } from '@/constants/theme';
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
    // Rides the keyboard frame by frame (iOS interactive dismiss included). The bottom inset (home
    // indicator, or Android's navigation bar) is handed back once the keyboard is up, so the
    // composer sits on the keyboard rather than that inset's height above it.
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
 * someone reading back through a thread is not scrolled away from it. With `lift` off, the keyboard
 * only adds room to scroll: the new chat's welcome keeps itself centred (KeyboardCentered).
 */
export function ChatScrollView({ lift = true, ...props }: ScrollViewProps & { lift?: boolean }) {
  const { bottom } = useSafeAreaInsets();

  return <KeyboardChatScrollView {...props} offset={bottom} keyboardLiftBehavior={lift ? 'whenAtEnd' : 'never'} />;
}

/**
 * The in-flight Interaction: the question already committed, and the Answer in the same bubble the
 * finished Answer uses, from the first moment. The same renderer too, so lists and bold do not jump
 * into place at the end.
 */
export function PendingAnswer({ question, partialAnswer }: { question: string; partialAnswer: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <View style={styles.pendingRow}>
      <Animated.View testID="pending-question" entering={reduceMotion ? QUESTION_ENTER_REDUCED : QUESTION_ENTER}>
        <QuestionBubble text={question} />
      </Animated.View>
      {/* Full column from the first word: widening once the Answer grew long reflowed every line the
          reader was in the middle of. The width now changes as the dots give way to text. */}
      <AnswerBubble wide={!!partialAnswer}>
        {partialAnswer ? (
          <AnswerContent markdown={partialAnswer} />
        ) : (
          <View style={styles.thinking} accessibilityLiveRegion="polite">
            <TypingDots />
            <ThemedText type="small" themeColor="textSecondary" style={styles.thinkingText}>
              Searching your knowledge base&hellip;
            </ThemedText>
          </View>
        )}
      </AnswerBubble>
    </View>
  );
}

// The question leaves the composer and lands in the Thread: a short rise says where it went. Under
// 150ms, because it plays for every question. Reduce Motion keeps the fade and drops the rise.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const QUESTION_ENTER = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 8 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
}).duration(150);
const QUESTION_ENTER_REDUCED = FadeIn.duration(150);

/** One dot's pulse: opacity only, so it costs no layout and still reads under Reduce Motion. */
const DOT_PULSE = { '0%': { opacity: 0.3 }, '50%': { opacity: 1 }, '100%': { opacity: 0.3 } };

/**
 * Three dots that pulse in turn while the Answer is on its way. A CSS animation runs on the UI
 * thread, so it keeps moving while JS parses the stream. Reduce Motion holds them still; the text
 * beside them already says what is happening. Hidden from screen readers for the same reason.
 */
function TypingDots() {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <View testID="typing-dots" style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {[0, 1, 2].map((index) => (
        <Animated.View
          key={index}
          testID="typing-dot"
          style={[
            styles.dot,
            { backgroundColor: theme.primary },
            reduceMotion
              ? styles.dotStill
              : {
                  animationName: DOT_PULSE,
                  animationDuration: '1000ms',
                  animationDelay: `${index * 160}ms`,
                  // Holds a delayed dot at the first keyframe, so it does not sit at full opacity first.
                  animationFillMode: 'backwards',
                  animationIterationCount: 'infinite',
                  animationTimingFunction: 'ease-in-out',
                },
          ]}
        />
      ))}
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
  // On the text baseline, not the line box: the dots' middle then meets the lowercase letters' middle.
  // Centred on the line box, they sat about 2pt above the letters, more on iOS, which adds leading on top.
  thinking: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  dots: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotStill: { opacity: 0.6 },
  // Shrink, never flex: the bubble hugs its content, and on native flex: 1 gave the text a 0 basis, so
  // the bubble shrank to the dots and the text vanished. Shrinking still wraps a long line inside 85%.
  thinkingText: { flexShrink: 1 },
});
