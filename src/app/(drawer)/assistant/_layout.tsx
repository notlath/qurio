import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { SidePanelButton } from '@/components/side-panel';
import { Spacing } from '@/constants/theme';
import { useStackScreenOptions } from '@/hooks/use-stack-options';
import { useTheme } from '@/hooks/use-theme';

// Like the Gemini app: the side panel button, then the current Assistant as the header's title,
// opened as a sheet. The screen's own title stays for assistive tech and the back stack.
// iOS: the side panel button is the only left item, and the Assistant picker is the centered title.
// Two left items made iOS 26 draw a rectangle on the next screen's back button while the push animated.
const ASSISTANT_HEADER_LEFT: NativeStackNavigationOptions = Platform.OS === 'ios'
  ? {
      unstable_headerLeftItems: () => [{ type: 'custom', element: <SidePanelButton /> }],
      headerTitle: () => <AssistantSwitcher includeAgentic placement="header" />,
    }
  : { headerLeft: AssistantTrigger };

function AssistantTrigger() {
  return (
    <View style={styles.headerLeft}>
      <SidePanelButton />
      <AssistantSwitcher includeAgentic placement="header" />
    </View>
  );
}

// Transparent on iOS, so the conversation scrolls under the header and iOS blurs it there, as it does
// under the large-title headers of the other screens. Android ignores contentInsetAdjustmentBehavior, so
// a transparent header there would cover the first message.
const CHAT_HEADER = { headerTransparent: Platform.OS === 'ios' };

// The Assistant area owns its own stack: the chat screen, with the Agentic Assistant and the
// Assistant chooser pushed over it.
export default function AssistantLayout() {
  const screenOptions = useStackScreenOptions();
  const theme = useTheme();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ ...CHAT_HEADER, headerTitle: '', ...ASSISTANT_HEADER_LEFT, title: 'Assistant' }} />
      <Stack.Screen name="agentic" options={{ title: 'Agentic Assistant' }} />
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

// Android has no shared capsule: a gap keeps the button and the picker apart.
const styles = StyleSheet.create({ headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two } });
