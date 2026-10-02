import { shouldBeLocked } from './biometric-gate';

describe('shouldBeLocked', () => {
  it('locks on cold start, regardless of timeout', () => {
    const result = shouldBeLocked({ kind: 'cold-start' });

    expect(result).toBe(true);
  });

  it('does not lock on foreground when backgrounded for less than the configured timeout', () => {
    const result = shouldBeLocked({ kind: 'foreground', backgroundedAt: 0, now: 30_000, timeoutMs: 60_000 });

    expect(result).toBe(false);
  });

  it('locks on foreground once backgrounded for at least the configured timeout', () => {
    const result = shouldBeLocked({ kind: 'foreground', backgroundedAt: 0, now: 60_000, timeoutMs: 60_000 });

    expect(result).toBe(true);
  });

  it('locks on foreground when backgrounded well past the configured timeout', () => {
    const result = shouldBeLocked({ kind: 'foreground', backgroundedAt: 0, now: 120_000, timeoutMs: 60_000 });

    expect(result).toBe(true);
  });
});
