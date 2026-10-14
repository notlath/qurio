import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { AnswerContent } from '@/components/answer-content';
import { selectionHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AppPressable, Chip, IconButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
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
 * Sources are collapsed by default. An answer can carry six excerpts of several hundred
 * characters each (ticket-01 fixture 09), which buries the answer itself if it all renders
 * inline — progressive disclosure keeps the answer the thing you read first.
 */
function Sources({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState(false);
  const theme = useTheme();
  const label = `${citations.length} ${citations.length === 1 ? 'source' : 'sources'}`;

  return (
    <View style={styles.sources}>
      <AppPressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityLabel={expanded ? `Hide ${label}` : `Show ${label}`}
        accessibilityState={{ expanded }}
        feedback="scale"
        style={[styles.sourcesToggle, { borderColor: theme.border }]}>
        <Icon ios="doc.text" android="description" size={16} color="primary" />
        <ThemedText type="smallBold" themeColor="primary">
          {label}
        </ThemedText>
        <Icon
          ios={expanded ? 'chevron.up' : 'chevron.down'}
          android={expanded ? 'expand_less' : 'expand_more'}
          size={14}
          color="primary"
        />
      </AppPressable>
      {expanded &&
        citations.map((citation, index) => <CitationRow key={index} citation={citation} />)}
    </View>
  );
}

const REASONS: FeedbackReason[] = ['inaccurate', 'irrelevant', 'repetitive', 'unhelpful', 'other'];

function FeedbackControl({ threadId, interactionId, initial }: { threadId: string; interactionId: string; initial?: Feedback }) {
  const port = useAnswersPort();
  const theme = useTheme();
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

  if (submitted) {
    return (
      <View style={styles.feedbackDone}>
        <Icon
          ios={vote === 1 ? 'hand.thumbsup.fill' : 'hand.thumbsdown.fill'}
          android={vote === 1 ? 'thumb_up' : 'thumb_down'}
          size={16}
          color="textSecondary"
        />
        <ThemedText type="caption" themeColor="textSecondary">
          {vote === 1 ? 'You marked this helpful.' : `You marked this not helpful${reason ? ` (${reason})` : ''}.`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.feedback}>
      <View style={styles.feedbackButtons}>
        <IconButton
          accessibilityLabel="Helpful"
          accessibilityState={{ selected: vote === 1 }}
          onPress={() => {
            selectionHaptic();
            submit({ vote: 1 });
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
            setShowNegativeForm(true);
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
                onPress={() => setReason(r)}
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
            onChangeText={setComment}
            multiline
          />
          <View style={styles.formActions}>
            <AppPressable
              onPress={() => setShowNegativeForm(false)}
              disabled={submitting}
              accessibilityLabel="Cancel feedback">
              <ThemedText type="link" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </AppPressable>
            <AppPressable
              onPress={() => submit({ vote: -1, reason: reason ?? undefined, comment: comment || undefined })}
              disabled={submitting}
              accessibilityLabel="Submit feedback">
              <ThemedText type="linkPrimary">Submit feedback</ThemedText>
            </AppPressable>
          </View>
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" selectable>
          {error}
        </ThemedText>
      )}
    </View>
  );
}

/**
 * The question is a bubble; the answer sits unboxed on the page, as the thing being read. A card
 * around every answer added a border, a shadow and 16pt of inset to the longest text on screen.
 */
export function InteractionRow({ interaction }: { interaction: Interaction }) {
  return (
    <View style={styles.interactionRow}>
      <ThemedView type="backgroundSelected" style={[styles.question, Shape.continuous]}>
        <ThemedText type="question" selectable>
          {interaction.question}
        </ThemedText>
      </ThemedView>

      <View style={styles.answer}>
        {interaction.answer.blocks.map((block, index) =>
          block.kind === 'text' ? (
            <AnswerContent key={index} markdown={block.markdown} />
          ) : (
            <ThemedText key={index} selectable>
              {block.insight.narrative}
            </ThemedText>
          ),
        )}

        {interaction.answer.citations.length > 0 && <Sources citations={interaction.answer.citations} />}

        <FeedbackControl
          threadId={interaction.threadId}
          interactionId={interaction.id}
          initial={interaction.feedback}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  interactionRow: { gap: Spacing.three },
  question: {
    alignSelf: 'flex-end',
    maxWidth: '88%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.card,
  },
  answer: { gap: Spacing.two },
  sources: { gap: Spacing.two },
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
  feedback: { gap: Spacing.two },
  feedbackDone: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: TouchTarget },
  // Pulled left by the icon buttons' own inset so the thumbs line up with the answer text.
  feedbackButtons: { flexDirection: 'row', alignItems: 'center', marginLeft: -Spacing.two },
  negativeForm: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.four },
  reasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  commentInput: {
    fontSize: 15,
    minHeight: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
});
