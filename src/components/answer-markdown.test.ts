import { hasWideBlock, parseAnswerMarkdown } from './answer-markdown';

// Sanitised examples below are copied from docs/poc-tickets/fixtures/10-answer-rendering-subset/CATALOGUE.md
// — real markdown syntax as captured from the tenant, invented placeholder prose (the source is a
// copyrighted book, never reproduced).

describe('parseAnswerMarkdown', () => {
  it('parses plain text with no markdown as a single paragraph', () => {
    const result = parseAnswerMarkdown('Just a plain sentence with no formatting.');

    expect(result).toEqual([
      { kind: 'paragraph', spans: [{ text: 'Just a plain sentence with no formatting.' }] },
    ]);
  });

  it('splits multi-paragraph prose on blank lines (organic — every answer)', () => {
    const result = parseAnswerMarkdown(
      'I don\'t see any specific formulas in the excerpts I have access to.\n\nThe book focuses on concepts.',
    );

    expect(result).toEqual([
      { kind: 'paragraph', spans: [{ text: "I don't see any specific formulas in the excerpts I have access to." }] },
      { kind: 'paragraph', spans: [{ text: 'The book focuses on concepts.' }] },
    ]);
  });

  it('parses consecutive numbered lines as separate list items (organic, e.g. resp_10)', () => {
    const result = parseAnswerMarkdown('1. First step\n2. Second step\n3. Third step');

    expect(result).toEqual([
      { kind: 'numberedListItem', spans: [{ text: 'First step' }] },
      { kind: 'numberedListItem', spans: [{ text: 'Second step' }] },
      { kind: 'numberedListItem', spans: [{ text: 'Third step' }] },
    ]);
  });

  it('parses consecutive bulleted lines (organic marker: •) as separate list items', () => {
    const result = parseAnswerMarkdown('• Small choices compound over time\n• Track key behaviours');

    expect(result).toEqual([
      { kind: 'bulletListItem', spans: [{ text: 'Small choices compound over time' }] },
      { kind: 'bulletListItem', spans: [{ text: 'Track key behaviours' }] },
    ]);
  });

  it('parses consecutive bulleted lines using the steered marker (-) the same way', () => {
    const result = parseAnswerMarkdown('- Point one\n- Point two');

    expect(result).toEqual([
      { kind: 'bulletListItem', spans: [{ text: 'Point one' }] },
      { kind: 'bulletListItem', spans: [{ text: 'Point two' }] },
    ]);
  });

  it('parses #/##/### lines as headings with the matching level (steered — never seen organically)', () => {
    const result = parseAnswerMarkdown('# Core Concept\n\n## Key Characteristics\n\n### Note');

    expect(result).toEqual([
      { kind: 'heading', level: 1, spans: [{ text: 'Core Concept' }] },
      { kind: 'heading', level: 2, spans: [{ text: 'Key Characteristics' }] },
      { kind: 'heading', level: 3, spans: [{ text: 'Note' }] },
    ]);
  });

  it('parses **bold** spans within a paragraph (steered)', () => {
    const result = parseAnswerMarkdown('The idea is **reaping large rewards** from small choices.');

    expect(result).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { text: 'The idea is ' },
          { text: 'reaping large rewards', bold: true },
          { text: ' from small choices.' },
        ],
      },
    ]);
  });

  it('parses *italic* spans within a paragraph, distinct from bold (steered)', () => {
    const result = parseAnswerMarkdown('Note that *consistency* matters most.');

    expect(result).toEqual([
      {
        kind: 'paragraph',
        spans: [{ text: 'Note that ' }, { text: 'consistency', italic: true }, { text: ' matters most.' }],
      },
    ]);
  });

  it('parses [text](url) links within a paragraph (steered)', () => {
    const result = parseAnswerMarkdown('See [the resource site](http://example.com) for more.');

    expect(result).toEqual([
      {
        kind: 'paragraph',
        spans: [
          { text: 'See ' },
          { text: 'the resource site', href: 'http://example.com' },
          { text: ' for more.' },
        ],
      },
    ]);
  });

  it('parses a header-separator-rows table into a grid of cells (steered)', () => {
    const result = parseAnswerMarkdown(
      '| Aspect | Description |\n|--------|-------------|\n| **Nature** | Small changes |\n| Timeline | Results appear over time |',
    );

    expect(result).toEqual([
      {
        kind: 'table',
        rows: [
          [[{ text: 'Aspect' }], [{ text: 'Description' }]],
          [[{ text: 'Nature', bold: true }], [{ text: 'Small changes' }]],
          [[{ text: 'Timeline' }], [{ text: 'Results appear over time' }]],
        ],
      },
    ]);
  });

  it('parses a fenced code block as raw code text, with no inline parsing inside it (steered)', () => {
    const result = parseAnswerMarkdown('```\nSmall changes = *large* impact\nStray by 2mm -> big miss\n```');

    expect(result).toEqual([
      { kind: 'code', text: 'Small changes = *large* impact\nStray by 2mm -> big miss' },
    ]);
  });

  it('degrades an unevidenced construct (blockquote) to plain paragraph text, not a crash or hidden content', () => {
    const result = parseAnswerMarkdown('> Some quoted line with no evidenced construct for it');

    expect(result).toEqual([
      { kind: 'paragraph', spans: [{ text: '> Some quoted line with no evidenced construct for it' }] },
    ]);
  });

  it('parses the full steered mixed-construct example from the catalogue without cross-block interference', () => {
    const markdown = [
      '# Core Concept',
      '',
      'The idea is **reaping large rewards** from small choices.',
      '',
      '## Key Characteristics',
      '',
      '| Aspect | Description |',
      '|--------|-------------|',
      '| **Nature** | Small changes, little immediate result |',
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
      'See [the resource site](http://example.com) for more — and note that *consistency* matters most.',
    ].join('\n');

    const result = parseAnswerMarkdown(markdown);

    expect(result.map((b) => b.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'table',
      'bulletListItem',
      'bulletListItem',
      'numberedListItem',
      'numberedListItem',
      'code',
      'paragraph',
    ]);
    expect(result[0]).toMatchObject({ level: 1, spans: [{ text: 'Core Concept' }] });
    expect(result[8]).toEqual({ kind: 'code', text: 'Small trajectory changes = large long-term impact' });
  });

  it('splits an intro line from the list items that follow it in the same chunk (#30)', () => {
    const result = parseAnswerMarkdown(
      'So counting from August:\n- Month 1: August\n- Month 2: September\n- Month 3: October (1st review)',
    );

    expect(result).toEqual([
      { kind: 'paragraph', spans: [{ text: 'So counting from August:' }] },
      { kind: 'bulletListItem', spans: [{ text: 'Month 1: August' }] },
      { kind: 'bulletListItem', spans: [{ text: 'Month 2: September' }] },
      { kind: 'bulletListItem', spans: [{ text: 'Month 3: October (1st review)' }] },
    ]);
  });

  it('keeps text that merely contains " - " as one paragraph (#30)', () => {
    const result = parseAnswerMarkdown('Regularization takes six months - see your contract.\nAsk HR - they confirm.');

    expect(result).toEqual([
      {
        kind: 'paragraph',
        spans: [{ text: 'Regularization takes six months - see your contract. Ask HR - they confirm.' }],
      },
    ]);
  });
  it('parses every prefix of a streaming answer, so a half-arrived marker never crashes or hides text', () => {
    const markdown = [
      '# Title',
      '',
      'Some **bold** and *italic* with a [link](https://example.com).',
      '',
      '1. First',
      '2. Second',
      '',
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '```',
      'code',
      '```',
    ].join('\n');

    for (let end = 1; end <= markdown.length; end++) {
      const prefix = markdown.slice(0, end);
      const text = JSON.stringify(parseAnswerMarkdown(prefix));
      // The newest character always shows somewhere, unless it is markup or whitespace.
      const last = prefix.trim().slice(-1);
      if (/[a-z0-9]/i.test(last)) expect(text).toContain(last);
    }
  });
});

describe('hasWideBlock', () => {
  it('is true for an Answer with a table or a code block, which need the whole column', () => {
    expect(hasWideBlock('Intro\n\n| A | B |\n|---|---|\n| 1 | 2 |')).toBe(true);
    expect(hasWideBlock('```\nconst x = 1;\n```')).toBe(true);
  });

  it('is false for prose, lists and headings', () => {
    expect(hasWideBlock('# Title\n\nSome **bold** text.\n\n- one\n- two')).toBe(false);
  });
});
