import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'primary' : 'text')];

  return (
    <Text
      style={[
        { color },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        type === 'caption' && styles.caption,
        style,
      ]}
      {...rest}
    />
  );
}

/**
 * Weight is carried by `fontFamily`, not `fontWeight`: Android does not synthesise weights for
 * custom families, so a `fontWeight: 700` on Plus Jakarta Sans silently renders Regular there.
 *
 * Line heights stay at ~1.5x for body copy and tighten on display sizes, per the type scale in
 * the design system. `allowFontScaling` is deliberately left on so Dynamic Type still works.
 */
const styles = StyleSheet.create({
  title: {
    fontFamily: Fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: Fonts.bold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.4,
  },
  default: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: Fonts.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
  },
  link: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  linkPrimary: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 20,
  },
});
