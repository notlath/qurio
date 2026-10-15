import { Drawer } from 'expo-router/drawer';

import { edgeSwipeEnabled, SidePanelContent } from '@/components/side-panel';
import { useTheme } from '@/hooks/use-theme';

// The side panel holds the top-level destinations (ADR-0011). Each one owns a native stack, which
// draws the header, so the drawer draws none.
export default function SidePanelLayout() {
  const theme = useTheme();

  return (
    <Drawer
      drawerContent={SidePanelContent}
      screenOptions={({ route }) => ({
        headerShown: false,
        // Over the content on phones. iOS otherwise slides the content aside.
        drawerType: 'front',
        swipeEnabled: edgeSwipeEnabled(route),
        drawerActiveTintColor: theme.primary,
        drawerActiveBackgroundColor: theme.backgroundSelected,
        drawerInactiveTintColor: theme.text,
      })}>
      <Drawer.Screen name="assistant" options={{ title: 'Assistant' }} />
      <Drawer.Screen name="apps" options={{ title: 'Apps' }} />
    </Drawer>
  );
}
