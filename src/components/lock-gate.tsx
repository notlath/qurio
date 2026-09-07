import * as LocalAuthentication from 'expo-local-authentication';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { shouldBeLocked } from '@/auth/biometric-gate';
import { resolveCurrentTenantConfig } from '@/config';

// Used only when MDM hasn't set TenantConfig.biometricTimeoutMs — the config always wins.
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Cold start and backgrounded-past-timeout both lock the UI (ticket 12). Failing or dismissing
 * the prompt just leaves `locked` true — this component never imports src/auth/tokens.ts, so it
 * cannot sign the user out or touch the stored refresh token even by accident.
 *
 * Native-only: expo-local-authentication has no web implementation, and ADR-0005 already treats
 * the web build as development-only, not the real security boundary.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [locked, setLocked] = useState(() => Platform.OS !== 'web' && shouldBeLocked({ kind: 'cold-start' }));
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutMsRef = useRef(DEFAULT_TIMEOUT_MS);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    resolveCurrentTenantConfig().then((config) => {
      if (config?.biometricTimeoutMs) timeoutMsRef.current = config.biometricTimeoutMs;
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (next === 'active' && backgroundedAtRef.current !== null) {
        const stillLocked = shouldBeLocked({
          kind: 'foreground',
          backgroundedAt: backgroundedAtRef.current,
          now: Date.now(),
          timeoutMs: timeoutMsRef.current,
        });
        if (stillLocked) setLocked(true);
        backgroundedAtRef.current = null;
      }
    });
    return () => subscription.remove();
  }, []);

  async function handleUnlock() {
    setError(null);
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock QlikAnswersApp' });
      if (result.success) setLocked(false);
      else setError('Authentication failed. Try again.');
    } finally {
      setAuthenticating(false);
    }
  }

  if (!locked) return <>{children}</>;

  return (
    <ThemedView style={styles.overlay}>
      <ThemedView type="primary" style={styles.mark}>
        <ThemedText type="subtitle" themeColor="primaryForeground">Q</ThemedText>
      </ThemedView>
      <ThemedText type="title">Your workspace is locked.</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.copy}>Use your device credential to return to Qlik Answers.</ThemedText>
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      <PrimaryButton
        label={authenticating ? 'Unlocking…' : 'Unlock'}
        busy={authenticating}
        onPress={handleUnlock}
        style={styles.unlockButton}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  mark: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.control },
  copy: { maxWidth: 300 },
  unlockButton: { alignSelf: 'flex-start', minWidth: 160 },
});
