import { Host, Toggle } from '@expo/ui/swift-ui';
import { disabled as disabledModifier, labelsHidden, tint } from '@expo/ui/swift-ui/modifiers';

import { useTheme } from '@/hooks/use-theme';

import type { NativeSwitchProps } from './native-switch';

/**
 * A real SwiftUI Toggle. The label is passed and then hidden: the row already shows its title, and
 * a hidden label is still what VoiceOver reads, so the control is never announced unnamed.
 */
export function NativeSwitch({ value, onValueChange, accessibilityLabel, disabled }: NativeSwitchProps) {
  const theme = useTheme();

  return (
    <Host matchContents>
      <Toggle
        isOn={value}
        onIsOnChange={onValueChange}
        label={accessibilityLabel}
        modifiers={[labelsHidden(), tint(theme.primary), ...(disabled ? [disabledModifier(true)] : [])]}
      />
    </Host>
  );
}
