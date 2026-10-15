import { Stack, useRouter } from 'expo-router';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';
import { useStackScreenOptions } from '@/hooks/use-stack-options';

// Settings beside the docked side panel (settingsHref). A drawer screen has no back stack of its own, so Back
// returns through the drawer history to the destination that Settings opened over, else to the Assistant.
function SettingsBackButton() {
  const router = useRouter();

  return (
    <IconButton
      accessibilityLabel="Back"
      onPress={() => (router.canGoBack() ? router.back() : router.navigate('/assistant'))}
      icon={<Icon ios="chevron.left" android="arrow_back" size={22} color="primary" />}
    />
  );
}

export default function SettingsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Settings', headerLargeTitle: true, headerLeft: SettingsBackButton }} />
      <Stack.Screen name="change-tenant" options={{ title: 'Change tenant' }} />
    </Stack>
  );
}
