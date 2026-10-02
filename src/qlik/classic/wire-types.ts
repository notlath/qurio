/** Qlik's own JSON shapes, as captured in docs/poc-tickets/fixtures/01-verify-assistants-api/. Never imported above the adapter (ADR-0006). */

export type QlikThread = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

/** An Items record for an app, per the published Items API (not yet captured from the real tenant). */
export type QlikItem = {
  id: string;
  name: string;
  resourceType: string;
  resourceId: string;
  updatedAt: string;
  thumbnailId?: string; // "" when the app has no thumbnail (qlik.dev/apis/rest/items)
};

export type QlikChunk = {
  chunkId: string;
  // Declared by the published schema, but GET .../interactions omits it against the real tenant —
  // chunk plaintext is fetched separately via POST .../sources/plaintexts. Optional so the type
  // says what actually arrives, not what the spec promises.
  text?: string;
};

export type QlikSource = {
  knowledgebaseId: string;
  datasourceId: string;
  documentId: string;
  source: string;
  chunks?: QlikChunk[];
};

export type QlikInvokeResponse = {
  question: string;
  output: string;
  sources: QlikSource[];
};

export type QlikInteraction = {
  id: string;
  threadId: string;
  request: string;
  response: string;
  sources: QlikSource[];
  createdAt: string;
};
