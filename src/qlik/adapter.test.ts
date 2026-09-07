import { createAnswersPort } from './adapter';
import type { StreamReader } from './classic/stream-session';

const config = { tenantHost: 'acme.eu.qlikcloud.com', clientId: 'client-1', assistantId: 'assistant-1' };
const BASE = 'https://acme.eu.qlikcloud.com/api/v1/assistants/assistant-1';

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    json: async () => body,
  };
}

function reader(chunks: string[]): StreamReader {
  let i = 0;
  return {
    async read() {
      if (i < chunks.length) return { done: false, value: chunks[i++] };
      return { done: true };
    },
  };
}

/** Mirrors an `expo/fetch` streaming response: body.pipeThrough(decoder).getReader(). */
function streamResponse(chunks: string[]) {
  return { ...jsonResponse({}), body: { pipeThrough: () => ({ getReader: () => reader(chunks) }) } };
}

function portWith(fetch: jest.Mock) {
  return createAnswersPort(config, { fetch, getToken: async () => 'access-1' });
}

// Shapes taken verbatim from docs/poc-tickets/fixtures/01-verify-assistants-api/.
const wireThread = {
  id: 'thread-1',
  ownerId: 'owner-1',
  name: 'POC Ticket 01 verification',
  createdAt: '2026-09-02T00:28:33Z',
  updatedAt: '2026-09-02T00:28:33Z',
};

const wireInteraction = {
  id: 'interaction-1',
  request: 'What changed in the Q3 policy?',
  response: 'Travel approval now requires manager sign-off.',
  createdAt: '2026-09-02T00:28:45Z',
  updatedAt: '2026-09-02T00:28:45Z',
  sources: [
    {
      knowledgebaseId: 'kb-1',
      datasourceId: 'ds-1',
      documentId: 'doc-1',
      source: 'Q3-Handbook.pdf',
      chunks: [{ chunkId: 'chunk-1', text: 'File name: Q3-Handbook.pdf\nTravel approval changed.' }],
    },
  ],
  ownerId: 'owner-1',
  threadId: 'thread-1',
};

describe('createAnswersPort', () => {
  it('declares streaming, which is what separates it from the fixture port', () => {
    expect(portWith(jest.fn()).capabilities).toEqual({ streaming: true, analyticsInsights: false });
  });

  it('lists threads newest-first and exposes the next page as Qlik own href', async () => {
    const next = `${BASE}/threads?next=abc`;
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireThread], links: { next: { href: next } } }));

    const page = await portWith(fetch).listThreads({ limit: 5 });

    expect(fetch).toHaveBeenCalledWith(`${BASE}/threads?sort=-UPDATED&limit=5`, expect.anything());
    expect(page.items).toEqual([
      {
        id: 'thread-1',
        name: 'POC Ticket 01 verification',
        createdAt: wireThread.createdAt,
        updatedAt: wireThread.updatedAt,
      },
    ]);
    expect(page.next).toBe(next);
  });

  it('follows a cursor as an absolute url rather than rebuilding the query', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    await portWith(fetch).listThreads({ cursor: `${BASE}/threads?next=abc` });

    expect(fetch).toHaveBeenCalledWith(`${BASE}/threads?next=abc`, expect.anything());
  });

  it('creates a thread', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(wireThread, 201));

    const thread = await portWith(fetch).createThread('New thread');

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/threads`,
      expect.objectContaining({ method: 'POST', body: '{"name":"New thread"}' }),
    );
    expect(thread.id).toBe('thread-1');
  });

  it('returns interactions oldest-first, so a thread reads top to bottom', async () => {
    const older = { ...wireInteraction, id: 'interaction-0', createdAt: '2026-09-01T00:00:00Z' };
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireInteraction, older] })); // sort=-CREATED

    const interactions = await portWith(fetch).listInteractions('thread-1');

    expect(interactions.map((i) => i.id)).toEqual(['interaction-0', 'interaction-1']);
  });

  it('strips the inconsistent "File name:" chunk prefix when mapping citations (ticket-01 finding 5)', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireInteraction] }));

    const [interaction] = await portWith(fetch).listInteractions('thread-1');

    expect(interaction.answer.citations).toEqual([
      {
        documentId: 'doc-1',
        knowledgeBaseId: 'kb-1',
        documentPath: 'Q3-Handbook.pdf',
        excerpts: ['Travel approval changed.'],
      },
    ]);
  });

  it('gets a thread with its interactions', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(wireThread))
      .mockResolvedValueOnce(jsonResponse({ data: [wireInteraction] }));

    const detail = await portWith(fetch).getThread('thread-1');

    expect(detail.name).toBe('POC Ticket 01 verification');
    expect(detail.interactions.map((i) => i.question)).toEqual(['What changed in the Q3 policy?']);
  });

  it('deletes a thread without trying to parse an empty 204 body', async () => {
    const fetch = jest.fn().mockResolvedValue({
      ...jsonResponse(null, 204),
      json: () => Promise.reject(new Error('no body')),
    });

    await expect(portWith(fetch).deleteThread('thread-1')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(`${BASE}/threads/thread-1`, expect.objectContaining({ method: 'DELETE' }));
  });

  describe('ask', () => {
    it('streams deltas, then recovers the interaction id Qlik never returns in the stream', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce(
          streamResponse(['{"output": "Travel approval "}', '{"output": "changed."}{"sources": []}']),
        )
        .mockResolvedValueOnce(jsonResponse({ data: [{ ...wireInteraction, request: 'What changed?' }] }));
      const deltas: string[] = [];

      const interaction = await portWith(fetch).ask('thread-1', 'What changed?', { onDelta: (d) => deltas.push(d) });

      expect(fetch).toHaveBeenNthCalledWith(
        1,
        `${BASE}/threads/thread-1/actions/stream`,
        expect.objectContaining({
          method: 'POST',
          body: '{"input":{"prompt":"What changed?","promptType":"thread","includeText":true}}',
        }),
      );
      expect(deltas).toEqual(['Travel approval ', 'changed.']);
      expect(interaction.id).toBe('interaction-1');
      expect(interaction.answer.blocks).toEqual([{ kind: 'text', markdown: 'Travel approval changed.' }]);
    });

    it('keeps the streamed text rather than the reconciled response, which is what the user watched arrive', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce(streamResponse(['{"output": "partial"}']))
        .mockResolvedValueOnce(jsonResponse({ data: [{ ...wireInteraction, request: 'What changed?' }] }));

      const interaction = await portWith(fetch).ask('thread-1', 'What changed?', { onDelta: () => {} });

      expect(interaction.answer.blocks).toEqual([{ kind: 'text', markdown: 'partial' }]);
    });

    it('refuses a reconciled id belonging to a different question, rather than misfiling later feedback', async () => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce(streamResponse(['{"output": "answer"}']))
        .mockResolvedValueOnce(jsonResponse({ data: [wireInteraction] })); // an older question

      const interaction = await portWith(fetch).ask('thread-1', 'A different question', { onDelta: () => {} });

      expect(interaction.id).not.toBe('interaction-1');
      expect(interaction.question).toBe('A different question');
    });

    it('a Stop before the first byte returns the empty answer, not an error', async () => {
      const controller = new AbortController();
      const fetch = jest.fn().mockRejectedValue(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      controller.abort();

      const interaction = await portWith(fetch).ask('thread-1', 'What changed?', {
        onDelta: () => {},
        signal: controller.signal,
      });

      expect(interaction.answer.blocks).toEqual([{ kind: 'text', markdown: '' }]);
      expect(fetch).toHaveBeenCalledTimes(1); // no reconciliation round-trip after a stop
    });

    it('propagates a curated error when the ask itself is rejected', async () => {
      const fetch = jest.fn().mockResolvedValue(jsonResponse({}, 429));

      await expect(portWith(fetch).ask('thread-1', 'What changed?', { onDelta: () => {} })).rejects.toEqual({
        kind: 'RateLimited',
        retryAfterMs: 60_000,
      });
    });
  });

  it('submits feedback against the interaction', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse(null, 204));

    await portWith(fetch).submitFeedback('thread-1', 'interaction-1', { vote: 1, reason: 'other' });

    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/threads/thread-1/interactions/interaction-1/feedback`,
      expect.objectContaining({ method: 'POST', body: '{"vote":1,"reason":"other"}' }),
    );
  });

  it('lists starters', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [{ id: 'starter-1', prompt: 'What changed?' }] }));

    await expect(portWith(fetch).listStarters()).resolves.toEqual([{ id: 'starter-1', prompt: 'What changed?' }]);
  });
});
