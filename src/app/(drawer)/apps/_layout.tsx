import { Stack } from 'expo-router';

import { SidePanelButton } from '@/components/side-panel';
import { useStackScreenOptions } from '@/hooks/use-stack-options';

// Its own stack so the destination gets a native header: a large title on iOS that collapses on scroll.
export default function AppsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Apps', headerLargeTitle: true, headerLeft: SidePanelButton }} />
      {/* Pushed in the Apps stack, so it opens beside the docked panel and keeps swipe-to-go-back on phones. */}
      <Stack.Screen name="[id]" options={{ title: 'Analytics App' }} />
    </Stack>
  );
}
