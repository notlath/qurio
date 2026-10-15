import { Image } from 'expo-image';
import { useNavigation, useRouter } from 'expo-router';
import { getDrawerStatusFromState, type DrawerContentComponentProps } from 'expo-router/drawer';
import { DrawerActions, getFocusedRouteNameFromRoute, type RouteProp } from 'expo-router/react-navigation';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useEffect, useRef, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmDeleteThread } from '@/components/confirm-delete-thread';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { AppPressable, IconButton } from '@/components/pressable';
import { formatRelativeTime } from '@/components/relative-time';
import { settingsHref, useSidePanelLayout } from '@/components/side-panel-layout';
import { ProfileAvatar, useProfile } from '@/components/sign-in-section';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import type { Assistant, Thread } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import { useThreadHistory } from '@/hooks/use-thread-history';
import { useAssistantSelection } from '@/qlik/assistant-selection';

// Relative, not `@/`: Jest maps `@/` to `src/` only.
const LOGO = require('../../assets/images/logo.svg');

/**
 * The left edge opens the side panel on a top-level screen only: the first screen of a drawer
 * screen's stack. On a pushed screen the left edge stays swipe-to-go-back. The drawer reads this
 * option from its focused screen, which holds the whole stack, so the stack's focused route decides.
 * Settings beside the docked panel is a drawer screen. It counts as pushed when the window narrows.
 */
export function edgeSwipeEnabled(route: RouteProp<Record<string, object | undefined>>): boolean {
  if (route.name === 'docked-settings') return false;
  const focused = getFocusedRouteNameFromRoute(route);
  return focused === undefined || focused === 'index';
}

/**
 * True while an Agentic Assistant is the one in use: the Assistant's stack shows the `agentic` screen.
 * The Assistant selection holds Legacy Assistants only. An Agentic Assistant is opened as a screen and
 * never selected, so the stack is the signal. It stays true while Apps is open over it.
 */
export function agenticInUse(state: DrawerContentComponentProps['state']): boolean {
  const assistant = state.routes.find(({ name }) => name === 'assistant');
  return assistant !== undefined && getFocusedRouteNameFromRoute(assistant) === 'agentic';
}

/**
 * The Thread the chat screen shows: one opened from History, or one a new chat started with its first
 * question. None for a new chat with no question yet.
 */
export function openThreadId(state: DrawerContentComponentProps['state']): string | undefined {
  const stack = state.routes.find(({ name }) => name === 'assistant')?.state;
  const params = stack?.routes.find(({ name }) => name === 'index')?.params as { thread?: string; started?: string } | undefined;
  return params?.thread ?? params?.started;
}

/** The header button at the left of a top-level screen. It opens the overlay panel, or collapses and shows the docked panel. */
export function SidePanelButton() {
  const navigation = useNavigation();
  const { docked, collapsed, toggleCollapsed } = useSidePanelLayout();

  return (
    <IconButton
      accessibilityLabel={!docked ? 'Open side panel' : collapsed ? 'Show side panel' : 'Hide side panel'}
      onPress={() => (docked ? toggleCollapsed() : navigation.dispatch(DrawerActions.openDrawer()))}
      icon={<Icon ios="line.3.horizontal" android="menu" size={22} color="primary" />}
    />
  );
}

/** One full-width row of the panel: an icon and a label. */
function PanelItem({ ios, android, label, onPress }: { ios: SFSymbol; android: AndroidSymbol; label: string; onPress: () => void }) {
  return (
    <AppPressable accessibilityLabel={label} onPress={onPress} feedback="highlight" style={styles.row}>
      <View style={styles.itemContent}>
        <Icon ios={ios} android={android} size={20} color="text" />
        <ThemedText>{label}</ThemedText>
      </View>
    </AppPressable>
  );
}

/**
 * The side panel (ADR-0011, prototype variant A): the Qurio name, New chat and Apps, the selected
 * Assistant's History, and the Profile with the gear that pushes Settings. Every action closes the
 * panel first, because the panel covers the content on phones.
 */
export function SidePanelContent({ navigation, state }: DrawerContentComponentProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { selected } = useAssistantSelection();
  const { docked } = useSidePanelLayout();
  const open = getDrawerStatusFromState(state) === 'open';
  const openThread = openThreadId(state);

  function closeThen(action: () => void) {
    navigation.closeDrawer();
    action();
  }

  function newChat() {
    // A new value every time, so the Assistant screen starts a new Thread even when it is already open.
    navigation.navigate('assistant', { screen: 'index', params: { chat: String(Date.now()) }, pop: true });
  }

  const items = (
    <View style={styles.items}>
      <PanelItem
        ios="square.and.pencil"
        android="edit_square"
        label="New chat"
        onPress={() => closeThen(newChat)}
      />
      <PanelItem ios="square.grid.2x2" android="apps" label="Apps" onPress={() => closeThen(() => navigation.navigate('apps'))} />
    </View>
  );

  return (
    <View style={[styles.panel, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.top}>
        <View style={styles.brand}>
          <Image source={LOGO} style={styles.logo} accessible={false} />
          <ThemedText type="headline" accessibilityRole="header">
            Qurio
          </ThemedText>
        </View>
        {/* The docked panel collapses from the header's menu button instead. */}
        {!docked && (
          <IconButton
            accessibilityLabel="Close side panel"
            onPress={() => navigation.closeDrawer()}
            icon={<Icon ios="xmark" android="close" size={20} color="text" />}
          />
        )}
      </View>
      {/* The app cannot list an Agentic Assistant's chats (ADR-0009), so the panel says where they are.
          With no Assistant there is no History. The header's Assistant switcher says why. */}
      {agenticInUse(state) ? (
        <View style={[styles.flex, styles.list]}>
          {items}
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header" style={styles.section}>
            History
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            Agentic Assistant chats are kept in the Assistant view.
          </ThemedText>
        </View>
      ) : selected ? (
        <PanelHistory
          // A new Assistant has its own History, so its list starts again from the first page.
          key={selected.id}
          assistant={selected}
          open={open}
          openThread={openThread}
          header={items}
          onOpenThread={(thread) =>
            // The open Thread is already the current chat. Opening it again would reload it.
            closeThen(() =>
              thread.id !== openThread &&
              navigation.navigate('assistant', { screen: 'index', params: { thread: thread.id, assistantId: selected.id }, pop: true }),
            )
          }
          // The panel stays open, but the Assistant view must not show a deleted Thread.
          onDeletedThread={(thread) => {
            if (thread.id === openThread) newChat();
          }}
        />
      ) : (
        <View style={styles.flex}>{items}</View>
      )}
      <ProfileFooter onSettings={() => closeThen(() => router.push(settingsHref(docked)))} />
    </View>
  );
}

function PanelHistory({
  assistant,
  open,
  openThread,
  header,
  onOpenThread,
  onDeletedThread,
}: {
  assistant: Assistant;
  open: boolean;
  openThread: string | undefined;
  header: ReactElement;
  onOpenThread: (thread: Thread) => void;
  onDeletedThread: (thread: Thread) => void;
}) {
  const theme = useTheme();
  const { threads, initialLoad, error, erroredAt, loadingMore, refresh, retry, loadMore, dismissError, remove } = useThreadHistory();

  // A long press and the screen reader's Delete action ask first. No swipe-to-delete: in the panel a
  // left swipe closes the panel.
  function confirmDelete(thread: Thread) {
    confirmDeleteThread(thread, () => {
      void remove(thread.id);
      onDeletedThread(thread);
    });
  }

  // The panel stays mounted while it is closed. Each time it opens, it loads the first page again,
  // so a Thread started since the last time is listed.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) refresh();
    wasOpen.current = open;
  }, [open, refresh]);

  // The docked panel never goes from closed to open. A Thread that a new chat starts, or one opened
  // from elsewhere, tells it to load the first page again, so the open Thread is listed.
  const listedOpen = useRef(openThread);
  useEffect(() => {
    if (openThread !== listedOpen.current && openThread !== undefined) refresh();
    listedOpen.current = openThread;
  }, [openThread, refresh]);

  return (
    <FlatList
      style={styles.flex}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <>
          {header}
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="header" numberOfLines={1} style={styles.section}>
            {`History · ${assistant.name}`}
          </ThemedText>
        </>
      }
      data={threads}
      keyExtractor={(item) => item.id}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      renderItem={({ item }) => (
        <AppPressable
          accessibilityLabel={`Open ${item.name}`}
          accessibilityHint={`Last updated ${formatRelativeTime(item.updatedAt)}`}
          onPress={() => onOpenThread(item)}
          accessibilityState={{ selected: item.id === openThread }}
          onLongPress={() => confirmDelete(item)}
          accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'delete') confirmDelete(item);
          }}
          feedback="highlight"
          style={[styles.row, { backgroundColor: item.id === openThread ? theme.backgroundSelected : 'transparent' }]}>
          <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        </AppPressable>
      )}
      ListEmptyComponent={
        initialLoad ? (
          <View accessible accessibilityLabel="Loading conversations">
            {[0, 1, 2, 3].map((i) => (
              <ThreadRowSkeleton key={i} />
            ))}
          </View>
        ) : error ? (
          <ErrorState error={error} erroredAt={erroredAt} onRetry={retry} onDismiss={dismissError} />
        ) : (
          // No button: New chat is directly above.
          <EmptyState
            icon={<Icon ios="bubble.left.and.bubble.right" android="forum" size={28} color="primary" />}
            title="No conversations yet"
            message="Ask the Assistant a question and the conversation will be saved here."
          />
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoading} /> : null}
    />
  );
}

/** A placeholder in a History row's shape, so the list does not move when the Threads arrive. */
function ThreadRowSkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <View style={[styles.skeletonLine, { backgroundColor: theme.backgroundSelected }]} />
    </View>
  );
}

function ProfileFooter({ onSettings }: { onSettings: () => void }) {
  const theme = useTheme();
  const { user, error } = useProfile();

  return (
    <View style={[styles.footer, { borderTopColor: theme.border }]}>
      <ProfileAvatar user={user} size={Spacing.five} />
      {user ? (
        <ThemedText numberOfLines={1} style={styles.flex}>
          {user.name || 'Qlik User'}
        </ThemedText>
      ) : (
        // Settings shows the same message with a Retry, one tap away on the gear.
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.flex}>
          {error ?? 'Loading profile…'}
        </ThemedText>
      )}
      <IconButton
        accessibilityLabel="Settings"
        onPress={onSettings}
        icon={<Icon ios="gearshape" android="settings" size={22} color="text" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  panel: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    minHeight: TouchTarget + Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: Spacing.five, height: Spacing.five, borderRadius: Radius.small },
  items: { gap: Spacing.half },
  list: { paddingHorizontal: Spacing.two, paddingBottom: Spacing.three, gap: Spacing.half },
  // Inset from the panel's edges, so the press highlight reads as a pill, as in the Gemini app.
  row: { paddingHorizontal: Spacing.three, borderRadius: Radius.pill, overflow: 'hidden' },
  itemContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  section: { paddingHorizontal: Spacing.three, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  note: { paddingHorizontal: Spacing.three },
  skeletonLine: { width: '70%', height: 12, borderRadius: Radius.pill },
  footerLoading: { paddingVertical: Spacing.three },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
