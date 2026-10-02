import { Link, Stack } from 'expo-router';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';
import { useStackScreenOptions } from '@/hooks/use-stack-options';

function HistoryLink() {
  return (
    <Link href="/assistant/history" asChild>
      <IconButton
        accessibilityLabel="Open conversation history"
        icon={<Icon ios="clock.arrow.circlepath" android="history" size={22} color="primary" />}
      />
    </Link>
  );
}

// The Assistant area owns its own stack so a Thread opened from History keeps the Assistant
// tab selected and Back returns through History.
export default function AssistantLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Assistant', headerRight: HistoryLink }} />
      <Stack.Screen name="agentic" options={{ title: 'Agentic Assistant' }} />
      <Stack.Screen name="history" options={{ title: 'History', headerLargeTitle: true }} />
      <Stack.Screen name="thread/[id]" options={{ title: 'Thread' }} />
    </Stack>
  );
}
