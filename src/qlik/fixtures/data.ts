import type { AnalyticsApp, Interaction, Starter, Thread } from '@/domain';

// Names/dates for threads beyond the first two — enough to demo "scrolling loads older pages"
// against real pagination (src/qlik/fixtures/pagination.ts), not just a list that fits on screen.
const olderThreadNames = [
  'Expense report questions',
  'Holiday schedule',
  'Benefits enrollment',
  'IT security training',
  'Parking policy',
  'Remote work guidelines',
  'Performance review cycle',
  'Office relocation FAQ',
  'Travel booking process',
  'Equipment request',
  'New hire paperwork',
  'Team offsite planning',
];

export const fixtureThreads: Thread[] = [
  {
    id: 'thread-1',
    name: 'Q3 policy changes',
    createdAt: '2026-08-20T09:00:00Z',
    updatedAt: '2026-08-20T09:04:00Z',
  },
  {
    id: 'thread-2',
    name: 'Onboarding checklist',
    createdAt: '2026-08-18T14:30:00Z',
    updatedAt: '2026-08-18T14:32:00Z',
  },
  ...olderThreadNames.map((name, i) => {
    const daysAgo = 3 + i * 2;
    const updatedAt = new Date(Date.parse('2026-08-18T14:32:00Z') - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    return { id: `thread-${i + 3}`, name, createdAt: updatedAt, updatedAt };
  }),
];

const analyticsAppNames = [
  'Sales overview',
  'Customer retention',
  'Supply chain monitor',
  'Finance close tracker',
  'HR headcount',
  'Marketing campaigns',
  'Support ticket trends',
  'Inventory forecast',
  'Regional performance',
];

// Newest first, as the real list is ordered — enough to span several pages.
export const fixtureAnalyticsApps: AnalyticsApp[] = analyticsAppNames.map((name, i) => ({
  id: `fixture-app-${i + 1}`,
  name,
  updatedAt: new Date(Date.parse('2026-09-30T08:00:00Z') - i * 3 * 24 * 60 * 60 * 1000).toISOString(),
}));

export const fixtureInteractionsByThreadId: Record<string, Interaction[]> = {
  'thread-1': [
    {
      id: 'interaction-1',
      threadId: 'thread-1',
      question: 'What changed in the Q3 policy?',
      answer: {
        blocks: [{ kind: 'text', markdown: 'Travel approval now requires manager sign-off.' }],
        citations: [
          {
            documentId: 'doc-1',
            knowledgeBaseId: 'kb-1',
            documentPath: 'Q3-Handbook.pdf',
            excerpts: ['Travel approval now requires manager sign-off.'],
          },
        ],
      },
      createdAt: '2026-08-20T09:04:00Z',
    },
  ],
  'thread-2': [
    {
      id: 'interaction-2',
      threadId: 'thread-2',
      question: 'What does the onboarding checklist cover?',
      answer: {
        blocks: [
          { kind: 'text', markdown: 'Badge setup, benefits enrollment, and a 30-minute IT orientation.' },
        ],
        citations: [],
      },
      createdAt: '2026-08-18T14:32:00Z',
    },
  ],
};

export const fixtureStarters: Starter[] = [
  { id: 'starter-1', prompt: 'What changed in the Q3 policy?' },
  { id: 'starter-2', prompt: 'Summarize the onboarding checklist' },
];

const noMatchAnswer = {
  blocks: [
    {
      kind: 'text' as const,
      markdown: "I'm sorry, I don't have any information to answer that question yet — this is fixture data.",
    },
  ],
  citations: [],
};

// Demonstrates every construct evidenced in ticket 10's corpus (real markdown syntax, invented
// placeholder prose — see docs/poc-tickets/fixtures/10-answer-rendering-subset/CATALOGUE.md).
const markdownDemoAnswer = {
  blocks: [
    {
      kind: 'text' as const,
      markdown: [
        '# Core Concept',
        '',
        'The idea is **reaping large rewards** from small choices.',
        '',
        '## Key Characteristics',
        '',
        '| Aspect | Description |',
        '|--------|-------------|',
        '| **Nature** | Small changes, little immediate result |',
        '| Timeline | Results appear after consistent application |',
        '',
        '- **Point one**: explanation',
        '- **Point two**: explanation',
        '',
        '1. First step',
        '2. Second step',
        '',
        '```',
        'Small trajectory changes = large long-term impact',
        '```',
        '',
        'See [the resource site](https://example.com) for more — and note that *consistency* matters most.',
      ].join('\n'),
    },
  ],
  citations: [],
};

/**
 * Mimics real KB retrieval well enough to demo citation rendering against
 * fixture data: a question matching the seeded document returns it with
 * an excerpt; anything else gets the "no information" answer, same as a
 * real question with no Knowledge Base match (ticket-01 fixture 03).
 */
export function fixtureAnswerFor(prompt: string) {
  if (/markdown|formatting/i.test(prompt)) {
    return markdownDemoAnswer;
  }
  if (/q3|policy|travel/i.test(prompt)) {
    return {
      blocks: [{ kind: 'text' as const, markdown: 'Travel approval now requires manager sign-off.' }],
      citations: [
        {
          documentId: 'doc-1',
          knowledgeBaseId: 'kb-1',
          documentPath: 'Q3-Handbook.pdf',
          excerpts: ['Travel approval now requires manager sign-off.'],
        },
      ],
    };
  }
  return noMatchAnswer;
}
