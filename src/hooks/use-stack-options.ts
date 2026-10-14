import type { NativeStackNavigationOptions } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One header style for every stack: the navigator owns the title (iOS large titles collapse on
 * scroll), set in the brand face and sitting flush on the screen background with no hairline.
 *
 * No `headerStyle.backgroundColor`: the navigation theme's `card` already paints the header in the
 * screen background. A background colour set here also makes the large title invisible on iOS 26.
 * expo-router leaves a large-title header transparent on iOS for this reason, unless a colour is set.
 */
export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useTheme();

  return {
    headerTintColor: theme.primary,
    headerShadowVisible: false,
    headerLargeTitleShadowVisible: false,
    headerTitleStyle: { fontFamily: Fonts.semibold, color: theme.text },
    headerLargeTitleStyle: { fontFamily: Fonts.bold, color: theme.text },
    headerBackButtonDisplayMode: 'minimal',
    contentStyle: { backgroundColor: theme.background },
  };
}
