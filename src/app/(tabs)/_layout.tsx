import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

// SDK 57 ships native tabs under `unstable-native-tabs`; the import moves to `native-tabs` in SDK 58.
export default function TabsLayout() {
  const theme = useTheme();

  return (
    // Android: by default the keyboard overlays the tab bar and the screen above it, hiding the
    // chat input; this makes the content shrink above the keyboard instead (needs Android 11+).
    <NativeTabs tabBarRespectsIMEInsets tintColor={theme.primary} indicatorColor={theme.backgroundSelected}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>Apps</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="apps" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="assistant">
        <NativeTabs.Trigger.Label>Assistant</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bubble.left.fill" md="chat" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
