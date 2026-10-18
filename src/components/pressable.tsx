import { useState, type ReactElement } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Duration, Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * How a press shows. `scale` is for surfaces you can see the edge of (buttons, cards, chips),
 * `highlight` for full-width list rows, and `opacity` for bare text and icons, as iOS bar buttons do.
 */
type PressFeedback = 'scale' | 'highlight' | 'opacity';

type AppPressableProps = Omit<PressableProps, 'style'> & {
  style?: ViewStyle | ViewStyle[];
  feedback?: PressFeedback;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
// A strong ease-out: the built-in curves are too weak to read as a response inside 100ms.
const PRESS_EASING = Easing.bezier(0.23, 1, 0.32, 1);
const isAndroid = process.env.EXPO_OS === 'android';

/**
 * Every tappable thing in the app goes through here, so the two rules that were being missed
 * per-callsite hold everywhere instead: a tap area of at least 44pt (iOS) / 48dp (Android), and
 * a visible press response on press-in. A scale is a transform, so it never moves the layout
 * around it. Android keeps its ripple, which is already the row highlight there.
 */
export function AppPressable({
  style,
  disabled,
  accessibilityState,
  feedback = 'opacity',
  onPressIn,
  onPressOut,
  children,
  ...rest
}: AppPressableProps) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  const [scale] = useState(() => new Animated.Value(1));

  const pressedStyle =
    feedback === 'opacity'
      ? styles.pressed
      : feedback === 'highlight' && !isAndroid
        ? { backgroundColor: theme.backgroundSelected }
        : undefined;

  function press(next: boolean) {
    // Only a style change needs a render. A scale runs on the native driver, and Android rows ripple.
    if (pressedStyle) setPressed(next);
    if (feedback !== 'scale') return;
    Animated.timing(scale, {
      toValue: next ? 0.97 : 1,
      duration: Duration.instant,
      easing: PRESS_EASING,
      useNativeDriver: process.env.EXPO_OS !== 'web',
    }).start();
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      // Merged, not replaced: a caller passing `{ selected }` (Chip) or `{ expanded }` (Sources)
      // would otherwise drop the disabled state that this component is responsible for.
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: theme.backgroundSelected, borderless: false }}
      onPressIn={(event) => {
        press(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press(false);
        onPressOut?.(event);
      }}
      style={[
        styles.base,
        style as ViewStyle,
        disabled && styles.disabled,
        pressed && !disabled && pressedStyle,
        feedback === 'scale' && { transform: [{ scale }] },
      ]}
      {...rest}>
      {children}
    </AnimatedPressable>
  );
}

/** The filled call-to-action: sign in, save, unlock. One per screen at most. */
export function PrimaryButton({
  label,
  busy,
  disabled,
  style,
  ...rest
}: Omit<AppPressableProps, 'children'> & { label: string; busy?: boolean }) {
  const theme = useTheme();

  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{ busy: !!busy }}
      disabled={disabled || busy}
      feedback="scale"
      style={[styles.primary, { backgroundColor: theme.primary }, style as ViewStyle]}
      {...rest}>
      {busy ? (
        <ActivityIndicator color={theme.primaryForeground} />
      ) : (
        <ThemedText type="smallBold" themeColor="primaryForeground">
          {label}
        </ThemedText>
      )}
    </AppPressable>
  );
}

/**
 * An icon-only action: a circular tap target at the platform minimum. The icon is decorative, so
 * `accessibilityLabel` is required — it is the only name a screen reader has for the control.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  variant = 'plain',
  style,
  ...rest
}: Omit<AppPressableProps, 'children'> & {
  icon: ReactElement;
  accessibilityLabel: string;
  variant?: 'plain' | 'filled' | 'tinted';
}) {
  const theme = useTheme();
  const backgroundColor =
    variant === 'filled' ? theme.primary : variant === 'tinted' ? theme.backgroundSelected : 'transparent';

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      // A bare icon has no edge to shrink, so it dims like a bar button. A filled or tinted one scales.
      feedback={variant === 'plain' ? 'opacity' : 'scale'}
      style={[styles.iconButton, { backgroundColor }, style as ViewStyle]}
      {...rest}>
      {icon}
    </AppPressable>
  );
}

/**
 * A selectable pill. `selected` is exposed to assistive tech as well as drawn — the original
 * feedback chips signalled selection with colour alone, which a screen reader never sees.
 */
export function Chip({
  label,
  selected,
  style,
  ...rest
}: Omit<AppPressableProps, 'children'> & { label: string; selected?: boolean }) {
  const theme = useTheme();

  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      feedback="scale"
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.backgroundSelected : 'transparent',
          borderColor: selected ? theme.primary : theme.borderStrong,
        },
        style as ViewStyle,
      ]}
      {...rest}>
      <ThemedText type="small" themeColor={selected ? 'primary' : 'textSecondary'}>
        {label}
      </ThemedText>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: TouchTarget,
    justifyContent: 'center',
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.42 },
  primary: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.pill,
  },
  iconButton: {
    alignItems: 'center',
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: Radius.pill,
  },
  chip: {
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
});
