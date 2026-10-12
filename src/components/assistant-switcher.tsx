import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { AppPressable } from '@/components/pressable';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Elevation, Fonts, Radius, Shape, Spacing, TouchTarget } from '@/constants/theme';
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
        style={placement === 'header' ? [styles.trigger, { maxWidth: width - TouchTarget - Spacing.three * 4 }] : [styles.trigger, styles.inlineTrigger, { borderColor: theme.borderStrong }]}>
        <ThemedText type={placement === 'header' ? 'default' : 'smallBold'} numberOfLines={1} style={[styles.triggerText, placement === 'header' && styles.headerTriggerText]}>
          {selected?.name ?? 'Choose an Assistant'}
        </ThemedText>
        {!nothingElseToPick && <Icon ios="chevron.up.chevron.down" android="unfold_more" size={14} color="textSecondary" />}
      </AppPressable>
      {/* A fade, not a slide: a sliding Modal drags its scrim up from the bottom with the sheet. */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)} onDismiss={openPending}>
        <View style={styles.overlay}>
          <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]} onPress={() => setOpen(false)} />
          <ThemedView type="backgroundElement" style={[styles.sheet, Shape.continuous, { paddingBottom: bottom + Spacing.three }]}>
            <ThemedText type="smallBold" accessibilityRole="header" style={styles.sheetTitle}>Choose an Assistant</ThemedText>
            <ScrollView contentContainerStyle={styles.sheetContent}>
              {assistants.length > 0 && (
                <Group title="Legacy Assistants">
                  {assistants.map((assistant) => (
                    <Option
                      key={assistant.id}
                      kind="legacy"
                      label={`${assistant.name}, Legacy`}
                      title={assistant.name}
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
                      kind="agentic"
                      label={`${row.title}, Agentic, opens in Qlik`}
                      title={row.title}
                      subtitle={row.subtitle}
                      onPress={() => {
                        pendingHref.current = row.href;
                        setOpen(false);
                        if (Platform.OS !== 'ios') openPending();
                      }} />
                  ))}
                  {offered.noAccess && (
                    <ThemedText type="small" themeColor="textSecondary" style={styles.groupNote}>{AGENTIC_NO_ACCESS}</ThemedText>
                  )}
                </Group>
              )}
              {failure && <ThemedText type="small" themeColor="danger" style={styles.groupNote}>Could not remember the Assistant. Try again.</ThemedText>}
            </ScrollView>
          </ThemedView>
        </View>
      </Modal>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <ThemedText type="caption" themeColor="textSecondary" accessibilityRole="header" style={styles.groupTitle}>{title}</ThemedText>
      {children}
    </View>
  );
}

const KIND = {
  legacy: { badge: 'Legacy', ios: 'text.bubble', android: 'chat_bubble' },
  agentic: { badge: 'Agentic', ios: 'wand.and.stars', android: 'auto_awesome' },
} as const;

/**
 * Only a Legacy row can be current, so only it passes `current`. The kind shows as an icon and a
 * badge, never by colour alone. An Agentic row ends in an "Opens in Qlik" cue instead of a check.
 */
function Option({ kind, label, title, subtitle, current, onPress }: {
  kind: keyof typeof KIND;
  label: string;
  title: string;
  subtitle?: string;
  current?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityHint={subtitle || undefined}
      accessibilityState={current === undefined ? undefined : { selected: current }}
      onPress={onPress}
      style={[styles.option, Shape.continuous, current ? { backgroundColor: theme.backgroundSelected } : {}]}>
      <Icon ios={KIND[kind].ios} android={KIND[kind].android} size={18} color={current ? 'primary' : 'textSecondary'} />
      <View style={styles.optionText}>
        <View style={styles.titleRow}>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.optionTitle}>{title}</ThemedText>
          <View style={[styles.badge, { borderColor: theme.border }]}>
            <ThemedText type="caption" themeColor="textSecondary">{KIND[kind].badge}</ThemedText>
          </View>
        </View>
        {!!subtitle && <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{subtitle}</ThemedText>}
        {kind === 'agentic' && <ThemedText type="caption" themeColor="textSecondary">Opens in Qlik</ThemedText>}
      </View>
      {current && <Icon ios="checkmark" android="check" size={18} color="primary" />}
      {kind === 'agentic' && <Icon ios="arrow.up.right" android="north_east" size={14} color="textSecondary" />}
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  inline: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.one },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // On History the trigger is a chip, so it reads as the filter for the list below it.
  inlineTrigger: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
  },
  triggerText: { flexShrink: 1 },
  headerTriggerText: { fontFamily: Fonts.semibold, fontSize: 17, lineHeight: 22 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '75%',
    paddingTop: Spacing.three,
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    ...Elevation.floating,
  },
  sheetTitle: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.two },
  sheetContent: { paddingHorizontal: Spacing.two, gap: Spacing.three },
  group: { gap: Spacing.half },
  groupTitle: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.one },
  groupNote: { paddingHorizontal: Spacing.two },
  // Nested inside the sheet, so it takes the small radius step (outer radius minus padding).
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
  },
  optionText: { flex: 1, gap: Spacing.half },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  optionTitle: { flexShrink: 1 },
  badge: { paddingHorizontal: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.pill },
});
