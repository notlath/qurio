import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fixtureDataName } from '@/qlik/context';
import type { FixtureDataName } from '@/qlik/fixtures/worst-case';

const SEGMENTS: { name: FixtureDataName; label: string }[] = [
  { name: 'demo', label: 'Demo' },
  { name: 'worst', label: 'Worst' },
  { name: 'empty', label: 'Empty' },
  { name: 'one', label: 'One' },
  { name: 'many', label: 'Many' },
];

/**
 * Dev-only chrome for the web preview (break-ui): picks the fixture data through `?data=`, so the
 * choice survives a reload. It is not part of any design, so it stays plain. Never in a release build.
 */
export function FixtureDataSwitch() {
  const theme = useTheme();
  if (!__DEV__ || process.env.EXPO_OS !== 'web') return null;
  const active = fixtureDataName();

  function pick(name: FixtureDataName) {
    const url = new URL(window.location.href);
    if (name === 'demo') url.searchParams.delete('data');
    else url.searchParams.set('data', name);
    // A reload rebuilds the fixture port from the URL, the same boundary the demo data comes through.
    window.location.assign(url.toString());
  }

  return (
    <View pointerEvents="box-none" style={styles.dock}>
      <View style={[styles.track, { backgroundColor: theme.backgroundSelected, borderColor: theme.border }]}>
        {SEGMENTS.map(({ name, label }) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityState={{ selected: name === active }}
            onPress={() => pick(name)}
            style={[styles.segment, name === active && { backgroundColor: theme.backgroundElement }]}>
            <Text style={[styles.label, { color: name === active ? theme.text : theme.textSecondary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Above the tab bar, so the switch never covers a tab.
  dock: { position: 'absolute', left: 0, right: 0, bottom: 96, alignItems: 'center' },
  track: { flexDirection: 'row', padding: Spacing.half, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.pill },
  // Five segments fit a 320pt screen.
  segment: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one + Spacing.half, borderRadius: Radius.pill },
  label: { fontFamily: Fonts.medium, fontSize: 12 },
});
