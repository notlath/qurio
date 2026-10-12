import { Link, Stack } from 'expo-router';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';
import { useStackScreenOptions } from '@/hooks/use-stack-options';

function HistoryLink() {
  return (
    <Link href="/assistant/history" asChild>
      <IconButton
        accessibilityLabel="Open conversation history"
        variant="tinted"
        icon={<Icon ios="clock.arrow.circlepath" android="history" size={22} color="primary" />}
      />
    </Link>
  );
}

// Like the Gemini app: the current Assistant is the header's title, opened as a sheet. The screen's
// own title stays for assistive tech and the back stack.
function AssistantTrigger() {
  return <AssistantSwitcher includeAgentic placement="header" />;
}

// The Assistant area owns its own stack so a Thread opened from History keeps the Assistant
// tab selected and Back returns through History.
export default function AssistantLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Assistant', headerTitle: '', headerLeft: AssistantTrigger, headerRight: HistoryLink }} />
      <Stack.Screen name="agentic" options={{ title: 'Agentic Assistant' }} />
      <Stack.Screen name="history" options={{ title: 'History', headerLargeTitle: true }} />
      <Stack.Screen name="thread/[id]" options={{ title: 'Thread' }} />
    </Stack>
  );
}
