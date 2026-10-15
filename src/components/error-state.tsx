import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shape, Spacing } from '@/constants/theme';
import { errorMessageFor, type AppError } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

/** Seconds remaining until a RateLimited error's retryAfterMs has elapsed. 0 once it has. */
function useCountdown(erroredAt: number, retryAfterMs: number): number {
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, erroredAt + retryAfterMs - Date.now()));

  useEffect(() => {
    if (remainingMs <= 0) return;
    // No auto-retry loop — this only ticks a visible countdown. Retrying is always the user's
    // own tap once it reaches zero (ticket 11: "does not retry aggressively").
    const id = setInterval(() => {
      setRemainingMs(Math.max(0, erroredAt + retryAfterMs - Date.now()));
    }, 1000);
    return () => clearInterval(id);
  }, [erroredAt, retryAfterMs, remainingMs]);

  return Math.ceil(remainingMs / 1000);
}

export function ErrorState({
  error,
  erroredAt,
  onRetry,
  onDismiss,
}: {
  error: AppError;
  erroredAt: number;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const { title, message, canRetry } = errorMessageFor(error);
  const secondsRemaining = useCountdown(erroredAt, error.kind === 'RateLimited' ? error.retryAfterMs ?? 0 : 0);
  const retryBlocked = error.kind === 'RateLimited' && secondsRemaining > 0;

  return (
    <ThemedView
      type="backgroundElement"
      // Announced when it appears: an error that only renders is silent to a screen reader.
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.container, Shape.continuous, { borderColor: theme.border }]}>
      <View style={styles.heading}>
        <Icon ios="exclamationmark.triangle.fill" android="error" size={18} color="danger" />
        <ThemedText type="smallBold" selectable style={styles.title}>
          {title}
        </ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" selectable>
        {message}
      </ThemedText>
      <View style={styles.actions}>
        {canRetry && (
          <AppPressable onPress={onRetry} disabled={retryBlocked} accessibilityLabel="Retry" style={styles.action}>
            <ThemedText type={retryBlocked ? 'small' : 'smallBold'} themeColor={retryBlocked ? undefined : 'primary'}>
              {retryBlocked ? `Retry in ${secondsRemaining}s` : 'Retry'}
            </ThemedText>
          </AppPressable>
        )}
        <AppPressable onPress={onDismiss} accessibilityLabel="Dismiss" style={styles.action}>
          <ThemedText type="small" themeColor="textSecondary">
            Dismiss
          </ThemedText>
        </AppPressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, padding: Spacing.three, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.card },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  action: { justifyContent: 'center' },
});
