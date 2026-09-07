export type Citation = {
  documentId: string;
  knowledgeBaseId: string;
  documentPath: string; // maps from Qlik's `source`, e.g. "Q3-Handbook.pdf"
  excerpts: string[]; // chunk text, present when includeText was requested
};

/**
 * An Answer is a list of blocks so a future agentic adapter can emit richer
 * block kinds without restructuring the UI. The classic adapter emits exactly
 * one 'text' block. See ADR-0006.
 */
export type AnswerBlock =
  | { kind: 'text'; markdown: string }
  | { kind: 'insight'; markdown: string; insight: AnalyticsInsight };

export type AnalyticsInsight = {
  title: string;
  narrative: string;
  // Chart payload shape stays unmodelled until Qlik publishes the agentic API.
};

export type Answer = { blocks: AnswerBlock[]; citations: Citation[] };
