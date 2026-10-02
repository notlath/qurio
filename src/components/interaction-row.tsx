import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';

import { AnswerContent } from '@/components/answer-content';
import { AppPressable, Chip } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Radius, Spacing } from '@/constants/theme';
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
      <ThemedText type="smallBold">{citation.documentPath}</ThemedText>
      {citation.excerpts.map((excerpt, index) => (
        <ThemedText key={index} type="small" themeColor="textSecondary">
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
    <View style={[styles.sources, { borderTopColor: theme.border }]}>
      <AppPressable
        onPress={() => setExpanded((open) => !open)}
        accessibilityLabel={expanded ? `Hide ${label}` : `Show ${label}`}
        accessibilityState={{ expanded }}
        style={styles.sourcesToggle}>
        <ThemedText type="linkPrimary">{expanded ? `Hide ${label}` : label}</ThemedText>
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
      <View style={[styles.feedbackDone, { borderTopColor: theme.border }]}>
        <ThemedText type="caption" themeColor="textSecondary">
          {vote === 1 ? 'You marked this helpful.' : `You marked this not helpful${reason ? ` (${reason})` : ''}.`}
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.feedback, { borderTopColor: theme.border }]}>
      <View style={styles.feedbackButtons}>
        <Chip
          label="Helpful"
          selected={vote === 1}
          onPress={() => submit({ vote: 1 })}
          disabled={submitting}
        />
        <Chip
          label="Not helpful"
          selected={vote === -1}
          onPress={() => setShowNegativeForm(true)}
          disabled={submitting}
        />
        {submitting && <ActivityIndicator size="small" color={theme.primary} />}
      </View>

      {showNegativeForm && (
        <View style={styles.negativeForm}>
          <ThemedText type="caption" themeColor="textSecondary">
            WHAT WENT WRONG?
          </ThemedText>
          <View style={styles.reasonRow}>
            {REASONS.map((r) => (
              <Chip
                key={r}
                label={r}
                selected={reason === r}
                onPress={() => setReason(r)}
                disabled={submitting}
              />
            ))}
          </View>
          <TextInput
            style={[styles.commentInput, { color: theme.text, borderColor: theme.borderStrong }]}
            placeholder="Add a comment (optional)"
            placeholderTextColor={theme.textSecondary}
            accessibilityLabel="Feedback comment"
            value={comment}
            onChangeText={setComment}
            multiline
          />
          <AppPressable
            onPress={() => submit({ vote: -1, reason: reason ?? undefined, comment: comment || undefined })}
            disabled={submitting}
            accessibilityLabel="Submit feedback"
            style={styles.submitAction}>
            <ThemedText type="linkPrimary">Submit feedback</ThemedText>
          </AppPressable>
        </View>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

export function InteractionRow({ interaction }: { interaction: Interaction }) {
  const theme = useTheme();

  return (
    <View style={styles.interactionRow}>
      <ThemedView type="backgroundSelected" style={styles.question}>
        <ThemedText type="question">{interaction.question}</ThemedText>
      </ThemedView>

      <ThemedView type="backgroundElement" style={[styles.answerCard, { borderColor: theme.border }, Elevation.card]}>
        {interaction.answer.blocks.map((block, index) =>
          block.kind === 'text' ? (
            <AnswerContent key={index} markdown={block.markdown} />
          ) : (
            <ThemedText key={index}>{block.insight.narrative}</ThemedText>
          ),
        )}

        {interaction.answer.citations.length > 0 && <Sources citations={interaction.answer.citations} />}

        <FeedbackControl
          threadId={interaction.threadId}
          interactionId={interaction.id}
          initial={interaction.feedback}
        />
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  interactionRow: { gap: Spacing.two },
  question: {
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
  sources: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.one },
  sourcesToggle: { alignSelf: 'flex-start' },
  citationRow: { gap: Spacing.half, paddingLeft: Spacing.three, borderLeftWidth: 2, marginBottom: Spacing.two },
  feedback: { gap: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  feedbackDone: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two },
  feedbackButtons: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', flexWrap: 'wrap' },
  negativeForm: { gap: Spacing.two, paddingTop: Spacing.one },
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
  submitAction: { alignSelf: 'flex-start' },
});
