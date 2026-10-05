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

describe('listAnalyticsApps', () => {
  const TENANT = 'https://acme.eu.qlikcloud.com';
  // Items shape from the published API (qlik.dev/apis/rest/items), sanitised and not yet captured live.
  const wireItem = (n: number) => ({
    id: `item-${n}`,
    name: `App ${n}`,
    resourceType: 'app',
    resourceId: `app-${n}`,
    updatedAt: `2026-09-${String(30 - n).padStart(2, '0')}T08:00:00Z`,
  });

  it('asks Items for apps, most recently updated first, as the signed-in user', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireItem(1)] }));

    await portWith(fetch).listAnalyticsApps();

    expect(fetch).toHaveBeenCalledWith(
      `${TENANT}/api/v1/items?resourceType=app&sort=-updatedAt&limit=50`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer access-1' }),
      }),
    );
  });

  it('does not filter by space, favourite or search term', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    await portWith(fetch).listAnalyticsApps();

    const url: string = fetch.mock.calls[0][0];
    expect(url).not.toMatch(/spaceId|collectionId|name=|query=/);
  });

  it('maps each item to a domain Analytics App keyed by resourceId', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireItem(1), wireItem(2)] }));

    const page = await portWith(fetch).listAnalyticsApps();

    expect(page.items).toEqual([
      { id: 'app-1', name: 'App 1', updatedAt: '2026-09-29T08:00:00Z', hasThumbnail: false },
      { id: 'app-2', name: 'App 2', updatedAt: '2026-09-28T08:00:00Z', hasThumbnail: false },
    ]);
    expect(page.next).toBeUndefined();
  });

  it('reaches every page by following Qlik own next href, keeping the order across pages', async () => {
    const next = `${TENANT}/api/v1/items?resourceType=app&sort=-updatedAt&limit=50&next=cursor-2`;
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [wireItem(1)], links: { next: { href: next } } }))
      .mockResolvedValueOnce(jsonResponse({ data: [wireItem(2)] }));
    const port = portWith(fetch);

    const first = await port.listAnalyticsApps();
    const second = await port.listAnalyticsApps({ cursor: first.next });

    expect(first.next).toBe(next);
    expect(fetch).toHaveBeenLastCalledWith(next, expect.anything());
    expect([...first.items, ...second.items].map((app) => app.id)).toEqual(['app-1', 'app-2']);
    expect(second.next).toBeUndefined();
  });

  it('never sends the bearer token to a next href outside the tenant', async () => {
    const fetch = jest.fn();

    await expect(
      portWith(fetch).listAnalyticsApps({ cursor: 'https://evil.example.com/api/v1/items?next=x' }),
    ).rejects.toEqual({ kind: 'ServiceUnavailable' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns an empty page for a user with no apps, not an error', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    await expect(portWith(fetch).listAnalyticsApps()).resolves.toEqual({ items: [], next: undefined });
  });

  it('reports denied access as AccessDenied, never as a missing Answers entitlement', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({}, 403));

    await expect(portWith(fetch).listAnalyticsApps()).rejects.toEqual({ kind: 'AccessDenied' });
  });

  it('reports an expired session, rate limiting and an outage like every other call', async () => {
    await expect(portWith(jest.fn().mockResolvedValue(jsonResponse({}, 401))).listAnalyticsApps()).rejects.toEqual({
      kind: 'SessionExpired',
    });
    await expect(portWith(jest.fn().mockResolvedValue(jsonResponse({}, 429))).listAnalyticsApps()).rejects.toMatchObject({
      kind: 'RateLimited',
    });
    await expect(portWith(jest.fn().mockResolvedValue(jsonResponse({}, 503))).listAnalyticsApps()).rejects.toEqual({
      kind: 'ServiceUnavailable',
    });
  });

  it('reports a network failure as Offline', async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(portWith(fetch).listAnalyticsApps()).rejects.toEqual({ kind: 'Offline' });
  });
});

describe('listAssistants', () => {
  const TENANT = 'https://acme.eu.qlikcloud.com';
  // Shape captured live from GET /api/v1/assistants on mtcteam.ap (2026-10-05), trimmed to what is mapped plus noise.
  const wireAssistant = (n: number, description = '') => ({
    id: `assistant-${n}`,
    name: `Assistant ${n}`,
    title: '',
    description,
    tags: [],
    knowledgeBases: ['kb-1'],
    legacy: true,
  });

  it('lists the Assistants the signed-in user can see, as domain values only', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ data: [wireAssistant(1, 'Pricing questions'), wireAssistant(2)] }));

    await expect(portWith(fetch).listAssistants()).resolves.toEqual([
      { id: 'assistant-1', name: 'Assistant 1', description: 'Pricing questions', kind: 'classic' },
      { id: 'assistant-2', name: 'Assistant 2', description: '', kind: 'classic' },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      `${TENANT}/api/v1/assistants?limit=100`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer access-1' }) }),
    );
  });

  it('follows every next href, so no Assistant is missed', async () => {
    const next = `${TENANT}/api/v1/assistants?limit=100&next=cursor-2`;
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [wireAssistant(1)], links: { next: { href: next } } }))
      .mockResolvedValueOnce(jsonResponse({ data: [wireAssistant(2)] }));

    const assistants = await portWith(fetch).listAssistants();

    expect(assistants.map((a) => a.id)).toEqual(['assistant-1', 'assistant-2']);
    expect(fetch).toHaveBeenLastCalledWith(next, expect.anything());
  });

  it('works before an Assistant is chosen', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [wireAssistant(1)] }));
    const { assistantId: _, ...hostnameOnly } = config;

    const port = createAnswersPort(hostnameOnly, { fetch, getToken: async () => 'access-1' });

    await expect(port.listAssistants()).resolves.toHaveLength(1);
  });

  it.each([
    [401, { kind: 'SessionExpired' }],
    [403, { kind: 'NotEntitled' }],
    [503, { kind: 'ServiceUnavailable' }],
  ])('maps HTTP %i to a curated domain error, as the Assistant calls do', async (status, expected) => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({}, status));

    await expect(portWith(fetch).listAssistants()).rejects.toEqual(expected);
  });

  it('reports a network failure as Offline', async () => {
    const fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

    await expect(portWith(fetch).listAssistants()).rejects.toEqual({ kind: 'Offline' });
  });
});

describe('before an Assistant is chosen', () => {
  const { assistantId: _, ...hostnameOnly } = config;
  const hostnamePort = (fetch: jest.Mock) => createAnswersPort(hostnameOnly, { fetch, getToken: async () => 'access-1' });

  it('fails every Assistant call with AssistantNotChosen, without a request', async () => {
    const fetch = jest.fn();
    const port = hostnamePort(fetch);

    await expect(port.listThreads()).rejects.toEqual({ kind: 'AssistantNotChosen' });
    await expect(port.createThread('New')).rejects.toEqual({ kind: 'AssistantNotChosen' });
    await expect(port.ask('thread-1', 'Q?', { onDelta: () => {} })).rejects.toEqual({ kind: 'AssistantNotChosen' });
    await expect(port.listStarters()).rejects.toEqual({ kind: 'AssistantNotChosen' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('still lists Analytics Apps, so the app is useful right after sign-in', async () => {
    const fetch = jest.fn().mockResolvedValue(jsonResponse({ data: [] }));

    await expect(hostnamePort(fetch).listAnalyticsApps()).resolves.toEqual({ items: [], next: undefined });
  });
});

describe('thumbnailImage', () => {
  it('addresses the app media endpoint on the Tenant, with the current bearer token', async () => {
    const image = await portWith(jest.fn()).thumbnailImage('app-1');

    expect(image).toEqual({
      uri: 'https://acme.eu.qlikcloud.com/api/v1/apps/app-1/media/thumbnail',
      headers: { Authorization: 'Bearer access-1' },
    });
  });

  it('cannot be steered off the app media path by the app id', async () => {
    const image = await portWith(jest.fn()).thumbnailImage('../../users/me');

    expect(image?.uri).toBe('https://acme.eu.qlikcloud.com/api/v1/apps/..%2F..%2Fusers%2Fme/media/thumbnail');
  });

  it('has no image to offer without a session', async () => {
    const port = createAnswersPort(config, { fetch: jest.fn(), getToken: async () => null });

    expect(await port.thumbnailImage('app-1')).toBeNull();
  });
});
