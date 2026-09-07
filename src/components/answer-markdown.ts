/**
 * Parses the evidenced subset of what Qlik answers actually contain — see
 * docs/poc-tickets/fixtures/10-answer-rendering-subset/CATALOGUE.md. Deliberately not a general
 * CommonMark/GFM parser: only paragraphs, headings, numbered/bulleted lists, tables, fenced code
 * blocks, and bold/italic/link inline spans are implemented, because those are the only constructs
 * observed across 12 real captured answers (organic and explicitly markdown-steered). Anything else
 * falls through as plain paragraph text — never hidden, never crashes, never shown as a broken
 * half-parsed construct.
 */

export type InlineSpan = { text: string; bold?: boolean; italic?: boolean; href?: string };

export type AnswerRenderBlock =
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'heading'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { kind: 'numberedListItem'; spans: InlineSpan[] }
  | { kind: 'bulletListItem'; spans: InlineSpan[] }
  | { kind: 'table'; rows: InlineSpan[][][] }
  | { kind: 'code'; text: string };

/** Bold, italic, and links, matched left to right — none was ever observed nested inside another. */
const INLINE = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)]+)\)/g;

export function parseInlineSpans(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(INLINE)) {
    if (match.index! > lastIndex) spans.push({ text: text.slice(lastIndex, match.index) });
    const [, bold, italic, linkText, href] = match;
    if (bold !== undefined) spans.push({ text: bold, bold: true });
    else if (italic !== undefined) spans.push({ text: italic, italic: true });
    else spans.push({ text: linkText, href });
    lastIndex = match.index! + match[0].length;
  }
  if (lastIndex < text.length) spans.push({ text: text.slice(lastIndex) });
  return spans;
}

/** Answers are blank-line-separated at the paragraph/list/table/code level (evidenced); within a
 * chunk, list items and table rows are single-newline separated. */
function splitIntoChunks(markdown: string): string[] {
  return markdown
    .split(/\n[ \t]*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

const NUMBERED_ITEM = /^\d+[.)]\s+(.*)$/;
const BULLET_ITEM = /^[•\-]\s+(.*)$/;
const HEADING = /^(#{1,3})\s+(.*)$/;
const TABLE_ROW = /^\|(.+)\|$/;
const TABLE_SEPARATOR = /^\|[\s:|-]+\|$/;

function parseTableRow(line: string): InlineSpan[][] {
  return line
    .slice(1, -1)
    .split('|')
    .map((cell) => parseInlineSpans(cell.trim()));
}

function chunkToBlocks(chunk: string): AnswerRenderBlock[] {
  if (chunk.startsWith('```') && chunk.endsWith('```')) {
    return [{ kind: 'code', text: chunk.slice(3, -3).replace(/^\n/, '').replace(/\n$/, '') }];
  }

  const lines = chunk
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 1) {
    const heading = lines[0].match(HEADING);
    if (heading) {
      return [{ kind: 'heading', level: heading[1].length as 1 | 2 | 3, spans: parseInlineSpans(heading[2]) }];
    }
  }

  if (lines.length >= 2 && lines.every((l) => TABLE_ROW.test(l))) {
    const dataRows = lines.filter((l) => !TABLE_SEPARATOR.test(l));
    return [{ kind: 'table', rows: dataRows.map(parseTableRow) }];
  }

  if (lines.every((l) => NUMBERED_ITEM.test(l))) {
    return lines.map((l) => ({
      kind: 'numberedListItem',
      spans: parseInlineSpans(l.match(NUMBERED_ITEM)![1]),
    }));
  }

  if (lines.every((l) => BULLET_ITEM.test(l))) {
    return lines.map((l) => ({
      kind: 'bulletListItem',
      spans: parseInlineSpans(l.match(BULLET_ITEM)![1]),
    }));
  }

  return [{ kind: 'paragraph', spans: parseInlineSpans(lines.join(' ')) }];
}

export function parseAnswerMarkdown(markdown: string): AnswerRenderBlock[] {
  return splitIntoChunks(markdown).flatMap(chunkToBlocks);
}
