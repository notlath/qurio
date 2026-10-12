import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-options';

// Its own stack so the tab gets a native header: a large title on iOS that collapses on scroll.
export default function SettingsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Settings', headerLargeTitle: true }} />
      <Stack.Screen name="change-tenant" options={{ title: 'Change tenant' }} />
    </Stack>
  );
}
