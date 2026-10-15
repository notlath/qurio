import { useNavigation, useRouter } from 'expo-router';
import { DrawerContentScrollView, DrawerItem, DrawerItemList, type DrawerContentComponentProps } from 'expo-router/drawer';
import { DrawerActions, getFocusedRouteNameFromRoute, type RouteProp } from 'expo-router/react-navigation';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/pressable';

/**
 * The left edge opens the side panel on a top-level screen only: the first screen of a drawer
 * screen's stack. On a pushed screen the left edge stays swipe-to-go-back. The drawer reads this
 * option from its focused screen, which holds the whole stack, so the stack's focused route decides.
 */
export function edgeSwipeEnabled(route: RouteProp<Record<string, object | undefined>>): boolean {
  const focused = getFocusedRouteNameFromRoute(route);
  return focused === undefined || focused === 'index';
}

/** The header button that opens the side panel, at the left of a top-level screen. */
export function SidePanelButton() {
  const navigation = useNavigation();

  return (
    <IconButton
      accessibilityLabel="Open side panel"
      onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
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
