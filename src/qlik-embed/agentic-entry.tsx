import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAgenticAvailability } from './use-agentic-target';

/** Shown only where an Agentic Assistant is configured; classic chat below stays the working surface meanwhile. */
export function AgenticEntry(): ReactElement | null {
  const theme = useTheme();
  const availability = useAgenticAvailability();
  if (availability.status !== 'ready') return null;

  return (
    <View style={[styles.container, ContentColumn]}>
      <Link href="/assistant/agentic" asChild>
        <AppPressable
          accessibilityLabel="Open the Agentic Assistant"
          // Flattened: `Link asChild` throws in development if its child's style is an array.
          style={StyleSheet.flatten([
            styles.agenticEntry,
            Shape.continuous,
            { borderColor: theme.border, backgroundColor: theme.backgroundElement },
          ])}>
          <View style={[styles.tile, Shape.continuous, { backgroundColor: theme.backgroundSelected }]}>
            <Icon ios="wand.and.stars" android="auto_awesome" color="primary" />
          </View>
          <View style={styles.text}>
            <ThemedText type="smallBold">Open the Agentic Assistant</ThemedText>
            <ThemedText type="small">
              Ask about your analytics apps and knowledge bases.
            </ThemedText>
          </View>
          <Icon ios="chevron.right" android="chevron_right" size={14} color="textSecondary" />
        </AppPressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  agenticEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
  tile: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.small },
  text: { flex: 1, gap: Spacing.one },
});
