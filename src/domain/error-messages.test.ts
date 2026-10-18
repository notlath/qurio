import type { AppError } from './errors';
import { errorMessageFor } from './error-messages';

describe('errorMessageFor', () => {
  it('gives ConfigMissing an actionable, non-retryable message naming who to contact', () => {
    const result = errorMessageFor({ kind: 'ConfigMissing' });

    expect(result.canRetry).toBe(false);
    expect(result.message.toLowerCase()).toContain('administrator');
  });

  it('gives NotEntitled a non-retryable message naming who to contact', () => {
    const result = errorMessageFor({ kind: 'NotEntitled' });

    expect(result.canRetry).toBe(false);
    expect(result.message.toLowerCase()).toContain('administrator');
  });

  it('gives AssistantForbidden a non-retryable message naming who to contact', () => {
    const result = errorMessageFor({ kind: 'AssistantForbidden' });

    expect(result.canRetry).toBe(false);
    expect(result.message.toLowerCase()).toContain('administrator');
  });

  it('gives AccessDenied a non-retryable message that names Analytics Apps and who to contact, not Answers', () => {
    const result = errorMessageFor({ kind: 'AccessDenied' });

    expect(result.canRetry).toBe(false);
    expect(result.message.toLowerCase()).toContain('administrator');
    expect(result.message.toLowerCase()).not.toContain('answers');
    expect(result.message.toLowerCase()).not.toContain('assistant');
  });

  it('gives AssistantNotFound a non-retryable message naming who to contact', () => {
    const result = errorMessageFor({ kind: 'AssistantNotFound' });

    expect(result.canRetry).toBe(false);
    expect(result.message.toLowerCase()).toContain('administrator');
  });

  it('gives SessionExpired a retryable message (re-authentication)', () => {
    const result = errorMessageFor({ kind: 'SessionExpired' });

    expect(result.canRetry).toBe(true);
  });

  it('gives RateLimited a retryable, busy-not-broken message', () => {
    const result = errorMessageFor({ kind: 'RateLimited', retryAfterMs: 30_000 });

    expect(result.canRetry).toBe(true);
    expect(result.message.toLowerCase()).not.toContain('administrator');
  });

  it('gives ServiceUnavailable a retryable message', () => {
    const result = errorMessageFor({ kind: 'ServiceUnavailable' });

    expect(result.canRetry).toBe(true);
  });

  it('gives Offline a retryable message distinct from ServiceUnavailable', () => {
    const offline = errorMessageFor({ kind: 'Offline' });
    const serviceUnavailable = errorMessageFor({ kind: 'ServiceUnavailable' });

    expect(offline.canRetry).toBe(true);
    expect(offline.message).not.toBe(serviceUnavailable.message);
  });

  it('gives AssistantNotChosen a non-retryable message that tells the user to choose an Assistant', () => {
    const result = errorMessageFor({ kind: 'AssistantNotChosen' });

    expect(result.canRetry).toBe(false);
    expect(result.message).toContain('Choose an Assistant');
  });

  it('never includes raw error identifiers — every message is one of a fixed, curated set', () => {
    const allKinds: AppError[] = [
      { kind: 'TenantApprovalRequired' },
      { kind: 'ConfigMissing' },
      { kind: 'AssistantNotChosen' },
      { kind: 'NotEntitled' },
      { kind: 'AssistantForbidden' },
      { kind: 'AssistantNotFound' },
      { kind: 'SessionExpired' },
      { kind: 'RateLimited', retryAfterMs: 1000 },
      { kind: 'ServiceUnavailable' },
      { kind: 'Offline' },
    ];

    for (const error of allKinds) {
      const result = errorMessageFor(error);
      expect(result.title.length).toBeGreaterThan(0);
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});
