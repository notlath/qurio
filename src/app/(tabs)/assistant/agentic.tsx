import { Redirect, useLocalSearchParams } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { bottom } = useSafeAreaInsets();

  if (availability.status === 'loading') return null;
  if (availability.status === 'unavailable') return <Redirect href="/assistant" />;
  return (
    // iOS: the native tab bar floats over the screen and only a ScrollView gets automatic insets,
    // so Qlik's bottom-pinned composer sat under it. Inside the tabs the bottom inset includes the
    // tab bar. Android: native tabs already keep screen content above the tab bar.
    <View style={[styles.flex, { paddingBottom: Platform.OS === 'ios' ? bottom : 0 }]}>
      <QlikEmbedHost
        config={availability.config}
        surface={availability.target.surface}
        resourceId={availability.target.resourceId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
