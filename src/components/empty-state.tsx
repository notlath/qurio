import type { ReactElement, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shape, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** A composed empty list: what would be here, and how it gets filled. */
export function EmptyState({
  icon,
  title,
  message,
  children,
}: {
  icon: ReactElement;
  title: string;
  message: string;
  children?: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.iconTile, Shape.continuous, { backgroundColor: theme.backgroundSelected }]}>{icon}</View>
      <ThemedText type="smallBold" accessibilityRole="header" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {message}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.five, paddingHorizontal: Spacing.four },
  iconTile: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
    borderRadius: Radius.card,
  },
  centered: { textAlign: 'center', maxWidth: 320 },
});
