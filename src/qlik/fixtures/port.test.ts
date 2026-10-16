import { createFixtureAnswersPort } from './port';

describe('createFixtureAnswersPort', () => {
  it('lists the seeded fixture threads', async () => {
    const port = createFixtureAnswersPort();

    const { items } = await port.listThreads();

    expect(items.length).toBeGreaterThan(0);
    expect(items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('creates a thread and makes it visible via listThreads', async () => {
    const port = createFixtureAnswersPort();
    const before = (await port.listThreads({ limit: 100 })).items.length;

    const created = await port.createThread('New question');

    expect(created).toMatchObject({ id: expect.any(String), name: 'New question' });
    const after = await port.listThreads({ limit: 100 });
    expect(after.items.length).toBe(before + 1);
    expect(after.items.find((t) => t.id === created.id)).toEqual(created);
  });

  it('paginates threads, newest first, with a cursor for the next page', async () => {
    const port = createFixtureAnswersPort();

    const firstPage = await port.listThreads({ limit: 5 });

    expect(firstPage.items).toHaveLength(5);
    expect(firstPage.next).toBeDefined();

    const secondPage = await port.listThreads({ limit: 5, cursor: firstPage.next });

    expect(secondPage.items).toHaveLength(5);
    expect(secondPage.items[0].id).not.toBe(firstPage.items[0].id);
  });

  it('gets a thread with its seeded interactions', async () => {
    const port = createFixtureAnswersPort();

    const detail = await port.getThread('thread-1');

    expect(detail).toMatchObject({ id: 'thread-1', name: 'Q3 policy changes' });
    expect(detail.interactions.length).toBeGreaterThan(0);
    expect(detail.interactions[0]).toMatchObject({
      question: expect.any(String),
      answer: { blocks: expect.any(Array), citations: expect.any(Array) },
    });
  });

  it('rejects getThread for an unknown id', async () => {
    const port = createFixtureAnswersPort();

    await expect(port.getThread('does-not-exist')).rejects.toThrow();
  });

  it('deletes a thread so it no longer appears in listThreads or getThread', async () => {
    const port = createFixtureAnswersPort();
    const created = await port.createThread('Throwaway thread');

    await port.deleteThread(created.id);

    const { items } = await port.listThreads({ limit: 100 });
    expect(items.find((t) => t.id === created.id)).toBeUndefined();
    await expect(port.getThread(created.id)).rejects.toThrow();
  });

  it('renames a thread in memory, so listThreads and getThread show the new name', async () => {
    const port = createFixtureAnswersPort();
    const created = await port.createThread('Old name');

    await port.renameThread(created.id, 'New name');

    const { items } = await port.listThreads({ limit: 100 });
    expect(items.find((t) => t.id === created.id)?.name).toBe('New name');
    expect((await port.getThread(created.id)).name).toBe('New name');
  });

  it('rejects renameThread for an unknown id', async () => {
    await expect(createFixtureAnswersPort().renameThread('does-not-exist', 'New name')).rejects.toThrow();
  });

  it('submits feedback that attaches to the correct interaction, verified by re-fetching', async () => {
    const port = createFixtureAnswersPort();
    const thread = await port.createThread('Feedback thread');
    const first = await port.ask(thread.id, 'First question', { onDelta: () => {} });
    const second = await port.ask(thread.id, 'Second question', { onDelta: () => {} });

    await port.submitFeedback(thread.id, second.id, { vote: -1, reason: 'inaccurate' });

    const interactions = await port.listInteractions(thread.id);
    const updatedFirst = interactions.find((i) => i.id === first.id);
    const updatedSecond = interactions.find((i) => i.id === second.id);
    expect(updatedFirst?.feedback).toBeUndefined();
    expect(updatedSecond?.feedback).toEqual({ vote: -1, reason: 'inaccurate' });
  });

  it('rejects feedback for an unknown interaction id', async () => {
    const port = createFixtureAnswersPort();
    const thread = await port.createThread('Feedback thread');

    await expect(
      port.submitFeedback(thread.id, 'does-not-exist', { vote: 1 }),
    ).rejects.toThrow();
  });

  it('lists the seeded starters', async () => {
    const port = createFixtureAnswersPort();

    const starters = await port.listStarters();

    expect(starters.length).toBeGreaterThan(0);
    expect(starters[0]).toMatchObject({ id: expect.any(String), prompt: expect.any(String) });
  });

  it('answers a question, streaming the text via onDelta and recording the interaction', async () => {
    const port = createFixtureAnswersPort();
    const thread = await port.createThread('New question');
    const deltas: string[] = [];

    const interaction = await port.ask(thread.id, 'What changed?', {
      onDelta: (text) => deltas.push(text),
    });

    expect(deltas.join('')).toBe(interaction.answer.blocks.map((b) => b.markdown).join(''));
    expect(interaction).toMatchObject({ threadId: thread.id, question: 'What changed?' });
    const detail = await port.getThread(thread.id);
    expect(detail.interactions).toContainEqual(interaction);
  });
});

describe('createFixtureAnswersPort — Assistants', () => {
  it('lists a fixed set of Assistants as domain values', async () => {
    const assistants = await createFixtureAnswersPort().listAssistants();

    expect(assistants.length).toBeGreaterThan(1);
    for (const assistant of assistants) {
      expect(assistant).toEqual({ id: expect.any(String), name: expect.any(String), description: expect.any(String), kind: 'classic' });
    }
  });
});

describe('createFixtureAnswersPort — Analytics Apps', () => {
  it('lists Analytics Apps most recently updated first, paged', async () => {
    const port = createFixtureAnswersPort();

    const first = await port.listAnalyticsApps({ limit: 3 });

    expect(first.items).toHaveLength(3);
    expect(first.next).toBeDefined();
    const times = first.items.map((app) => Date.parse(app.updatedAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('reaches every fixture app by following the cursor, without repeats', async () => {
    const port = createFixtureAnswersPort();
    const ids: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await port.listAnalyticsApps({ limit: 4, cursor });
      ids.push(...page.items.map((app) => app.id));
      cursor = page.next;
    } while (cursor);

    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('finds apps by part of the name, ignoring case, across pages', async () => {
    const port = createFixtureAnswersPort();

    const first = await port.listAnalyticsApps({ limit: 1, name: 'R' });
    const second = await port.listAnalyticsApps({ limit: 1, name: 'R', cursor: first.next });

    expect(first.items.every((app) => app.name.toLowerCase().includes('r'))).toBe(true);
    expect(second.items.every((app) => app.name.toLowerCase().includes('r'))).toBe(true);
    expect(second.items[0].id).not.toBe(first.items[0].id);
    await expect(port.listAnalyticsApps({ name: 'no such app' })).resolves.toEqual({ items: [], next: undefined });
  });
});
