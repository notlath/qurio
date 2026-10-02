import { formatRelativeTime } from './relative-time';

const NOW = Date.parse('2026-09-07T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe('formatRelativeTime', () => {
  it('reads as "Just now" under a minute', () => {
    expect(formatRelativeTime(ago(30_000), NOW)).toBe('Just now');
  });

  it('counts whole minutes, then whole hours, then whole days', () => {
    expect(formatRelativeTime(ago(5 * 60_000), NOW)).toBe('5m ago');
    expect(formatRelativeTime(ago(3 * 60 * 60_000), NOW)).toBe('3h ago');
    expect(formatRelativeTime(ago(2 * 24 * 60 * 60_000), NOW)).toBe('2d ago');
  });

  it('rounds down rather than up, so nothing reads as further in the past than it is', () => {
    expect(formatRelativeTime(ago(119 * 60_000), NOW)).toBe('1h ago');
  });

  it('switches to a date past a week — "43d ago" is not something anyone converts back', () => {
    expect(formatRelativeTime(ago(43 * 24 * 60 * 60_000), NOW)).toMatch(/2026/);
  });

  it('renders nothing rather than "NaN" for an unparseable timestamp', () => {
    expect(formatRelativeTime('not a date', NOW)).toBe('');
  });
});
