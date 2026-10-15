import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { useStackScreenOptions } from '@/hooks/use-stack-options';
import { useTheme } from '@/hooks/use-theme';

// Like the Gemini app: the current Assistant is the header's title, opened as a sheet. The screen's
// own title stays for assistive tech and the back stack.
function AssistantTrigger() {
  return <AssistantSwitcher includeAgentic placement="header" />;
}

// Transparent on iOS, so the conversation scrolls under the header and iOS blurs it there, as it does
// under the large-title headers of the other tabs. Android ignores contentInsetAdjustmentBehavior, so
// a transparent header there would cover the first message.
const CHAT_HEADER = { headerTransparent: Platform.OS === 'ios' };

// The Assistant area owns its own stack so a Thread opened from History keeps the Assistant
// tab selected and Back returns through History.
export default function AssistantLayout() {
  const screenOptions = useStackScreenOptions();
  const theme = useTheme();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ ...CHAT_HEADER, title: 'Assistant', headerTitle: '', headerLeft: AssistantTrigger }} />
      <Stack.Screen name="agentic" options={{ title: 'Agentic Assistant' }} />
      <Stack.Screen name="history" options={{ title: 'History', headerLargeTitle: true }} />
      <Stack.Screen name="thread/[id]" options={{ ...CHAT_HEADER, title: 'Thread' }} />
      <Stack.Screen
        name="choose"
        options={{
          title: 'Choose an Assistant',
          // A short interruption, so a sheet: half height first, drag up for the full list. The sheet
          // draws its own title and Close button, because Android has no header inside a form sheet.
          presentation: 'formSheet',
          sheetAllowedDetents: [0.5, 1],
          sheetGrabberVisible: true,
          headerShown: false,
          contentStyle: { backgroundColor: theme.backgroundElement },
        }}
      />
    </Stack>
  );
}
