import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Radius, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { errorMessageFor } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { AGENTIC_NO_ACCESS, useAgenticRows } from '@/qlik-embed/agentic-entry';

/**
 * One picker for every kind of Assistant, after the assistant-ui Model Selector: a trigger with the
 * current Assistant, and a grouped list. Choosing a Legacy Assistant sets the current one. Choosing
 * an Agentic Assistant opens it in Qlik, so it is never marked current. History passes no
 * `includeAgentic` because its Threads belong to Legacy Assistants.
 */
export function AssistantSwitcher({ includeAgentic = false, placement = 'inline' }: { includeAgentic?: boolean; placement?: Placement }) {
  return includeAgentic ? <WithAgentic placement={placement} /> : <Selector offered={NO_AGENTIC} includeAgentic={false} placement={placement} />;
}

/** `header` is the compact trigger for a navigator header: the screen body shows any problem, via AssistantProblem. */
type Placement = 'inline' | 'header';

/** Why there is nothing to choose from: the Assistants request failed, or the Qlik User has none. */
export function AssistantProblem() {
  const { assistants, agentic, loading, error } = useAssistantSelection();
  if (loading) return null;
  if (error) {
    const message = errorMessageFor(error);
    return (
      <View style={{ padding: Spacing.three }}>
        <ThemedText type="smallBold">{message.title}</ThemedText>
        <ThemedText>{message.message}</ThemedText>
      </View>
    );
  }
  // An empty classic list does not mean a missing license: nobody has verified what Qlik returns
  // for that. Agentic Assistants are a choice too, so they count.
  if (assistants.length > 0 || agentic.length > 0) return null;
  return (
    <View style={{ padding: Spacing.three }}>
      <ThemedText type="smallBold">No Assistants available</ThemedText>
      <ThemedText>No Assistant is available to you yet. Ask your Tenant admin to give you access to an Assistant.</ThemedText>
    </View>
  );
}

const NO_AGENTIC = { rows: [], noAccess: false };

// Its own component so History, which offers no Agentic Assistants, never resolves their availability.
function WithAgentic({ placement }: { placement: Placement }) {
  return <Selector offered={useAgenticRows()} includeAgentic placement={placement} />;
}

function Selector({ offered, includeAgentic, placement }: { offered: ReturnType<typeof useAgenticRows>; includeAgentic: boolean; placement: Placement }) {
  const { assistants, agentic, selected, loading, error, choose } = useAssistantSelection();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [failure, setFailure] = useState(false);
  // iOS drops a navigation that starts while a Modal is still dismissing, so it waits for onDismiss.
  const pendingHref = useRef<Href | null>(null);
  function openPending() {
    const href = pendingHref.current;
    pendingHref.current = null;
    if (href) router.push(href);
  }
  if (loading) return <ActivityIndicator accessibilityLabel="Loading Assistants" />;
  if (error) return placement === 'header' ? null : <AssistantProblem />;
  if (assistants.length === 0) {
    // With Agentic Assistants on offer the selector still has something to show.
    if (agentic.length > 0) {
      if (!includeAgentic) return null;
    } else {
      return placement === 'header' ? null : <AssistantProblem />;
    }
  }
  const hasAgentic = offered.rows.length > 0 || offered.noAccess;
  if (assistants.length === 0 && !hasAgentic) return null;
  const nothingElseToPick = !!selected && assistants.length === 1 && !hasAgentic;

  return (
    <View style={placement === 'inline' && styles.inline}>
      <AppPressable
        disabled={nothingElseToPick}
        accessibilityLabel="Choose Assistant"
        accessibilityState={{ expanded: open, disabled: nothingElseToPick }}
        onPress={() => {
          setFailure(false);
          setOpen(true);
        }}
        // A header gives its left item no width limit, so keep room for the History button.
        style={placement === 'header' ? [styles.trigger, { maxWidth: width - TouchTarget - Spacing.three * 4 }] : styles.trigger}>
        <ThemedText type={placement === 'header' ? 'default' : 'smallBold'} numberOfLines={1} style={[styles.triggerText, placement === 'header' && styles.headerTriggerText]}>
          {selected?.name ?? 'Choose an Assistant'}
        </ThemedText>
        {!nothingElseToPick && <Icon ios="chevron.up.chevron.down" android="unfold_more" size={14} color="textSecondary" />}
      </AppPressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} onDismiss={openPending}>
        <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={() => setOpen(false)} />
        <ThemedView type="backgroundElement" style={[styles.sheet, Shape.continuous, { paddingBottom: bottom + Spacing.three, borderColor: theme.border }]}>
          <ScrollView>
            {assistants.length > 0 && (
              <Group title="Legacy Assistants">
                {assistants.map((assistant) => (
                  <Option
                    key={assistant.id}
                    label={`${assistant.name}, Legacy`}
                    title={assistant.name}
                    badge="Legacy"
                    subtitle={assistant.description}
                    current={assistant.id === selected?.id}
                    onPress={async () => {
                      try {
                        await choose(assistant);
                        setOpen(false);
                        setFailure(false);
                      } catch {
                        setFailure(true);
                      }
                    }} />
                ))}
              </Group>
            )}
            {hasAgentic && (
              <Group title="Agentic Assistants">
                {offered.rows.map((row) => (
                  <Option
                    key={row.key}
                    label={`${row.title}, Agentic, opens in Qlik`}
                    title={row.title}
                    badge="Agentic"
                    subtitle={row.subtitle}
                    cue="Opens in Qlik"
                    onPress={() => {
                      pendingHref.current = row.href;
                      setOpen(false);
                      if (Platform.OS !== 'ios') openPending();
                    }} />
                ))}
                {offered.noAccess && (
                  <ThemedText type="small" themeColor="textSecondary">{AGENTIC_NO_ACCESS}</ThemedText>
                )}
              </Group>
            )}
            {failure && <ThemedText themeColor="danger">Could not remember the Assistant. Try again.</ThemedText>}
          </ScrollView>
        </ThemedView>
      </Modal>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText type="caption" themeColor="textSecondary" accessibilityRole="header">{title.toUpperCase()}</ThemedText>
      {children}
    </View>
  );
}

/** Only a Legacy row can be current, so only it passes `current`. */
function Option({ label, title, badge, subtitle, cue, current, onPress }: {
  label: string;
  title: string;
  badge: string;
  subtitle?: string;
  cue?: string;
  current?: boolean;
  onPress: () => void;
}) {
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityHint={subtitle || undefined}
      accessibilityState={current === undefined ? undefined : { selected: current }}
      onPress={onPress}
      style={styles.option}>
      <View style={styles.optionText}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">{badge}</ThemedText>
        </View>
        {!!subtitle && <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>}
      </View>
      {current && <Icon ios="checkmark" android="check" size={18} color="primary" />}
      {cue && <ThemedText type="caption" themeColor="textSecondary">{cue}</ThemedText>}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  inline: { padding: Spacing.three },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  triggerText: { flexShrink: 1 },
  headerTriggerText: { fontFamily: Fonts.semibold, fontSize: 18, lineHeight: 24 },
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: '70%',
    padding: Spacing.three,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  group: { gap: Spacing.one, paddingBottom: Spacing.three },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  optionText: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
});
