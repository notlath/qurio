/**
 * The gate's lock/unlock decision, kept separate from the real
 * `expo-local-authentication` prompt so it's testable without biometric
 * hardware. Runs on cold start and whenever the app has been backgrounded
 * longer than `TenantConfig.biometricTimeoutMs` (ticket 12).
 */
export type LockCheck =
  | { kind: 'cold-start' }
  | { kind: 'foreground'; backgroundedAt: number; now: number; timeoutMs: number };

export function shouldBeLocked(check: LockCheck): boolean {
  if (check.kind === 'cold-start') return true;
  return check.now - check.backgroundedAt >= check.timeoutMs;
}
