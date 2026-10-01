import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Landing route for the Analytics App list (ticket 18).
export default function AppsScreen() {
  return (
    <SafeAreaView style={styles.flex}>
      <ThemedView style={styles.content}>
        <ThemedText type="title">Apps</ThemedText>
        <ThemedText themeColor="textSecondary">Your Analytics Apps will appear here.</ThemedText>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, padding: Spacing.four, gap: Spacing.one },
});
