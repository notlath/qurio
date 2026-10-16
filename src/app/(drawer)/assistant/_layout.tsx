import { Stack, type NativeStackNavigationOptions } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { SidePanelButton } from '@/components/side-panel';
import { Spacing } from '@/constants/theme';
import { useStackScreenOptions } from '@/hooks/use-stack-options';
import { useTheme } from '@/hooks/use-theme';

// Like the Gemini app: the side panel button, then the current Assistant as the header's title,
// opened as a sheet. The screen's own title stays for assistive tech and the back stack.
// iOS 26 draws one shared glass capsule behind all left items of a header. Separate items with a
// space between them get a capsule each, so the button and the picker read as two controls.
const ASSISTANT_HEADER_LEFT: NativeStackNavigationOptions = Platform.OS === 'ios'
  ? {
      unstable_headerLeftItems: () => [
        { type: 'custom', element: <SidePanelButton /> },
        { type: 'spacing', spacing: Spacing.two },
        { type: 'custom', element: <AssistantSwitcher includeAgentic placement="header" /> },
      ],
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
      <Stack.Screen name="index" options={{ ...CHAT_HEADER, ...ASSISTANT_HEADER_LEFT, title: 'Assistant', headerTitle: '' }} />
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
