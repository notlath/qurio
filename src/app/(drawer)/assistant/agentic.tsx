import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, useLocalSearchParams } from 'expo-router';

import { useAgenticAvailability } from '@/qlik-embed/use-agentic-target';
import { QlikEmbedHost } from '@/qlik-embed/qlik-embed-host';

/**
 * The keyboard's height once it is fully up, 0 as soon as it starts to hide. Not `isVisible`, which
 * turns true when the keyboard starts to slide in: dropping the bottom space then sank the composer
 * under the home indicator until the keyboard arrived (#13).
 */
function useKeyboardUpHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const shown = KeyboardEvents.addListener('keyboardDidShow', (event) => setHeight(event.height));
    const hiding = KeyboardEvents.addListener('keyboardWillHide', () => setHeight(0));
    return () => {
      shown.remove();
      hiding.remove();
    };
  }, []);
  return height;
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
  const keyboardHeight = useKeyboardUpHeight();
  // iOS shrinks the page above the keyboard itself, so the keyboard needs no space.
  const keyboardSpace = Platform.OS === 'ios' ? 0 : keyboardHeight;

  if (availability.status === 'loading') return null;
  if (availability.status === 'unavailable') return <Redirect href="/assistant" />;
  return (
    // The screen runs to the bottom edge, under the home indicator (iOS) or the navigation bar
    // (Android), and only a ScrollView gets automatic insets, so Qlik's composer sat under it. The
    // space is kept inside the page and the WebView frame stays full-size: resizing the frame, or
    // wrapping the embed in a View, broke the keyboard on iOS (#13, #18). Once the keyboard is up it
    // covers the bottom inset. Android draws edge to edge and does not resize the page for the
    // keyboard (KeyboardProvider, src/app/_layout.tsx), so the space is then the keyboard's height.
    <QlikEmbedHost
      config={availability.config}
      surface={availability.target.surface}
      resourceId={availability.target.resourceId}
      bottomInset={keyboardHeight > 0 ? keyboardSpace : bottom}
    />
  );
}
