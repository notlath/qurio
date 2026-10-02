/**
 * Design tokens. Every colour, type step, duration and radius in the app comes from here —
 * screens never hardcode a hex or a magic number (pro-rules: token-driven theming).
 *
 * Palette is Qlik-brand green, kept from the original build: every text pair already clears
 * WCAG AA (lowest is textSecondary at 5.11:1), so there was nothing to gain by replacing it.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#17251D',
    background: '#F6F9F6',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E1F0E6',
    textSecondary: '#5D6E63',
    primary: '#146B43',
    primaryForeground: '#FFFFFF',
    border: '#D7E4DB',
    // Control boundaries (inputs, outlined buttons, selected chips) need 3:1 against their
    // neighbours; `border` at 1.24:1 is a decorative separator only. 3.24:1 vs background.
    borderStrong: '#7C8F83',
    danger: '#B42318',
  },
  dark: {
    text: '#F2F7F2',
    background: '#101713',
    backgroundElement: '#19231C',
    backgroundSelected: '#254232',
    textSecondary: '#B4C4BA',
    primary: '#7FD3A2',
    primaryForeground: '#102117',
    border: '#31473A',
    borderStrong: '#5E7566', // 3.65:1 vs background
    danger: '#FFB4AB',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/**
 * Plus Jakarta Sans, loaded at runtime in the root layout. React Native does not synthesise
 * weights for custom families on Android — `fontWeight` is ignored, and the family name is the
 * only way to select a cut. So weights are families here, not a numeric prop.
 */
export const Fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  mono: Platform.select({ ios: 'ui-monospace', android: 'monospace', default: 'monospace' }),
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: Platform.select({ ios: 12, android: 8, default: 8 }) ?? 8,
  control: Platform.select({ ios: 16, android: 12, default: 12 }) ?? 12,
  card: Platform.select({ ios: 22, android: 16, default: 16 }) ?? 16,
  pill: 999,
} as const;

/**
 * Platform minimum tap size — 44pt on iOS, 48dp on Android. One shared number for both would
 * under-serve Android, which is why this is a Platform.select and not a constant.
 */
export const TouchTarget = Platform.select({ ios: 44, android: 48, default: 44 }) ?? 44;

/**
 * Motion is chosen by distance and complexity, never one duration copied everywhere
 * (design-system motion tier: Subtle). `instant` is the press-state feedback budget —
 * pro-rules want a visible response inside 80-150ms.
 */
export const Duration = {
  instant: 100,
  short: 180,
  medium: 260,
} as const;

/** Light mode needs real surface separation; dark mode separates with borders instead. */
export const Elevation = {
  card: Platform.select({
    ios: { shadowColor: '#0B1F14', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    android: { elevation: 2 },
    default: {},
  }),
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
