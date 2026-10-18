import { useState } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, TextInput, View } from 'react-native';

import { AppPressable, PrimaryButton } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shape, Spacing } from '@/constants/theme';
import type { Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';

/**
 * Asks for a new name for a Thread. `Alert.prompt` is iOS only, so this is a modal dialog on both
 * platforms. `onSave` resolves true when the rename is saved. The dialog closes only then, so a
 * failed save keeps the draft for another try.
 */
export function RenameThreadDialog({
  thread,
  onSave,
  onClose,
}: {
  thread: Thread;
  onSave: (name: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [draft, setDraft] = useState(thread.name);
  const [saving, setSaving] = useState(false);
  const name = draft.trim();
  const canSave = name !== '' && name !== thread.name && !saving;

  async function save() {
    setSaving(true);
    const saved = await onSave(name);
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.backdrop, { backgroundColor: theme.scrim }]}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, Shape.continuous, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
          <ThemedText type="headline" accessibilityRole="header">
            Rename conversation
          </ThemedText>
          <TextInput
            accessibilityLabel="Conversation name"
            style={[styles.input, Shape.continuous, { borderColor: theme.borderStrong, color: theme.text, backgroundColor: theme.background }]}
            value={draft}
            onChangeText={setDraft}
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            onSubmitEditing={() => canSave && void save()}
          />
          <View style={styles.actions}>
            <AppPressable accessibilityLabel="Cancel" onPress={onClose} style={styles.cancel}>
              <ThemedText type="smallBold" themeColor="primary">
                Cancel
              </ThemedText>
            </AppPressable>
            <PrimaryButton label="Save" busy={saving} disabled={!canSave} onPress={() => void save()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  dialog: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.two },
  cancel: { paddingHorizontal: Spacing.three },
});
