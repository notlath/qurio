// PROTOTYPE (prototype/side-panel): throwaway. Three variants of the ADR-0011 side panel, hosted on
// the real Assistant screen with real History and Profile, switchable via `?variant=A|B|C`.
// Question it answers: what should the side panel look like? Not built to ship: no tests, the
// docked/collapsed choice is not remembered, no edge swipe, and the tab bar is still underneath.
import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AssistantSwitcher } from '@/components/assistant-switcher';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton } from '@/components/pressable';
import { PrototypeSwitcher, usePrototypeVariant } from '@/components/prototype-switcher';
import { formatRelativeTime } from '@/components/relative-time';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import type { QlikUser, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useAssistantSelection } from '@/qlik/assistant-selection';
import { useAnswersPort } from '@/qlik/context';

const VARIANTS = [
  { key: 'A', name: 'Gemini list' },
  { key: 'B', name: 'ChatGPT grouped' },
  { key: 'C', name: 'Profile first' },
] as const;
type VariantKey = (typeof VARIANTS)[number]['key'];

const LOGO = require('../../assets/images/logo.svg');
const DOCK_WIDTH = 320;
const DOCK_AT = 768;

type PanelProps = {
  threads: Thread[] | null;
  user: QlikUser | null;
  assistantName: string;
  docked: boolean;
  close: () => void;
  newChat: () => void;
  openApps: () => void;
  openSettings: () => void;
  openThread: (thread: Thread) => void;
};

function usePanelData() {
  const port = useAnswersPort();
  const { selected } = useAssistantSelection();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [user, setUser] = useState<QlikUser | null>(null);
  useEffect(() => {
    port.listThreads({ limit: 30 }).then((page) => setThreads(page.items), () => setThreads([]));
    port.getCurrentUser().then(setUser, () => setUser(null));
  }, [port, selected?.id]);
  return { threads, user, assistantName: selected?.name ?? 'Assistant', assistantId: selected?.id };
}

/** Wraps the Assistant screen: owns the hamburger button, the overlay on phones, the docked column on tablets. */
export function SidePanelPrototype({ onNew, children }: { onNew: () => void; children: ReactNode }) {
  const variant = usePrototypeVariant(VARIANTS.map((v) => v.key));
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const docked = width >= DOCK_AT;
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { threads, user, assistantName, assistantId } = usePanelData();

  const close = () => setOpen(false);
  const props: PanelProps = {
    threads,
    user,
    assistantName,
    docked,
    close,
    newChat: () => { close(); onNew(); },
    openApps: () => { close(); router.navigate('/'); },
    openSettings: () => { close(); router.navigate('/settings'); },
    openThread: (thread) => {
      close();
      router.push({ pathname: '/assistant/thread/[id]', params: { id: thread.id, assistantId, assistantName } });
    },
  };
  const Panel = PANELS[variant];

  return (
    <View style={styles.row}>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <IconButton
                accessibilityLabel={docked ? (collapsed ? 'Show side panel' : 'Hide side panel') : 'Open side panel'}
                onPress={() => (docked ? setCollapsed((c) => !c) : setOpen(true))}
                icon={<Icon ios="line.3.horizontal" android="menu" size={22} color="text" />}
              />
              <AssistantSwitcher includeAgentic placement="header" />
            </View>
          ),
        }}
      />
      {docked && !collapsed && (
        <View style={[styles.dock, { borderColor: theme.border, backgroundColor: theme.background }]}>
          <Panel {...props} />
        </View>
      )}
      <View style={styles.flex}>{children}</View>
      {!docked && (
        <Overlay open={open} onClose={close}>
          <Panel {...props} />
        </Overlay>
      )}
      <PrototypeSwitcher variants={VARIANTS} current={variant} />
    </View>
  );
}

/** Phones: slides in from the left over a dimmed backdrop; a tap on the backdrop closes it. */
function Overlay({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(width * 0.85, DOCK_WIDTH + 40);
  const [progress] = useState(() => new Animated.Value(0));
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    Animated.timing(progress, { toValue: open ? 1 : 0, duration: open ? 260 : 200, useNativeDriver: true }).start(() => setMounted(open));
  }, [open, progress]);

  return (
    <Modal transparent visible={open || mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: progress }]}>
        <Pressable accessibilityLabel="Close side panel" style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View
        style={[
          styles.overlayPanel,
          {
            width: panelWidth,
            backgroundColor: theme.background,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-panelWidth, 0] }) }],
          },
        ]}>
        {children}
      </Animated.View>
    </Modal>
  );
}

function Avatar({ user, size = 36 }: { user: QlikUser | null; size?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, backgroundColor: theme.backgroundSelected }]}>
      <Icon ios="person.fill" android="person" size={size / 2} color="textSecondary" />
      {user?.pictureUrl && <Image source={{ uri: user.pictureUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />}
    </View>
  );
}

function Brand({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.brand}>
      <Image source={LOGO} style={{ width: size, height: size, borderRadius: size / 4 }} />
      <ThemedText type="headline">Qurio</ThemedText>
    </View>
  );
}

function Item({ ios, android, label, onPress }: { ios: SFSymbol; android: AndroidSymbol; label: string; onPress: () => void }) {
  return (
    <AppPressable accessibilityLabel={label} onPress={onPress} feedback="highlight" style={styles.item}>
      <Icon ios={ios} android={android} size={20} color="text" />
      <ThemedText>{label}</ThemedText>
    </AppPressable>
  );
}

function ThreadList({ threads, empty, render }: { threads: Thread[] | null; empty: string; render: (t: Thread, i: number) => ReactNode }) {
  if (threads === null) return <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>Loading History…</ThemedText>;
  if (threads.length === 0) return <ThemedText type="small" themeColor="textSecondary" style={styles.pad}>{empty}</ThemedText>;
  return <>{threads.map(render)}</>;
}

// ── A: Gemini list ─ title + close, flat items, one "History" section, flat rows, Profile footer.
function VariantA(p: PanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom }]}>
      <View style={styles.headerRow}>
        <Brand />
        {!p.docked && (
          <IconButton accessibilityLabel="Close side panel" onPress={p.close} icon={<Icon ios="xmark" android="close" size={20} color="text" />} />
        )}
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Item ios="square.and.pencil" android="edit_square" label="New chat" onPress={p.newChat} />
        <Item ios="square.grid.2x2" android="apps" label="Apps" onPress={p.openApps} />
        <ThemedText type="small" themeColor="textSecondary" style={styles.section}>{`History · ${p.assistantName}`}</ThemedText>
        <ThreadList
          threads={p.threads}
          empty="No conversations yet."
          render={(t, i) => (
            <AppPressable key={t.id} accessibilityLabel={`Open ${t.name}`} onPress={() => p.openThread(t)} feedback="highlight"
              style={i === 0 ? [styles.threadRow, { backgroundColor: theme.backgroundSelected }] : styles.threadRow}>
              <ThemedText numberOfLines={1}>{t.name}</ThemedText>
            </AppPressable>
          )}
        />
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Avatar user={p.user} />
        <ThemedText numberOfLines={1} style={styles.flex}>{p.user?.name ?? 'Qlik User'}</ThemedText>
        <IconButton accessibilityLabel="Settings" onPress={p.openSettings} icon={<Icon ios="gearshape" android="settings" size={22} color="text" />} />
      </View>
    </View>
  );
}

function groupByAge(threads: Thread[]) {
  const day = 86_400_000;
  const now = Date.now();
  const groups: { title: string; items: Thread[] }[] = [
    { title: 'Today', items: [] },
    { title: 'Previous 7 days', items: [] },
    { title: 'Older', items: [] },
  ];
  for (const t of threads) {
    const age = now - new Date(t.updatedAt).getTime();
    groups[age < day ? 0 : age < 7 * day ? 1 : 2].items.push(t);
  }
  return groups.filter((g) => g.items.length > 0);
}

// ── B: ChatGPT grouped ─ a prominent New chat button, History grouped by age, Profile footer with email.
function VariantB(p: PanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom }]}>
      <View style={styles.headerRow}>
        <Brand size={24} />
      </View>
      <View style={styles.pad}>
        <AppPressable accessibilityLabel="New chat" onPress={p.newChat} feedback="scale"
          style={[styles.newChatPill, { backgroundColor: theme.primary }]}>
          <Icon ios="plus" android="add" size={18} color="primaryForeground" />
          <ThemedText type="smallBold" themeColor="primaryForeground">New chat</ThemedText>
        </AppPressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Item ios="square.grid.2x2" android="apps" label="Apps" onPress={p.openApps} />
        <View style={[styles.rule, { backgroundColor: theme.border }]} />
        {p.threads === null || p.threads.length === 0 ? (
          <ThreadList threads={p.threads} empty="No conversations yet." render={() => null} />
        ) : (
          groupByAge(p.threads).map((group) => (
            <View key={group.title}>
              <ThemedText type="caption" themeColor="textSecondary" style={styles.section}>{group.title.toUpperCase()}</ThemedText>
              {group.items.map((t) => (
                <AppPressable key={t.id} accessibilityLabel={`Open ${t.name}`} onPress={() => p.openThread(t)} feedback="highlight" style={styles.threadRowDense}>
                  <ThemedText type="small" numberOfLines={1}>{t.name}</ThemedText>
                </AppPressable>
              ))}
            </View>
          ))
        )}
      </ScrollView>
      <AppPressable accessibilityLabel="Settings" onPress={p.openSettings} feedback="highlight" style={[styles.footer, { borderTopColor: theme.border }]}>
        <Avatar user={p.user} size={32} />
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={1}>{p.user?.name ?? 'Qlik User'}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>{p.user?.email ?? ''}</ThemedText>
        </View>
        <Icon ios="ellipsis" android="more_horiz" size={20} color="textSecondary" />
      </AppPressable>
    </View>
  );
}

// ── C: Profile first ─ who and where at the top, two big actions as tiles, History rows with time.
function VariantC(p: PanelProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.flex, { paddingTop: insets.top + Spacing.two, paddingBottom: insets.bottom + Spacing.two }]}>
      <View style={[styles.profileCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Avatar user={p.user} size={48} />
        <View style={styles.flex}>
          <ThemedText type="headline" numberOfLines={1}>{p.user?.name ?? 'Qlik User'}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>{p.user?.email ?? ''}</ThemedText>
        </View>
        <IconButton accessibilityLabel="Settings" onPress={p.openSettings} icon={<Icon ios="gearshape" android="settings" size={22} color="text" />} />
      </View>
      <View style={styles.tiles}>
        {([
          { label: 'New chat', ios: 'square.and.pencil', android: 'edit_square', onPress: p.newChat },
          { label: 'Apps', ios: 'square.grid.2x2', android: 'apps', onPress: p.openApps },
        ] satisfies { label: string; ios: SFSymbol; android: AndroidSymbol; onPress: () => void }[]).map((tile) => (
          <AppPressable key={tile.label} accessibilityLabel={tile.label} onPress={tile.onPress} feedback="scale"
            style={[styles.tile, { backgroundColor: theme.backgroundSelected }]}>
            <Icon ios={tile.ios} android={tile.android} size={24} color="primary" />
            <ThemedText type="smallBold">{tile.label}</ThemedText>
          </AppPressable>
        ))}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={[styles.section, { paddingHorizontal: Spacing.four }]}>{`History · ${p.assistantName}`}</ThemedText>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThreadList
          threads={p.threads}
          empty="No conversations yet."
          render={(t) => (
            <AppPressable key={t.id} accessibilityLabel={`Open ${t.name}`} onPress={() => p.openThread(t)} feedback="highlight" style={styles.threadRowTwoLine}>
              <ThemedText numberOfLines={1}>{t.name}</ThemedText>
              <ThemedText type="caption" themeColor="textSecondary">{formatRelativeTime(t.updatedAt)}</ThemedText>
            </AppPressable>
          )}
        />
      </ScrollView>
      <View style={styles.brandFooter}>
        <Brand size={20} />
      </View>
    </View>
  );
}

const PANELS: Record<VariantKey, (p: PanelProps) => ReactNode> = { A: VariantA, B: VariantB, C: VariantC };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  dock: { width: DOCK_WIDTH, borderRightWidth: StyleSheet.hairlineWidth },
  overlayPanel: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, minHeight: 48 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  scroll: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.three },
  pad: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  item: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: Spacing.three, paddingHorizontal: Spacing.two, minHeight: 44, borderRadius: Radius.control },
  section: { paddingHorizontal: Spacing.two, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  threadRow: { paddingHorizontal: Spacing.two, minHeight: 44, justifyContent: 'center', borderRadius: Radius.pill },
  threadRowDense: { paddingHorizontal: Spacing.two, minHeight: 36, justifyContent: 'center', borderRadius: Radius.control },
  threadRowTwoLine: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.half },
  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  avatar: { borderRadius: Radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  newChatPill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, minHeight: 44, borderRadius: Radius.pill },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.two, marginHorizontal: Spacing.two },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, margin: Spacing.three, padding: Spacing.three, borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth },
  tiles: { flexDirection: 'row', gap: Spacing.two, paddingHorizontal: Spacing.three },
  tile: { flex: 1, alignItems: 'flex-start', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.card },
  brandFooter: { alignItems: 'center', paddingTop: Spacing.two, opacity: 0.6 },
});
