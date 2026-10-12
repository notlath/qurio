import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAgenticAvailability } from '@/qlik-embed/use-agentic-target';
import { QlikEmbedHost } from '@/qlik-embed/qlik-embed-host';

/**
 * True once the keyboard is fully up, false as soon as it starts to hide. Not `isVisible`, which
 * turns true when the keyboard starts to slide in: dropping the tab-bar space then sank the composer
 * under the tab bar until the keyboard arrived (#13).
 */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const shown = KeyboardEvents.addListener('keyboardDidShow', () => setUp(true));
    const hiding = KeyboardEvents.addListener('keyboardWillHide', () => setUp(false));
    return () => {
      shown.remove();
      hiding.remove();
    };
  }, []);
  return up;
}

/**
 * The Agentic Assistant in the shared embedded host. Guarded on direct entry, not only by the
 * hidden link: with no `agenticAssistantId` and no discovered `?id=` (or on web) there is nothing to open, so it returns
 * to the classic Assistant, which stays the working surface until ticket 22 retires it.
 */
export default function AgenticAssistantScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const availability = useAgenticAvailability(id);
  const { bottom } = useSafeAreaInsets();
  const keyboardUp = useKeyboardUp();

  if (availability.status === 'loading') return null;
  if (availability.status === 'unavailable') return <Redirect href="/assistant" />;
  return (
    // iOS: the native tab bar floats over the screen, and only a ScrollView gets automatic insets, so
    // Qlik's composer sat under it. Inside the tabs the bottom inset includes the tab bar. The space
    // is kept inside the page and the WebView frame stays full-size: resizing the frame, or wrapping
    // the embed in a View, broke the keyboard on iOS (#13, #18). Once the keyboard is up it covers the
    // tab bar, so the space is 0, as the Composer does. Android: native tabs already keep screen
    // content above the tab bar.
    <QlikEmbedHost
      config={availability.config}
      surface={availability.target.surface}
      resourceId={availability.target.resourceId}
      bottomInset={Platform.OS === 'ios' && !keyboardUp ? bottom : 0}
    />
  );
}
