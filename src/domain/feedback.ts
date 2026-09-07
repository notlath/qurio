export type FeedbackReason = 'inaccurate' | 'irrelevant' | 'repetitive' | 'unhelpful' | 'other';

export type Feedback = {
  vote: 1 | -1;
  reason?: FeedbackReason;
  comment?: string;
};
