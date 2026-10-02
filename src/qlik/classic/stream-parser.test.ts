import { takeObjects } from './stream-parser';

describe('takeObjects', () => {
  it('splits concatenated objects with no delimiter (fixture 05)', () => {
    const buf =
      '{"output": "I\'m sorry, I don\'t have any information to answer that question, but I could help with something else."}{"sources": []}';

    const { objects, rest } = takeObjects(buf);

    expect(objects).toEqual([
      '{"output": "I\'m sorry, I don\'t have any information to answer that question, but I could help with something else."}',
      '{"sources": []}',
    ]);
    expect(rest).toBe('');
  });

  it('carries an object split across two reads in `rest` until the next call completes it', () => {
    const firstRead = takeObjects('{"output": "hel');
    expect(firstRead.objects).toEqual([]);
    expect(firstRead.rest).toBe('{"output": "hel');

    const secondRead = takeObjects(firstRead.rest + 'lo"}{"sources": []}');

    expect(secondRead.objects).toEqual(['{"output": "hello"}', '{"sources": []}']);
    expect(secondRead.rest).toBe('');
  });

  it('does not treat a literal `}{` inside answer text as an object boundary', () => {
    const buf = '{"output": "the set is }{ in this notation"}{"sources": []}';

    const { objects, rest } = takeObjects(buf);

    expect(objects).toEqual(['{"output": "the set is }{ in this notation"}', '{"sources": []}']);
    expect(rest).toBe('');
  });

  it('leaves a truncated tail in `rest`, not as a parsed object', () => {
    const buf = '{"output": "complete"}{"output": "cut off mid-ob';

    const { objects, rest } = takeObjects(buf);

    expect(objects).toEqual(['{"output": "complete"}']);
    expect(rest).toBe('{"output": "cut off mid-ob');
  });

  it('parses a real-scale stream — 91 objects, same shape as fixture 10', () => {
    // fixture 10: 87 small `output` fragments, then title / generated_from_placeholder /
    // links_placeholder, then `sources` (with 3 chunks) strictly last — 91 objects total.
    const outputFragments = Array.from({ length: 87 }, (_, i) => `{"output": " word${i}"}`);
    const metadata = [
      '{"title": "A title"}',
      '{"generated_from_placeholder": "Generated from doc.pdf"}',
      '{"links_placeholder": "Link to help articles"}',
    ];
    const sources = '{"sources": [{"chunks": [{"chunkId": "c1"}, {"chunkId": "c2"}, {"chunkId": "c3"}]}]}';
    const buf = [...outputFragments, ...metadata, sources].join('');

    const { objects, rest } = takeObjects(buf);

    expect(objects).toHaveLength(91);
    expect(objects[86]).toBe('{"output": " word86"}');
    expect(objects[87]).toBe('{"title": "A title"}');
    expect(objects[90]).toBe(sources);
    expect(rest).toBe('');
  });
});
