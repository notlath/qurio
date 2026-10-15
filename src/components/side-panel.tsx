import { useNavigation, useRouter } from 'expo-router';
import { DrawerContentScrollView, DrawerItem, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';
import { DrawerActions, getFocusedRouteNameFromRoute, type RouteProp } from 'expo-router/react-navigation';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';
import { useSidePanelLayout } from '@/components/side-panel-layout';

/**
 * The left edge opens the side panel on a top-level screen only: the first screen of a drawer
 * screen's stack. On a pushed screen the left edge stays swipe-to-go-back. The drawer reads this
 * option from its focused screen, which holds the whole stack, so the stack's focused route decides.
 * Settings is a drawer screen only so that it opens beside the docked panel. It counts as pushed.
 */
export function edgeSwipeEnabled(route: RouteProp<Record<string, object | undefined>>): boolean {
  if (route.name === 'settings') return false;
  const focused = getFocusedRouteNameFromRoute(route);
  return focused === undefined || focused === 'index';
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

/** The side panel: the top-level destinations, then Settings, which pushes over them. */
export function SidePanelContent(props: DrawerContentComponentProps) {
  const router = useRouter();

  return (
    <DrawerContentScrollView {...props}>
      <DrawerItemList {...props} />
      <DrawerItem
        label="Settings"
        onPress={() => {
          props.navigation.closeDrawer();
          router.push('/settings');
        }}
      />
    </DrawerContentScrollView>
  );
}
