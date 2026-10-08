import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomTabInset } from '@/constants/theme';
import { useAgenticAvailability } from '@/qlik-embed/use-agentic-target';
import { QlikEmbedHost } from '@/qlik-embed/qlik-embed-host';

/**
 * The Agentic Assistant in the shared embedded host. Guarded on direct entry, not only by the
 * hidden link: with no `agenticAssistantId` and no discovered `?id=` (or on web) there is nothing to open, so it returns
 * to the classic Assistant, which stays the working surface until ticket 22 retires it.
 */
export default function AgenticAssistantScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const availability = useAgenticAvailability(id);
  const insets = useSafeAreaInsets();

  if (availability.status === 'loading') return null;
  if (availability.status === 'unavailable') return <Redirect href="/assistant" />;
  const embed = (
    <QlikEmbedHost
      config={availability.config}
      surface={availability.target.surface}
      resourceId={availability.target.resourceId}
    />
  );
  if (Platform.OS !== 'ios') return embed;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      automaticOffset
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, paddingBottom: BottomTabInset + insets.bottom }}>
        {embed}
      </View>
    </KeyboardAvoidingView>
  );
}
