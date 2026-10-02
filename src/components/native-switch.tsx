import { Switch } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export type NativeSwitchProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Required: the switch sits beside its row's visible title, so this is its only spoken name. */
  accessibilityLabel: string;
  disabled?: boolean;
};

/** Web and test fallback. Devices get the SwiftUI / Compose control (native-switch.ios/.android). */
export function NativeSwitch({ value, onValueChange, accessibilityLabel, disabled }: NativeSwitchProps) {
  const theme = useTheme();

  return (
    <Switch
      accessibilityLabel={accessibilityLabel}
      value={value}
      disabled={disabled}
      onValueChange={onValueChange}
      trackColor={{ false: theme.borderStrong, true: theme.primary }}
    />
  );
}
