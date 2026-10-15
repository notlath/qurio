import { Drawer } from 'expo-router/drawer';
import { useWindowDimensions } from 'react-native';

import { edgeSwipeEnabled, SidePanelContent } from '@/components/side-panel';
import { sidePanelOptions, SidePanelLayoutProvider, useSidePanelLayout } from '@/components/side-panel-layout';

// The side panel holds the top-level destinations (ADR-0011). Each one owns a native stack, which
// draws the header, so the drawer draws none.
export default function SidePanelLayout() {
  return (
    <SidePanelLayoutProvider>
      <SidePanelDrawer />
    </SidePanelLayoutProvider>
  );
}

function SidePanelDrawer() {
  const { width } = useWindowDimensions();
  const { collapsed } = useSidePanelLayout();

  return (
    <Drawer
      drawerContent={SidePanelContent}
      // Back from Settings beside the docked panel returns to the destination it opened over.
      backBehavior="history"
      screenOptions={({ route }) => ({
        headerShown: false,
        // Over the content on phones (iOS otherwise slides the content aside), docked on wide windows.
        ...sidePanelOptions({ windowWidth: width, collapsed, topLevel: edgeSwipeEnabled(route) }),
      })}>
      <Drawer.Screen name="assistant" options={{ title: 'Assistant' }} />
      <Drawer.Screen name="apps" options={{ title: 'Apps' }} />
      {/* Settings beside the docked panel. The overlay panel pushes /settings on the root stack. */}
      <Drawer.Screen name="docked-settings" options={{ title: 'Settings' }} />
    </Drawer>
  );
}
