import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'defaultSemiBold'
    | 'headline'
    | 'question'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'linkPrimary'
    | 'code'
    | 'caption';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'primary' : 'text')];

  return (
    <Text
      // Display sizes are headings to VoiceOver/TalkBack too, so rotor and heading navigation find them.
      accessibilityRole={type === 'title' || type === 'subtitle' ? 'header' : undefined}
      style={[
        { color },
        type === 'default' && styles.default,
        type === 'defaultSemiBold' && styles.defaultSemiBold,
        type === 'headline' && styles.headline,
        type === 'question' && styles.question,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
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
  // The display size: iOS's Title 1. Used once per screen, for a first-screen heading.
  title: {
    fontFamily: Fonts.bold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
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
  // A title in a header or a sheet, as iOS's Headline style.
  headline: {
    fontFamily: Fonts.semibold,
    fontSize: 17,
    lineHeight: 22,
  },
  // A list row's name. Tighter than body copy, because it is one line, not a paragraph.
  defaultSemiBold: {
    fontFamily: Fonts.semibold,
    fontSize: 16,
    lineHeight: 22,
  },
  // The Qlik User's question: the same size as the Answer, so the Answer is never outranked. The
  // bubble's colour and side already say whose words these are.
  question: {
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
  linkPrimary: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
  },
  code: {
    fontFamily: Fonts.mono,
    fontSize: 14,
    lineHeight: 20,
  },
});

export { styles as TextStyles };
