import type { NativeStackNavigationOptions } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One header style for every stack: the navigator owns the title (iOS large titles collapse on
 * scroll), set in the brand face and sitting flush on the screen background with no hairline.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useTheme();

  return {
    headerTintColor: theme.primary,
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTitleStyle: { fontFamily: Fonts.semibold, color: theme.text },
    headerLargeTitleStyle: { fontFamily: Fonts.bold, color: theme.text },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: theme.background },
  };
}
