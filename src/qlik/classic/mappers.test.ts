import { toAnalyticsApp, toAnswer, toCitations, toInteraction, toThread } from './mappers';

// Wire shapes below are copied verbatim (ids replaced with fixture placeholders)
// from docs/poc-tickets/fixtures/01-verify-assistants-api/, captured against the real tenant.

describe('toThread', () => {
  it('maps a Qlik thread to the domain Thread (fixture 02)', () => {
    const wire = {
      id: '{threadId}',
      ownerId: '{ownerId}',
      name: 'POC Ticket 01 verification',
      createdAt: '2026-09-02T00:28:33Z',
      updatedAt: '2026-09-02T00:28:33Z',
      hasFeedback: false,
      favorite: false,
      useUserPreferredLanguage: false,
      summaryStats: { likes: 0, dislikes: 0, interactions: 0, reviews: 0, unanswered: 0, inaccurate: 0, irrelevant: 0, repetitive: 0, unhelpful: 0, other: 0 },
    };

    const result = toThread(wire);

    expect(result).toEqual({
      id: '{threadId}',
      name: 'POC Ticket 01 verification',
      createdAt: '2026-09-02T00:28:33Z',
      updatedAt: '2026-09-02T00:28:33Z',
    });
  });
});

describe('toCitations', () => {
  it('maps no sources to no citations (fixture 03 — no KB match)', () => {
    const result = toCitations([]);

    expect(result).toEqual([]);
  });

  it('maps a real multi-chunk source to one Citation with one excerpt per chunk (fixture 09)', () => {
    const sources = [
      {
        knowledgebaseId: '{knowledgeBaseId}',
        datasourceId: '{datasourceId}',
        documentId: '{documentId}',
        source: '{documentName}',
        chunks: [
          { chunkId: '{chunkId1}', text: 'File name: {documentName}\nparagraph one' },
          { chunkId: '{chunkId4}', text: 'paragraph four, no File name prefix' },
        ],
      },
    ];

    const result = toCitations(sources);

    expect(result).toEqual([
      {
        documentId: '{documentId}',
        knowledgeBaseId: '{knowledgeBaseId}',
        documentPath: '{documentName}',
        excerpts: ['paragraph one', 'paragraph four, no File name prefix'],
      },
    ]);
  });
});

describe('toAnswer', () => {
  it('wraps the output text as a single text block and attaches mapped citations (fixture 03 — no match)', () => {
    const result = toAnswer(
      "I'm sorry, I don't have any information to answer that question, but I could help with something else.",
      [],
    );

    expect(result).toEqual({
      blocks: [
        {
          kind: 'text',
          markdown:
            "I'm sorry, I don't have any information to answer that question, but I could help with something else.",
        },
      ],
      citations: [],
    });
  });
});

describe('toInteraction', () => {
  it('maps a listInteractions item to the domain Interaction (fixture 04)', () => {
    const wire = {
      id: '{interactionId}',
      request: 'What changed in the Q3 policy?',
      response:
        "I'm sorry, I don't have any information to answer that question, but I could help with something else.",
      createdAt: '2026-09-02T00:28:45Z',
      updatedAt: '2026-09-02T00:28:45Z',
      sources: [] as never[],
      ownerId: '{ownerId}',
      threadId: '{threadId}',
    };

    const result = toInteraction(wire);

    expect(result).toEqual({
      id: '{interactionId}',
      threadId: '{threadId}',
      question: 'What changed in the Q3 policy?',
      createdAt: '2026-09-02T00:28:45Z',
      answer: {
        blocks: [
          {
            kind: 'text',
            markdown:
              "I'm sorry, I don't have any information to answer that question, but I could help with something else.",
          },
        ],
        citations: [],
      },
    });
  });
});

// Shapes observed against the live tenant, absent from the ticket-01 fixtures: that pass captured
// `sources: []` from the interactions endpoint because the Knowledge Base was still empty.
describe('toCitations — chunks that arrive without their text', () => {
  const sourceWith = (chunks: unknown[]) =>
    [
      {
        knowledgebaseId: '{knowledgeBaseId}',
        datasourceId: '{datasourceId}',
        documentId: '{documentId}',
        source: '{documentName}',
        chunks,
      },
    ] as Parameters<typeof toCitations>[0];

  it('still produces the citation when GET /interactions returns a chunk with no text', () => {
    const result = toCitations(sourceWith([{ chunkId: '{chunkId1}' }]));

    expect(result).toEqual([
      {
        documentId: '{documentId}',
        knowledgeBaseId: '{knowledgeBaseId}',
        documentPath: '{documentName}',
        excerpts: [],
      },
    ]);
  });

  it('keeps the chunks that do have text and drops only the ones that do not', () => {
    const result = toCitations(
      sourceWith([{ chunkId: '{chunkId1}', text: 'paragraph one' }, { chunkId: '{chunkId2}' }]),
    );

    expect(result[0].excerpts).toEqual(['paragraph one']);
  });

  it('survives a source with no chunks array at all, rather than taking down the whole thread view', () => {
    const result = toCitations([
      { knowledgebaseId: 'kb', datasourceId: 'ds', documentId: 'doc', source: 'Doc.pdf' },
    ] as Parameters<typeof toCitations>[0]);

    expect(result[0].excerpts).toEqual([]);
  });
});

describe('toAnalyticsApp', () => {
  // Shape from the published Items API (qlik.dev/apis/rest/items), sanitised. Not yet captured from
  // the real tenant — ticket 18 had no sign-in to capture one with.
  const wire = {
    id: 'item-id-1',
    name: 'Sales overview',
    resourceType: 'app',
    resourceId: 'app-id-1',
    ownerId: 'owner-1',
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-30T08:00:00Z',
  };

  it('uses the resourceId as the Analytics App identifier, never the Items record id', () => {
    expect(toAnalyticsApp(wire).id).toBe('app-id-1');
  });

  it('keeps only the name, the update time and whether a thumbnail exists', () => {
    expect(toAnalyticsApp(wire)).toEqual({
      id: 'app-id-1',
      name: 'Sales overview',
      updatedAt: '2026-09-30T08:00:00Z',
      hasThumbnail: false,
    });
  });

  it('reports a thumbnail only when Items carries a non-empty thumbnailId', () => {
    expect(toAnalyticsApp({ ...wire, thumbnailId: 'thumb-1' }).hasThumbnail).toBe(true);
    expect(toAnalyticsApp({ ...wire, thumbnailId: '' }).hasThumbnail).toBe(false);
  });
});
