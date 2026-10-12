import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { errorMessageFor } from '@/domain';
import { useAssistantSelection } from '@/qlik/assistant-selection';

export function AssistantSwitcher() {
  const { assistants, agentic, selected, loading, error, choose } = useAssistantSelection();
  const [expanded, setExpanded] = useState(false);
  const [failure, setFailure] = useState(false);
  if (loading) return <ActivityIndicator accessibilityLabel="Loading Assistants" />;
  if (error) {
    const message = errorMessageFor(error);
    return (
      <View style={{ padding: Spacing.three }}>
        <ThemedText type="smallBold">{message.title}</ThemedText>
        <ThemedText>{message.message}</ThemedText>
      </View>
    );
  }
  if (assistants.length === 0) {
    // An empty classic list does not mean a missing license: nobody has verified what Qlik returns
    // for that. Agentic Assistants have their own entry on the screen, so there is nothing to say.
    if (agentic.length > 0) return null;
    return (
      <View style={{ padding: Spacing.three }}>
        <ThemedText type="smallBold">No Assistants available</ThemedText>
        <ThemedText>No Assistant is available to you yet. Ask your Tenant admin to give you access to an Assistant.</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ padding: Spacing.three }}>
      <AppPressable
        disabled={assistants.length === 1}
        accessibilityLabel="Choose Assistant"
        accessibilityState={{ expanded: expanded || !selected }}
        onPress={() => setExpanded(!expanded)}>
        <ThemedText type="smallBold">{selected?.name ?? 'Choose an Assistant'}</ThemedText>
      </AppPressable>
      {(expanded || !selected) && assistants.map((assistant) => (
        <AppPressable
          key={assistant.id}
          accessibilityState={{ selected: assistant.id === selected?.id }}
          onPress={async () => {
            try {
              await choose(assistant);
              setExpanded(false);
              setFailure(false);
            } catch {
              setFailure(true);
            }
          }}>
          <ThemedText>{assistant.name}</ThemedText>
        </AppPressable>
      ))}
      {failure && <ThemedText themeColor="danger">Could not remember the Assistant. Try again.</ThemedText>}
    </View>
  );
}
