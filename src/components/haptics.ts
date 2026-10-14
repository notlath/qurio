import * as Haptics from 'expo-haptics';

/**
 * Haptics are punctuation: one per user action, on the same frame as the visual change, never the
 * only feedback. Web has no haptics, so every call is a no-op there.
 */
const native = process.env.EXPO_OS !== 'web';

/** A question was sent. */
export function tapHaptic(): void {
  if (native) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** A value changed: a layout, a vote, an Assistant. */
export function selectionHaptic(): void {
  if (native) void Haptics.selectionAsync();
}

/** A destructive action went ahead. */
export function warningHaptic(): void {
  if (native) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
