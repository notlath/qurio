import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * SF Symbols on iOS, Material Symbols on Android and web — one icon family per platform, tinted
 * from the theme. Decorative by default: the control that holds it carries the accessible label.
 */
export function Icon({
  ios,
  android,
  size = 20,
  color = 'text',
}: {
  ios: SFSymbol;
  android: AndroidSymbol;
  size?: number;
  color?: ThemeColor;
}) {
  const theme = useTheme();

  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={theme[color]}
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
