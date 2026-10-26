import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { selectionHaptic } from '@/components/haptics';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton } from '@/components/pressable';
import { TextStyles, ThemedText } from '@/components/themed-text';
import { Radius, Shape, Spacing, TouchTarget } from '@/constants/theme';
import { errorMessageFor } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { AGENTIC_NO_ACCESS, useAgenticRows } from '@/qlik-embed/agentic-entry';

/**
 * One picker for every kind of Assistant, after the assistant-ui Model Selector: a trigger with the
 * current Assistant, and a grouped list in a native form sheet (the `assistant/choose` route).
 * Choosing a Legacy Assistant sets the current one. Choosing an Agentic Assistant opens it in Qlik,
 * so it is never marked current. History passes no `includeAgentic` because its Threads belong to
 * Legacy Assistants.
 */
export function AssistantSwitcher({ includeAgentic = false, placement = 'inline' }: { includeAgentic?: boolean; placement?: Placement }) {
  return includeAgentic ? <WithAgentic placement={placement} /> : <Selector offered={NO_AGENTIC} includeAgentic={false} placement={placement} />;
}

/** `header` is the compact trigger for a navigator header: the screen body shows any problem, via AssistantProblem. */
type Placement = 'inline' | 'header';

/**
 * Why there is nothing to choose from: the Assistants request failed, or the Qlik User has none.
 * `top` moves it below a transparent header.
 */
export function AssistantProblem({ top = 0 }: { top?: number }) {
  const { assistants, agentic, loading, error } = useAssistantSelection();
  if (loading) return null;
  if (error) {
    const message = errorMessageFor(error);
    return (
      <View style={{ padding: Spacing.three, paddingTop: Spacing.three + top }}>
        <ThemedText type="smallBold">{message.title}</ThemedText>
        <ThemedText>{message.message}</ThemedText>
      </View>
    );
  }
  // An empty classic list does not mean a missing license: nobody has verified what Qlik returns
  // for that. Agentic Assistants are a choice too, so they count.
  if (assistants.length > 0 || agentic.length > 0) return null;
  return (
    <View style={{ padding: Spacing.three, paddingTop: Spacing.three + top }}>
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
  const { assistants, agentic, selected, loading, error } = useAssistantSelection();
  const router = useRouter();
  const theme = useTheme();
  const { width } = useWindowDimensions();
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
        accessibilityState={{ disabled: nothingElseToPick }}
        onPress={() => router.push(includeAgentic ? '/assistant/choose?agentic=1' : '/assistant/choose')}
        // In the header it is a bar button, so it dims. On History it is a chip, so it scales.
        feedback={placement === 'header' ? 'opacity' : 'scale'}
        // A header gives its left item no width limit, so keep room for the side panel button on its
        // left and the header's right buttons.
        style={placement === 'header' ? [styles.trigger, styles.headerTrigger, { maxWidth: width - TouchTarget * 3 - Spacing.three * 4 }] : [styles.trigger, styles.inlineTrigger, { borderColor: theme.borderStrong }]}>
        <ThemedText type={placement === 'header' ? 'headline' : 'smallBold'} numberOfLines={1} style={styles.triggerText}>
          {selected?.name ?? 'Choose an Assistant'}
        </ThemedText>
        {!nothingElseToPick && <Icon ios="chevron.up.chevron.down" android="unfold_more" size={14} color="textSecondary" />}
      </AppPressable>
    </View>
  );
}

/**
 * The list inside the `assistant/choose` form sheet. The sheet's own title and Close button live
 * here, because Android draws no navigator header inside a form sheet.
 */
export function AssistantChooser({ includeAgentic }: { includeAgentic: boolean }) {
  return includeAgentic ? <ChooserWithAgentic /> : <Chooser offered={NO_AGENTIC} />;
}

// Its own component so History's list never resolves Agentic availability.
function ChooserWithAgentic() {
  return <Chooser offered={useAgenticRows()} />;
}

function Chooser({ offered }: { offered: ReturnType<typeof useAgenticRows> }) {
  const { assistants, selected, choose, loading } = useAssistantSelection();
  const router = useRouter();
  const { bottom } = useSafeAreaInsets();
  const [failure, setFailure] = useState(false);
  const hasAgentic = offered.rows.length > 0 || offered.noAccess;

  return (
    <>
      {/* iOS sizes a form sheet's ScrollView from its siblings: a header must stay a real view
          (`collapsable={false}`), or the ScrollView is laid over it and hides the title. */}
      <View collapsable={false} style={styles.sheetHeader}>
        <ThemedText type="headline" accessibilityRole="header" style={styles.sheetTitle}>Choose an Assistant</ThemedText>
        <IconButton
          accessibilityLabel="Close"
          onPress={() => router.back()}
          icon={<Icon ios="xmark" android="close" size={18} color="textSecondary" />}
        />
      </View>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[styles.sheetContent, { paddingBottom: Spacing.four + (Platform.OS === 'ios' ? 0 : bottom) }]}>
        {/* The trigger hides itself with nothing to choose, but a link can still open the sheet. */}
        {loading ? (
          <ActivityIndicator accessibilityLabel="Loading Assistants" />
        ) : assistants.length === 0 && !hasAgentic ? (
          <AssistantProblem />
        ) : null}
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
                  setFailure(false);
                  try {
                    await choose(assistant);
                    selectionHaptic();
                    router.back();
                  } catch {
                    setFailure(true);
                  }
                }} />
            ))}
          </Group>
        )}
        {hasAgentic && (
          // Said once for the group, not on every row. Each row's label still says it.
          <Group title="Agentic Assistants" note="Opens in Qlik">
            {offered.rows.map((row) => (
              <Option
                key={row.key}
                kind="agentic"
                label={`${row.title}, Agentic, opens in Qlik`}
                title={row.title}
                // Replaces the sheet, so Back from the Agentic Assistant returns to the Assistant screen.
                onPress={() => router.replace(row.href)} />
            ))}
            {offered.noAccess && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.groupNote}>{AGENTIC_NO_ACCESS}</ThemedText>
            )}
          </Group>
        )}
        {failure && <ThemedText type="small" themeColor="danger" style={styles.groupNote}>Could not remember the Assistant. Try again.</ThemedText>}
      </ScrollView>
    </>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <ThemedText type="smallBold" themeColor="textSecondary" accessibilityRole="header">{title}</ThemedText>
        {note && <ThemedText type="small" themeColor="textSecondary">{note}</ThemedText>}
      </View>
      {children}
    </View>
  );
}

const KIND = {
  legacy: { ios: 'text.bubble', android: 'chat_bubble' },
  agentic: { ios: 'wand.and.stars', android: 'auto_awesome' },
} as const;

/**
 * One line per Assistant: its icon, its name and, for a Legacy Assistant, its description. The
 * group heading gives the kind, and the icon repeats it, so it is never shown by colour alone.
 * Only a Legacy row can be current, so only it passes `current`. An Agentic row ends in an
 * outward arrow instead of a check, because it opens in Qlik.
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
      feedback="highlight"
      style={[styles.option, Shape.continuous, current ? { backgroundColor: theme.backgroundSelected } : {}]}>
      <FirstLine>
        <Icon ios={KIND[kind].ios} android={KIND[kind].android} size={20} color={current ? 'primary' : 'textSecondary'} />
      </FirstLine>
      <View style={styles.optionText}>
        {/* Two lines: the name is how one Assistant is told from another, so it is not cut to one. */}
        <ThemedText type="defaultSemiBold" numberOfLines={2}>{title}</ThemedText>
        {!!subtitle && <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>{subtitle}</ThemedText>}
      </View>
      {current && (
        <FirstLine>
          <Icon ios="checkmark" android="check" size={18} color="primary" />
        </FirstLine>
      )}
      {kind === 'agentic' && (
        <FirstLine>
          <Icon ios="arrow.up.right" android="north_east" size={16} color="textSecondary" />
        </FirstLine>
      )}
    </AppPressable>
  );
}

/** Centres an icon on the name's first line, so it stays beside the name however many lines follow. */
function FirstLine({ children }: { children: ReactNode }) {
  return <View style={styles.firstLine}>{children}</View>;
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
  // On iOS the header picker is the centered title, with no capsule. The inset keeps its text clear of
  // the side panel button. Android puts a gap between them instead.
  headerTrigger: { paddingHorizontal: Platform.OS === 'ios' ? Spacing.three : 0 },
  // The sheet uses three sizes only: headline (17) for its title, defaultSemiBold (16) for each
  // Assistant name, small (14) for everything secondary. Captions (12) were too small to read here.
  // One left edge for the title, the group headings and the row icons: the list inset plus the row's own.
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
    paddingLeft: Spacing.five,
    paddingRight: Spacing.three,
  },
  sheetTitle: { flex: 1 },
  sheetContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, gap: Spacing.four },
  group: { gap: Spacing.one },
  groupHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  groupNote: { paddingHorizontal: Spacing.three },
  // Nested inside the sheet, so it takes the small radius step (outer radius minus padding).
  // Top-aligned, because a row grows to a two-line name and a two-line description. A one-line row
  // is 54pt: the name's line height inside the vertical padding.
  option: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Radius.small,
  },
  firstLine: { height: TextStyles.defaultSemiBold.lineHeight, justifyContent: 'center' },
  optionText: { flex: 1, gap: Spacing.half },
});
