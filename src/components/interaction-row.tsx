import { useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { AnswerContent } from '@/components/answer-content';
import { needsFullColumn } from '@/components/answer-markdown';
import { selectionHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AppPressable, Chip, IconButton } from '@/components/pressable';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shape, Spacing, TouchTarget } from '@/constants/theme';
import type { Citation, Feedback, FeedbackReason, Interaction } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAnswersPort } from '@/qlik/context';

// Citations are read-only: Qlik's REST API returns documentId/knowledgebaseId/source (a filename),
// never a URL, so there's no known way to resolve one to the underlying document yet — see
// docs/poc-tickets/fixtures/01-verify-assistants-api/NOTES.md and ticket 6's own escape hatch for this.
function CitationRow({ citation }: { citation: Citation }) {
  const theme = useTheme();

  return (
    <View style={[styles.citationRow, { borderLeftColor: theme.border }]}>
      <ThemedText type="smallBold" selectable>
        {citation.documentPath}
      </ThemedText>
      {citation.excerpts.map((excerpt, index) => (
        <ThemedText key={index} type="small" themeColor="textSecondary" selectable>
          {excerpt}
        </ThemedText>
      ))}
    </View>
  );
}

/**
 * The Sources toggle. Sources are collapsed by default. An answer can carry six excerpts of several
 * hundred characters each (ticket-01 fixture 09), which buries the answer itself if it all renders
 * inline — progressive disclosure keeps the answer the thing you read first.
 */
function SourcesToggle({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  const theme = useTheme();
  const label = `${count} ${count === 1 ? 'source' : 'sources'}`;

  return (
    <AppPressable
      onPress={onToggle}
      accessibilityLabel={open ? `Hide ${label}` : `Show ${label}`}
      accessibilityState={{ expanded: open }}
      feedback="scale"
      style={[styles.sourcesToggle, { borderColor: theme.border }]}>
      <Icon ios="doc.text" android="description" size={16} color="primary" />
      <ThemedText type="smallBold" themeColor="primary">
        {label}
      </ThemedText>
      <Icon
        ios={open ? 'chevron.up' : 'chevron.down'}
        android={open ? 'expand_less' : 'expand_more'}
        size={14}
        color="primary"
      />
    </AppPressable>
  );
}

const REASONS: FeedbackReason[] = ['inaccurate', 'irrelevant', 'repetitive', 'unhelpful', 'other'];

/**
 * Feedback for one Interaction. Its state lives here, so the buttons can sit in the action row
 * beside the Sources toggle while the form and any error open below that row.
 */
function useFeedback(threadId: string, interactionId: string, initial?: Feedback) {
  const port = useAnswersPort();
  const [vote, setVote] = useState<1 | -1 | null>(initial?.vote ?? null);
  const [reason, setReason] = useState<FeedbackReason | null>(initial?.reason ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [showNegativeForm, setShowNegativeForm] = useState(false);
  const [submitted, setSubmitted] = useState(!!initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(f: Feedback) {
    setError(null);
    // Set before the call resolves — kept even on failure so neither the answer nor the
    // user's selection is lost (ticket 9's own requirement).
    setVote(f.vote);
    if (f.reason) setReason(f.reason);
    setSubmitting(true);
    try {
      await port.submitFeedback(threadId, interactionId, f);
      setSubmitted(true);
      setShowNegativeForm(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit feedback.');
    } finally {
      setSubmitting(false);
    }
  }

  return { vote, reason, setReason, comment, setComment, showNegativeForm, setShowNegativeForm, submitted, submitting, error, submit };
}

type FeedbackState = ReturnType<typeof useFeedback>;

/** The thumbs, or what was chosen once it is sent. Lives in the action row. */
function FeedbackButtons({ feedback }: { feedback: FeedbackState }) {
  const theme = useTheme();
  const { vote, reason, showNegativeForm, submitted, submitting } = feedback;

  if (submitted) {
    return (
      <View style={styles.feedbackDone}>
        <Icon
          ios={vote === 1 ? 'hand.thumbsup.fill' : 'hand.thumbsdown.fill'}
          android={vote === 1 ? 'thumb_up' : 'thumb_down'}
          size={16}
          color="textSecondary"
        />
        <ThemedText type="small" themeColor="textSecondary">
          {vote === 1 ? 'You marked this helpful.' : `You marked this not helpful${reason ? ` (${reason})` : ''}.`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.feedbackButtons}>
      <IconButton
        accessibilityLabel="Helpful"
        accessibilityState={{ selected: vote === 1 }}
        onPress={() => {
          selectionHaptic();
          feedback.submit({ vote: 1 });
        }}
        disabled={submitting}
        icon={
          <Icon
            ios={vote === 1 ? 'hand.thumbsup.fill' : 'hand.thumbsup'}
            android="thumb_up"
            size={18}
            color={vote === 1 ? 'primary' : 'textSecondary'}
          />
        }
      />
      <IconButton
        accessibilityLabel="Not helpful"
        accessibilityState={{ selected: vote === -1 || showNegativeForm, expanded: showNegativeForm }}
        onPress={() => {
          selectionHaptic();
          feedback.setShowNegativeForm(true);
        }}
        disabled={submitting}
        icon={
          <Icon
            ios={vote === -1 || showNegativeForm ? 'hand.thumbsdown.fill' : 'hand.thumbsdown'}
            android="thumb_down"
            size={18}
            color={vote === -1 || showNegativeForm ? 'primary' : 'textSecondary'}
          />
        }
      />
      {submitting && <ActivityIndicator size="small" color={theme.primary} />}
    </View>
  );
}

/** The "What went wrong?" form and any send error, below the action row. */
function FeedbackDetails({ feedback }: { feedback: FeedbackState }) {
  const theme = useTheme();
  const { reason, comment, showNegativeForm, submitting, error } = feedback;

  return (
    <>
      {showNegativeForm && (
        <View style={[styles.negativeForm, Shape.continuous, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" accessibilityRole="header">
            What went wrong?
          </ThemedText>
          <View style={styles.reasonRow}>
            {REASONS.map((r) => (
              <Chip
                key={r}
                label={r[0].toUpperCase() + r.slice(1)}
                selected={reason === r}
                onPress={() => feedback.setReason(r)}
                disabled={submitting}
              />
            ))}
          </View>
          <TextInput
            style={[styles.commentInput, Shape.continuous, { color: theme.text, borderColor: theme.borderStrong }]}
            placeholder="Add a comment (optional)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Feedback comment"
            value={comment}
            onChangeText={feedback.setComment}
            multiline
          />
          <View style={styles.formActions}>
            <AppPressable
              onPress={() => feedback.setShowNegativeForm(false)}
              disabled={submitting}
              accessibilityLabel="Cancel feedback">
              <ThemedText type="small" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </AppPressable>
            <AppPressable
              onPress={() => feedback.submit({ vote: -1, reason: reason ?? undefined, comment: comment || undefined })}
              disabled={submitting}
              accessibilityLabel="Submit feedback">
              <ThemedText type="smallBold" themeColor="primary">
                Submit feedback
              </ThemedText>
            </AppPressable>
          </View>
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" selectable>
          {error}
        </ThemedText>
      )}
    </>
  );
}

/** The Qlik User's question, on the right in the brand tint. The same bubble while waiting and once sent. */
export function QuestionBubble({ text }: { text: string }) {
  return (
    <ThemedView testID="question-bubble" type="backgroundSelected" style={[styles.question, Shape.continuous]}>
      <ThemedText type="question" selectable>
        {text}
      </ThemedText>
    </ThemedView>
  );
}

/**
 * The Answer's text, in a neutral bubble on the left. A short Answer hugs its text, up to 85% of the
 * column. An Answer with a table or code block takes the whole column, because a narrower bubble cut
 * the table's columns off (prototype/chat-bubbles). Sources and Feedback stay outside the bubble.
 */
export function AnswerBubble({ wide, children }: { wide: boolean; children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      testID="answer-bubble"
      style={[
        styles.answerBubble,
        wide ? styles.answerBubbleWide : styles.answerBubbleHug,
        Shape.continuous,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}>
      {children}
    </View>
  );
}

/** The question on the right in the brand tint, the Answer on the left, then Sources and Feedback. */
export function InteractionRow({ interaction }: { interaction: Interaction }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const feedback = useFeedback(interaction.threadId, interaction.id, interaction.feedback);
  const { blocks, citations } = interaction.answer;
  const wide = blocks.some((block) => block.kind === 'text' && needsFullColumn(block.markdown));
  // Stopping before the first word leaves nothing to read or rate.
  const empty = citations.length === 0 && blocks.every((block) => block.kind === 'text' && !block.markdown.trim());

  return (
    <View style={styles.interactionRow}>
      <QuestionBubble text={interaction.question} />

      <View style={styles.answer}>
        <AnswerBubble wide={wide}>
          {empty ? (
            <ThemedText type="small" themeColor="textSecondary">
              No Answer was given. It may have been stopped before it started.
            </ThemedText>
          ) : (
            blocks.map((block, index) =>
              block.kind === 'text' ? (
                <AnswerContent key={index} markdown={block.markdown} />
              ) : (
                <ThemedText key={index} selectable>
                  {block.insight.narrative}
                </ThemedText>
              ),
            )
          )}
        </AnswerBubble>

        {/* One row of actions about this Answer: under a short Answer, two stacked rows outweighed it. */}
        {(citations.length > 0 || !empty) && (
          <View testID="answer-actions" style={styles.actions}>
            {citations.length > 0 && (
              <SourcesToggle count={citations.length} open={sourcesOpen} onToggle={() => setSourcesOpen((open) => !open)} />
            )}
            {!empty && <FeedbackButtons feedback={feedback} />}
          </View>
        )}
        {sourcesOpen && citations.map((citation, index) => <CitationRow key={index} citation={citation} />)}
        {!empty && <FeedbackDetails feedback={feedback} />}
      </View>
    </View>
  );
}

/**
 * Both bubbles share one padding and one corner radius, so a one-line question and a one-line Answer
 * read as a pair. The control radius, not the card radius: 22pt turned a one-line bubble into a pill.
 */
const BUBBLE = {
  paddingHorizontal: Spacing.three,
  paddingVertical: Spacing.two + Spacing.one,
  borderRadius: Radius.control,
} as const;

const styles = StyleSheet.create({
  interactionRow: { gap: Spacing.three },
  question: { ...BUBBLE, alignSelf: 'flex-end', maxWidth: '85%' },
  answer: { gap: Spacing.two },
  answerBubble: { ...BUBBLE, gap: Spacing.two, borderWidth: StyleSheet.hairlineWidth },
  answerBubbleHug: { alignSelf: 'flex-start', maxWidth: '85%' },
  answerBubbleWide: { alignSelf: 'stretch' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  sourcesToggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  citationRow: { gap: Spacing.half, paddingLeft: Spacing.three, borderLeftWidth: 2, marginBottom: Spacing.two },
  feedbackDone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: TouchTarget },
  feedbackButtons: { flexDirection: 'row', alignItems: 'center' },
  negativeForm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.four },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  // Typed text is body size, like the composer.
  commentInput: {
    ...TextStyles.default,
    minHeight: TouchTarget,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
});
