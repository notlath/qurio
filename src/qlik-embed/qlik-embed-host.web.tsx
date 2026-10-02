import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { QlikEmbedHostProps } from './types';

/** Web previews stay on fixtures (ADR-0005): the embedded host exists only in native builds. */
export function QlikEmbedHost(_props: QlikEmbedHostProps) {
  return (
    <ThemedView>
      <ThemedText>The embedded Qlik view is available in the native app only.</ThemedText>
    </ThemedView>
  );
}
