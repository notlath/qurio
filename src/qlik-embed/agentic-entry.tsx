import { Link } from 'expo-router';
import type { ReactElement } from 'react';
import { StyleSheet } from 'react-native';

import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAgenticAvailability } from './use-agentic-target';

/** Shown only where an Agentic Assistant is configured; classic chat below stays the working surface meanwhile. */
export function AgenticEntry(): ReactElement | null {
  const theme = useTheme();
  const availability = useAgenticAvailability();
  if (availability.status !== 'ready') return null;

  return (
    <Link href="/assistant/agentic" asChild>
      <AppPressable
        accessibilityLabel="Open the Agentic Assistant"
        // Flattened: `Link asChild` throws in development if its child's style is an array.
        style={StyleSheet.flatten([
          styles.agenticEntry,
          { borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ])}>
        <ThemedText type="smallBold" themeColor="primary">
          Open the Agentic Assistant
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Ask about your analytics apps and knowledge bases.
        </ThemedText>
      </AppPressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  agenticEntry: {
    gap: Spacing.one,
    margin: Spacing.four,
    marginBottom: 0,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
  },
});
