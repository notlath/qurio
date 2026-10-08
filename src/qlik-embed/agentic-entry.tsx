import { Link } from 'expo-router';
import type { ComponentProps, ReactElement } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ContentColumn, Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { useAgenticAvailability } from './use-agentic-target';

/**
 * The configured Agentic Assistant, or else one row per discovered Agentic Assistant (ticket 10).
 * Only on the Assistant screen, so History stays classic-only. Never on web (ADR-0005).
 */
export function AgenticEntry(): ReactElement | null {
  const availability = useAgenticAvailability();
  const { agentic } = useAssistantSelection();
  if (availability.status === 'ready') {
    return (
      <View style={[styles.container, ContentColumn]}>
        <EntryRow
          href="/assistant/agentic"
          title="Open the Agentic Assistant"
          subtitle="Ask about your analytics apps and knowledge bases." />
      </View>
    );
  }
  if (Platform.OS === 'web' || agentic.length === 0) return null;

  return (
    <View style={[styles.container, ContentColumn]}>
      <ThemedText type="smallBold" themeColor="textSecondary">Agentic Assistants</ThemedText>
      {agentic.map((assistant) => (
        <EntryRow
          key={assistant.id}
          href={{ pathname: '/assistant/agentic', params: { id: assistant.id } }}
          title={assistant.name}
          subtitle={assistant.description || 'Ask about your analytics apps and knowledge bases.'} />
      ))}
    </View>
  );
}

function EntryRow({ href, title, subtitle }: { href: ComponentProps<typeof Link>['href']; title: string; subtitle: string }) {
  const theme = useTheme();
  return (
    <Link href={href} asChild>
      <AppPressable
        accessibilityLabel={title}
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
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small">{subtitle}</ThemedText>
        </View>
        <Icon ios="chevron.right" android="chevron_right" size={14} color="textSecondary" />
      </AppPressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.two, paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
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
