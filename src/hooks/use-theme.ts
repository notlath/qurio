/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { brandPrimary } from '@/brand/brand';
import { useBrand } from '@/brand/context';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? 'dark' : 'light';
  const { brand } = useBrand();

  return { ...Colors[theme], ...brandPrimary(brand, theme) };
}
