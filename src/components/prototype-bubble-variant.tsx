// PROTOTYPE (prototype/chat-bubbles branch): three Answer bubble directions on the real Assistant
// screens, switched by `?variant=A|B|C` on web or the floating ← → bar on a phone. Throwaway: the
// winner is rewritten properly on `dev`, and this file never merges there.
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const BUBBLE_VARIANTS = {
  A: "Today's: question bubble, unboxed Answer",
  B: 'Messaging: Answer left in a neutral bubble',
  C: 'Card: Answer in a full-width card',
} as const;
export type BubbleVariant = keyof typeof BUBBLE_VARIANTS;
const KEYS = Object.keys(BUBBLE_VARIANTS) as BubbleVariant[];

function fromUrl(): BubbleVariant | null {
  const value = new URLSearchParams(globalThis.location?.search ?? '').get('variant');
  return value && value in BUBBLE_VARIANTS ? (value as BubbleVariant) : null;
}

let current: BubbleVariant = fromUrl() ?? 'B';
const listeners = new Set<() => void>();

function setVariant(next: BubbleVariant) {
  current = next;
  if (globalThis.location && globalThis.history) {
    const url = new URL(globalThis.location.href);
    url.searchParams.set('variant', next);
    globalThis.history.replaceState(null, '', url.toString());
  }
  listeners.forEach((listener) => listener());
}

export function useBubbleVariant(): BubbleVariant {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

function step(by: number) {
  const index = (KEYS.indexOf(current) + by + KEYS.length) % KEYS.length;
  setVariant(KEYS[index]);
}

/** Floating ← label → bar. Dev builds only. */
export function BubbleVariantSwitcher() {
  const variant = useBubbleVariant();

  useEffect(() => {
    if (!__DEV__ || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  if (!__DEV__) return null;
  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Previous variant" onPress={() => step(-1)} style={styles.arrow}>
          <Text style={styles.text}>←</Text>
        </Pressable>
        <Text style={[styles.text, styles.label]} numberOfLines={1}>
          {variant} ({BUBBLE_VARIANTS[variant]})
        </Text>
        <Pressable accessibilityLabel="Next variant" onPress={() => step(1)} style={styles.arrow}>
          <Text style={styles.text}>→</Text>
        </Pressable>
      </View>
    </View>
  );
}

// High-contrast prototype chrome, so it never reads as part of the design under test.
const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 150, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '94%',
    backgroundColor: '#111',
    borderRadius: 999,
    paddingHorizontal: 4,
    boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
  },
  arrow: { paddingHorizontal: 14, paddingVertical: 10 },
  text: { color: '#fff', fontSize: 13, fontWeight: '600' },
  label: { flexShrink: 1 },
});
