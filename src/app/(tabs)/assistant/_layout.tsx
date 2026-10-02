import { Link, Stack } from 'expo-router';

import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';

function HistoryLink() {
  return (
    <Link href="/assistant/history" asChild>
      <AppPressable accessibilityLabel="Open conversation history">
        <ThemedText type="link" themeColor="primary">
          History
        </ThemedText>
      </AppPressable>
    </Link>
  );
}

// The Assistant area owns its own stack so a Thread opened from History keeps the Assistant
// tab selected and Back returns through History.
export default function AssistantLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Assistant', headerRight: HistoryLink }} />
      <Stack.Screen name="agentic" options={{ title: 'Agentic Assistant' }} />
      <Stack.Screen name="history" options={{ title: 'History' }} />
      <Stack.Screen name="thread/[id]" options={{ title: 'Thread' }} />
    </Stack>
  );
}
