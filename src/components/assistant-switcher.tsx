import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { errorMessageFor } from '@/domain';
import { useAssistantSelection } from '@/qlik/assistant-selection';

export function AssistantSwitcher() {
  const { assistants, selected, loading, error, choose } = useAssistantSelection();
  const [expanded, setExpanded] = useState(false);
  const [failure, setFailure] = useState(false);
  if (loading) return <ActivityIndicator accessibilityLabel="Loading Assistants" />;
  if (error || assistants.length === 0) {
    const message = errorMessageFor(error ?? { kind: 'NotEntitled' });
    return <View style={{ padding: Spacing.three }}><ThemedText type="smallBold">{message.title}</ThemedText><ThemedText>{message.message}</ThemedText></View>;
  }
  return <View style={{ padding: Spacing.three }}>
    <AppPressable disabled={assistants.length === 1} accessibilityLabel="Choose Assistant" accessibilityState={{ expanded: expanded || !selected }} onPress={() => setExpanded(!expanded)}>
      <ThemedText type="smallBold">{selected?.name ?? 'Choose an Assistant'}</ThemedText>
    </AppPressable>
    {(expanded || !selected) && assistants.map((assistant) => <AppPressable key={assistant.id} accessibilityState={{ selected: assistant.id === selected?.id }} onPress={async () => {
      try { await choose(assistant); setExpanded(false); setFailure(false); } catch { setFailure(true); }
    }}><ThemedText>{assistant.name}</ThemedText></AppPressable>)}
    {failure && <ThemedText themeColor="danger">Could not remember the Assistant. Try again.</ThemedText>}
  </View>;
}
