import type { ReactElement } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type PressableProps, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AppPressableProps = Omit<PressableProps, 'style'> & {
  style?: ViewStyle | ViewStyle[];
};

/**
 * Every tappable thing in the app goes through here, so the two rules that were being missed
 * per-callsite hold everywhere instead: a tap area of at least 44pt (iOS) / 48dp (Android), and
 * a visible press response. Press feedback is opacity plus an Android ripple — never a transform,
 * which would shift surrounding layout (pro-rules: stable interaction states).
 */
export function AppPressable({ style, disabled, accessibilityState, children, ...rest }: AppPressableProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      // Merged, not replaced: a caller passing `{ selected }` (Chip) or `{ expanded }` (Sources)
      // would otherwise drop the disabled state that this component is responsible for.
      accessibilityState={{ disabled: !!disabled, ...accessibilityState }}
      disabled={disabled}
      android_ripple={disabled ? undefined : { color: theme.backgroundSelected, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        style as ViewStyle,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      {...rest}>
      {children}
    </Pressable>
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
