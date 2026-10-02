import { computeExpiresAtMs, needsRefresh } from './token-expiry';

describe('computeExpiresAtMs', () => {
  it('prefers expires_at when present', () => {
    const result = computeExpiresAtMs({ expiresAt: '2026-09-02T06:00:00.000Z', expiresIn: 21600 }, 0);

    expect(result).toBe(Date.parse('2026-09-02T06:00:00.000Z'));
  });

  it('falls back to expires_in seconds from now when expires_at is absent', () => {
    const result = computeExpiresAtMs({ expiresIn: 21600 }, 1_000_000);

    expect(result).toBe(1_000_000 + 21600 * 1000);
  });

  it('returns null when neither field is present', () => {
    const result = computeExpiresAtMs({}, 1_000_000);

    expect(result).toBeNull();
  });

  it('returns null when expires_at is present but unparseable', () => {
    const result = computeExpiresAtMs({ expiresAt: 'not-a-date' }, 1_000_000);

    expect(result).toBeNull();
  });
});

describe('needsRefresh', () => {
  it('is false well before expiry', () => {
    const result = needsRefresh(1_000_000, /* now */ 0);

    expect(result).toBe(false);
  });

  it('is true once within the refresh margin of expiry', () => {
    const result = needsRefresh(1_000_000, /* now */ 999_500);

    expect(result).toBe(true);
  });

  it('is true once past expiry', () => {
    const result = needsRefresh(1_000_000, /* now */ 1_000_001);

    expect(result).toBe(true);
  });

  it('is true when expiry is unknown — never assumed permanently fresh', () => {
    const result = needsRefresh(null, /* now */ 0);

    expect(result).toBe(true);
  });
});
