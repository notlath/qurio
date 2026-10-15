// PROTOTYPE (prototype/side-panel): throwaway. Cycles `?variant=` on the current route. Never ships:
// it renders nothing outside development builds.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

export function usePrototypeVariant<K extends string>(keys: readonly K[]): K {
  const { variant } = useLocalSearchParams<{ variant?: string }>();
  return keys.includes(variant as K) ? (variant as K) : keys[0];
}

export function PrototypeSwitcher<K extends string>({ variants, current }: { variants: readonly { key: K; name: string }[]; current: K }) {
  const index = Math.max(0, variants.findIndex((v) => v.key === current));
  const go = (step: number) => router.setParams({ variant: variants[(index + step + variants.length) % variants.length].key });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable]')) return;
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!__DEV__) return null;
  const { key, name } = variants[index];
  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={styles.bar}>
        <Pressable accessibilityLabel="Previous variant" onPress={() => go(-1)} style={styles.arrow}>
          <Text style={styles.text}>‹</Text>
        </Pressable>
        <Text style={styles.text}>{`${key} (${name})`}</Text>
        <Pressable accessibilityLabel="Next variant" onPress={() => go(1)} style={styles.arrow}>
          <Text style={styles.text}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, top: 56, alignItems: 'center', zIndex: 1000 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: '#FF2D92',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  arrow: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
