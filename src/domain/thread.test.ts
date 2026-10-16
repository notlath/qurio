import { threadNameFor } from './thread';

describe('threadNameFor', () => {
  it('uses a short question whole', () => {
    expect(threadNameFor('What were sales last month?')).toBe('What were sales last month?');
  });

  it('collapses whitespace', () => {
    expect(threadNameFor('  What were\n\nsales   last\tmonth?  ')).toBe('What were sales last month?');
  });

  it('cuts a long question at a word boundary and adds an ellipsis', () => {
    const question = 'Which regions had the highest growth in sales compared with the previous quarter last year?';
    expect(threadNameFor(question)).toBe('Which regions had the highest growth in sales compared with…');
  });

  it('keeps a word that ends at the 60th character', () => {
    expect(threadNameFor(`${'a'.repeat(55)} bcde fgh`)).toBe(`${'a'.repeat(55)} bcde…`);
  });

  it('cuts a long word at 60 characters', () => {
    expect(threadNameFor('x'.repeat(70))).toBe(`${'x'.repeat(60)}…`);
  });
});
