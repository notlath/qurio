import { Host, Switch } from '@expo/ui/jetpack-compose';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';

import { useTheme } from '@/hooks/use-theme';

import type { NativeSwitchProps } from './native-switch';

/** A Material 3 Compose switch in the brand colours, named for TalkBack via semantics. */
export function NativeSwitch({ value, onValueChange, accessibilityLabel, disabled }: NativeSwitchProps) {
  const theme = useTheme();

  return (
    <Host matchContents>
      <Switch
        value={value}
        onCheckedChange={onValueChange}
        enabled={!disabled}
        colors={{
          checkedTrackColor: theme.primary,
          checkedThumbColor: theme.primaryForeground,
          uncheckedTrackColor: theme.background,
          uncheckedBorderColor: theme.borderStrong,
          uncheckedThumbColor: theme.borderStrong,
        }}
        modifiers={[semantics({ contentDescription: accessibilityLabel })]}
      />
    </Host>
  );
}
