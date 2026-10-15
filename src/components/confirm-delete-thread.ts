import { Alert } from 'react-native';

import { warningHaptic } from '@/components/haptics';
import type { Thread } from '@/domain';

/**
 * Asks before a Thread is deleted, because a delete is not undoable. `onDelete` runs on Delete.
 * `onCancel` runs on Cancel, and on Android also when a tap outside the dialog dismisses it.
 */
export function confirmDeleteThread(thread: Thread, onDelete: () => void, onCancel?: () => void): void {
  Alert.alert(
    'Delete conversation?',
    `"${thread.name}" and its answers will be permanently removed.`,
    [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          warningHaptic();
          onDelete();
        },
      },
    ],
    { cancelable: true, onDismiss: onCancel },
  );
}
