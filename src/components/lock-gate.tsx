import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus, Platform, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shape, Spacing } from '@/constants/theme';
import { shouldBeLocked } from '@/auth/biometric-gate';
import { resolveCurrentTenantConfig } from '@/config';

// Used only when MDM hasn't set TenantConfig.biometricTimeoutMs — the config always wins.
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const PRIVACY_LOCK_KEY = 'qlik.privacyLockEnabled';

type PrivacyLock = {
  enabled: boolean;
  saving: boolean;
  saveError: string | null;
  setEnabled(enabled: boolean): Promise<void>;
};

const PrivacyLockContext = createContext<PrivacyLock | null>(null);

export function usePrivacyLock(): PrivacyLock {
  const context = useContext(PrivacyLockContext);
  if (!context) throw new Error('usePrivacyLock must be used inside LockGate.');
  return context;
}

/**
 * Cold start and backgrounded-past-timeout both lock the UI (ticket 12). Failing or dismissing
 * the prompt just leaves `locked` true — this component never imports src/auth/tokens.ts, so it
 * cannot sign the user out or touch the stored refresh token even by accident.
 *
 * Native-only: expo-local-authentication has no web implementation, and ADR-0005 already treats
 * the web build as development-only, not the real security boundary.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(true);
  const [loaded, setLoaded] = useState(Platform.OS === 'web');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locked, setLocked] = useState(() => Platform.OS !== 'web' && shouldBeLocked({ kind: 'cold-start' }));
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timeoutMsRef = useRef(DEFAULT_TIMEOUT_MS);
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    AsyncStorage.getItem(PRIVACY_LOCK_KEY).then(
      (value) => {
        setEnabled(value !== 'false');
        setLoaded(true);
      },
      () => setLoaded(true), // Keep the lock enabled when the preference cannot be read.
    );
  }, []);

  async function saveEnabled(value: boolean): Promise<void> {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await AsyncStorage.setItem(PRIVACY_LOCK_KEY, String(value));
      backgroundedAtRef.current = null;
      setLocked(false); // Changing the setting applies to the next entry, not the open Settings screen.
      setEnabled(value);
    } catch {
      setSaveError('Could not save privacy lock. Try again.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    resolveCurrentTenantConfig().then((config) => {
      if (config?.biometricTimeoutMs) timeoutMsRef.current = config.biometricTimeoutMs;
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !enabled) return;
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
  }, [enabled]);

  async function handleUnlock() {
    setError(null);
    setAuthenticating(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Qurio' });
      if (result.success) setLocked(false);
      else setError('Authentication failed. Try again.');
    } finally {
      setAuthenticating(false);
    }
  }

  // Resolve the saved preference before showing either the lock screen or workspace content.
  if (!loaded) return null;
  if (!enabled || !locked) {
    return (
      <PrivacyLockContext value={{ enabled, saving, saveError, setEnabled: saveEnabled }}>
        {children}
      </PrivacyLockContext>
    );
  }

  return (
    <ThemedView style={styles.overlay}>
      <ThemedView type="backgroundSelected" style={[styles.mark, Shape.continuous]}>
        <Icon ios="lock.fill" android="lock" size={28} color="primary" />
      </ThemedView>
      <ThemedText type="subtitle" style={styles.centered}>
        Your workspace is locked.
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={[styles.copy, styles.centered]}>
        Use your device credential to return to Qurio.
      </ThemedText>
      {error && (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite" selectable style={styles.centered}>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  mark: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.card },
  centered: { textAlign: 'center' },
  copy: { maxWidth: 300 },
  unlockButton: { maxWidth: 320, width: '100%', marginTop: Spacing.two },
});
