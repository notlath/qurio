/**
 * Fixture stand-in for Qlik's cursor-based pagination (`GET threads` supports
 * `limit`, `next`/`prev` cursors — technical-proposal.md §2.1). The cursor is
 * just an opaque offset here; real cursors are opaque tokens too, so nothing
 * above this module should parse or construct one itself.
 */
export function paginate<T>(items: T[], opts?: { limit?: number; cursor?: string }): { items: T[]; next?: string } {
  const limit = opts?.limit ?? items.length;
  const start = opts?.cursor ? Number(opts.cursor) : 0;
  const page = items.slice(start, start + limit);
  const nextStart = start + limit;
  const next = nextStart < items.length ? String(nextStart) : undefined;
  return { items: page, next };
}
