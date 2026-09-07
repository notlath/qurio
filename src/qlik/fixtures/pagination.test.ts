import { paginate } from './pagination';

describe('paginate', () => {
  it('returns the first page and a cursor for the next one when more items remain', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    const result = paginate(items, { limit: 2 });

    expect(result.items).toEqual(['a', 'b']);
    expect(result.next).toBeDefined();
  });

  it('uses a cursor from a previous page to continue from where it left off', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const firstPage = paginate(items, { limit: 2 });

    const secondPage = paginate(items, { limit: 2, cursor: firstPage.next });

    expect(secondPage.items).toEqual(['c', 'd']);
    expect(secondPage.next).toBeDefined();
  });

  it('returns no cursor once the last page is reached', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];

    const lastPage = paginate(items, { limit: 2, cursor: '4' });

    expect(lastPage.items).toEqual(['e']);
    expect(lastPage.next).toBeUndefined();
  });

  it('defaults to returning everything when no options are given', () => {
    const items = ['a', 'b', 'c'];

    const result = paginate(items);

    expect(result).toEqual({ items: ['a', 'b', 'c'], next: undefined });
  });
});
